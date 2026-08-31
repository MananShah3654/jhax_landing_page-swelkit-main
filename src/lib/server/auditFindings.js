/**
 * Grounded audit findings — the only part of the teaser written in prose.
 *
 * Runs SERVER-SIDE (Vite middleware in dev, Cloud Function in prod) because it holds
 * the Gemini API key. The browser never sees it.
 *
 * The hard requirement is that a finding must be a true statement about THIS
 * restaurant, drawn from data Google actually returned. Two independent mechanisms
 * enforce that, because a prompt alone is not a guarantee:
 *
 *   1. The prompt gives the model only the fetched payload and forbids outside
 *      knowledge, generic advice, and any number not present in the input.
 *   2. verifyFindings() below re-checks every returned finding against the payload
 *      AFTER generation and DROPS any whose evidence cannot be located. A finding
 *      that cannot be traced back to source data never reaches the user.
 *
 * Mechanism 2 is the one that matters. Treat the model as untrusted and the
 * verifier as the gate.
 */
import { GoogleGenAI, ApiError } from '@google/genai';
import { z } from 'zod';

/** Short output, latency-sensitive path — the teaser is on a 10s budget. */
const MAX_TOKENS = 8000;

/**
 * Overridable so the model can be changed without a code edit — Gemini ships new
 * ids faster than this file gets touched, and a bad default should be fixable from
 * the environment.
 */
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

const EVIDENCE_SOURCES = [
	'review',
	'rating',
	'review_count',
	'hours',
	'website',
	'description',
	'price_level'
];

const FindingSchema = z.object({
	kind: z
		.enum(['working', 'quick_win'])
		.describe('"working" = something this restaurant is doing well. "quick_win" = a fixable problem.'),
	severity: z
		.enum(['urgent', 'moderate', 'positive'])
		.describe(
			'How much this matters. "urgent" = costing them customers now. "moderate" = worth fixing soon. "positive" = only for kind "working".'
		),
	label: z
		.string()
		.describe(
			'A 3-6 word factual name for this finding, shown to visitors who have NOT signed up while the detail stays hidden. It must be true on its own and must not contain any number. Examples: "No website linked", "Slow service in recent reviews", "Opening hours incomplete".'
		),
	title: z.string().describe('One specific sentence about THIS restaurant. No generic advice.'),
	body: z.string().describe('Two sentences at most, explaining what the evidence shows and what to do.'),
	evidence: z
		.string()
		.describe(
			'The exact supporting text COPIED VERBATIM from the input: either a fragment of a review, or the exact figure as written. Must appear character-for-character in the input.'
		),
	evidence_source: z.enum(EVIDENCE_SOURCES).describe('Which input field the evidence came from.')
});

const FindingsSchema = z.object({
	findings: z.array(FindingSchema)
});

/**
 * The same schema, as JSON Schema, for Gemini's `responseJsonSchema`.
 *
 * Derived rather than hand-written so it cannot drift from the zod object that
 * validates the response. `$schema` is stripped: Gemini's supported keyword list
 * does not include it.
 */
const RESPONSE_JSON_SCHEMA = (() => {
	const { $schema, ...schema } = z.toJSONSchema(FindingsSchema);
	return schema;
})();

const SYSTEM_PROMPT = `You analyse a restaurant's public Google Maps listing and report what is genuinely true about it.

You will receive a JSON payload of data Google returned for ONE restaurant. That payload is the ONLY thing you know. You have no other knowledge of this business.

Produce findings of two kinds:
- "working": something this restaurant is measurably doing well.
- "quick_win": a specific, fixable problem.

Aim for one or two of each. Fewer is correct when the data does not support more.

RULES — these are absolute:
1. Every finding must rest on something present in the payload. If the payload does not support a claim, do not make it.
2. The "evidence" field must be copied VERBATIM from the payload — an exact fragment of a review's text, or a figure exactly as written. Never paraphrase inside "evidence". It is checked character-for-character against the input and your finding is discarded if it does not match.
3. Never invent, estimate, extrapolate, or round any number. Use figures exactly as given.
4. You are shown at most 5 reviews out of a much larger total. Never claim a pattern across all customers. Say "two of the five recent reviews shown" — never "customers frequently say".
5. No generic restaurant advice. If a sentence would be true of any restaurant, it does not belong here.
6. Do not speculate about revenue, foot traffic, staffing, or anything not in the payload.
7. Write plainly and directly to the owner. No marketing voice, no exclamation marks.
8. "severity" must be "positive" for every "working" finding, and "urgent" or "moderate" for every "quick_win".
9. "label" is shown to people who have NOT signed up, with everything else hidden. It must name the real issue ("No website linked"), never tease emptily ("Something needs attention"). Put NO numbers in it — numbers belong in title/body where they can be checked.`;

/** @param {number} status @param {string} message */
function httpErr(status, message) {
	const e = /** @type {Error & { status?: number }} */ (new Error(message));
	e.status = status;
	return e;
}

/**
 * Reduce the provider's place object to exactly what the model may see.
 * Anything not listed here cannot end up in a finding.
 */
export function buildPayload(place) {
	return {
		name: place?.name ?? null,
		address: place?.address ?? null,
		rating: place?.rating ?? null,
		review_count: place?.review_count ?? null,
		price_level: place?.price_level ?? null,
		website: place?.website ?? null,
		description: place?.editorial_summary ?? null,
		opening_hours: place?.opening_hours?.weekday_text ?? [],
		open_now: place?.opening_hours?.open_now ?? null,
		photo_count: place?.photo_count ?? 0,
		reviews_shown: (place?.top_reviews ?? []).map((r) => ({
			rating: r.rating ?? null,
			text: r.text ?? null,
			when: r.relative_time ?? null
		})),
		total_reviews_not_shown:
			typeof place?.review_count === 'number'
				? Math.max(0, place.review_count - (place?.top_reviews?.length ?? 0))
				: null
	};
}

/** Normalize for substring comparison: collapse whitespace, unify quotes, lowercase. */
function norm(s) {
	return String(s ?? '')
		.replace(/[‘’‛]/g, "'")
		.replace(/[“”]/g, '"')
		.replace(/\s+/g, ' ')
		.trim()
		.toLowerCase();
}

/**
 * THE GATE. Re-check each finding's evidence against the payload and keep only what
 * can be traced back to it. Runs after generation, independent of the prompt.
 *
 * @param {Array<object>} findings
 * @param {object} payload the same object handed to the model
 * @returns {{ kept: Array<object>, dropped: Array<{ finding: object, reason: string }> }}
 */
export function verifyFindings(findings, payload) {
	const reviewTexts = (payload.reviews_shown || []).map((r) => norm(r.text));
	const numericFacts = [payload.rating, payload.review_count, payload.photo_count]
		.filter((n) => n != null)
		.flatMap((n) => [String(n), Number(n).toLocaleString('en-US')])
		.map(norm);
	const hoursText = (payload.opening_hours || []).map(norm);

	// Every number that legitimately appears anywhere in the payload. A locked row's
	// label is shown before signup, so it gets its own grounding check: it may not
	// contain a figure that is not real.
	const payloadNumbers = new Set(
		JSON.stringify(payload)
			.match(/\d+(?:\.\d+)?/g)
			?.map(String) ?? []
	);

	const kept = [];
	const dropped = [];

	for (const f of findings) {
		// severity must agree with kind — a "working" finding rendered with an urgent
		// red icon would misrepresent it on the locked row.
		const severityOk =
			f?.kind === 'working' ? f?.severity === 'positive' : ['urgent', 'moderate'].includes(f?.severity);
		if (!severityOk) {
			dropped.push({ finding: f, reason: `severity "${f?.severity}" does not match kind "${f?.kind}"` });
			continue;
		}

		// The label is visible while locked, so it must stand on its own and must not
		// smuggle in an unverifiable figure.
		const label = String(f?.label ?? '').trim();
		if (!label) {
			dropped.push({ finding: f, reason: 'empty label' });
			continue;
		}
		const labelNumbers = label.match(/\d+(?:\.\d+)?/g) || [];
		const invented = labelNumbers.find((n) => !payloadNumbers.has(n));
		if (invented) {
			dropped.push({ finding: f, reason: `label contains ungrounded number "${invented}"` });
			continue;
		}

		const ev = norm(f?.evidence);
		if (!ev) {
			dropped.push({ finding: f, reason: 'empty evidence' });
			continue;
		}

		let ok = false;
		switch (f.evidence_source) {
			case 'review':
				ok = reviewTexts.some((t) => t && t.includes(ev));
				break;
			case 'rating':
			case 'review_count':
				// Accept the bare figure, or any phrase containing it.
				ok = numericFacts.some((n) => ev.includes(n));
				break;
			case 'hours':
				ok = hoursText.some((t) => t.includes(ev) || ev.includes(t));
				break;
			case 'website':
				ok = Boolean(payload.website) && norm(payload.website).includes(ev.replace(/^https?:\/\//, ''));
				break;
			case 'description':
				ok = Boolean(payload.description) && norm(payload.description).includes(ev);
				break;
			case 'price_level':
				ok = payload.price_level != null && norm(payload.price_level).includes(ev);
				break;
			default:
				ok = false;
		}

		if (ok) kept.push(f);
		else dropped.push({ finding: f, reason: `evidence not found in ${f.evidence_source}` });
	}

	return { kept, dropped };
}

// ---------------------------------------------------------------------------
// Teaser policy — the SERVER decides what is unlocked, per item.
//
// The client renders purely from the `teaser_visible` flag on each item and never
// re-derives the rule. That means this file is the only place the free/paid line is
// drawn, and changing it needs no client change.
//
// For a locked item the hidden text is REMOVED from the response rather than merely
// hidden in CSS, so it is not sitting in the DOM waiting to be read out of devtools.
// What survives on a locked row is exactly what the visitor is allowed to see: the
// category, the severity, and the short factual label.
//
// Honest limitation: `signedUp` is asserted by the client (the existing signup gate
// is a localStorage flag), so this is a product gate, not an authorization boundary.
// It is exactly as strong as the download gate that already ships.
// ---------------------------------------------------------------------------

/** How much the free teaser gives away. */
export const TEASER_POLICY = {
	/** Sub-scores shown in full, in order. */
	subScores: 1,
	/** Findings shown in full, per kind — so one "working" AND one "quick_win". */
	findingsPerKind: 1
};

/** Strip everything a locked finding must not carry to the browser. */
function redactFinding(f) {
	return {
		kind: f.kind,
		severity: f.severity,
		label: f.label,
		teaser_visible: false
	};
}

/**
 * Stamp `teaser_visible` on every finding and sub-score, redacting what is locked.
 *
 * @param {Array<object>} findings verified findings, in model order
 * @param {Array<object>} subScores sub-scores the client computed
 * @param {boolean} signedUp client-asserted signup state
 */
export function applyTeaserPolicy(findings, subScores, signedUp) {
	if (signedUp) {
		return {
			findings: findings.map((f) => ({ ...f, teaser_visible: true })),
			sub_scores: subScores.map((sc) => ({ ...sc, teaser_visible: true }))
		};
	}

	// Findings: the first of each kind is free, the rest are labels only.
	const shownPerKind = {};
	const stampedFindings = findings.map((f) => {
		const seen = shownPerKind[f.kind] ?? 0;
		if (seen < TEASER_POLICY.findingsPerKind) {
			shownPerKind[f.kind] = seen + 1;
			return { ...f, teaser_visible: true };
		}
		return redactFinding(f);
	});

	// Sub-scores: the first N that actually HAVE a value are free. A dimension Google
	// gave us no data for is not spent as one of the free slots — locking a "—" would
	// tease something that does not exist.
	let freeLeft = TEASER_POLICY.subScores;
	const stampedSubScores = subScores.map((sc) => {
		if (sc?.value === null || sc?.value === undefined) {
			return { ...sc, teaser_visible: true }; // nothing to hide
		}
		if (freeLeft > 0) {
			freeLeft -= 1;
			return { ...sc, teaser_visible: true };
		}
		// Locked: keep key/label so the row can name itself, drop the number.
		return { key: sc.key, label: sc.label, value: null, basis: '', teaser_visible: false };
	});

	return { findings: stampedFindings, sub_scores: stampedSubScores };
}

/**
 * Generate verified findings for one restaurant.
 * @param {object} place normalized provider output
 * @returns {Promise<{ findings: Array<object>, droppedCount: number }>}
 */
export async function generateFindings(place) {
	const payload = buildPayload(place);
	if (!payload.name) throw httpErr(400, 'No restaurant data to analyse');

	// GEMINI_API_KEY is what the Cloud Function's bound secret provides; GOOGLE_API_KEY
	// is accepted too because that is what Google's own docs export. Resolved here
	// rather than left to the SDK so a missing key fails as a clear 503 below instead
	// of an opaque transport error.
	const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
	if (!apiKey) throw httpErr(503, 'Findings are not configured: GEMINI_API_KEY is not set');

	const ai = new GoogleGenAI({ apiKey });

	let response;
	try {
		response = await ai.models.generateContent({
			model: MODEL,
			contents: `Here is everything Google returned for this restaurant:

${JSON.stringify(payload, null, 2)}`,
			config: {
				systemInstruction: SYSTEM_PROMPT,
				maxOutputTokens: MAX_TOKENS,
				// Deterministic-ish: this is extraction from a fixed payload, not writing.
				temperature: 0.2,
				// Constrain the output to the schema. responseJsonSchema (not responseSchema)
				// takes real JSON Schema, which lets RESPONSE_JSON_SCHEMA be derived from the
				// same zod object we validate against — one source of truth, no drift.
				responseMimeType: 'application/json',
				responseJsonSchema: RESPONSE_JSON_SCHEMA,
				// Short extraction under a latency budget, not deep reasoning.
				thinkingConfig: { thinkingLevel: 'low' }
			}
		});
	} catch (exc) {
		// ApiError carries the HTTP status; anything else never reached Google.
		if (exc instanceof ApiError) {
			if (exc.status === 429) throw httpErr(429, 'Findings are busy — try again shortly');
			if (exc.status === 401 || exc.status === 403) throw httpErr(503, 'Findings are misconfigured');
			throw httpErr(502, `Findings failed: ${exc.message}`);
		}
		throw httpErr(503, `Findings are not configured: ${exc}`);
	}

	// A safety block leaves no usable output — treat as "no findings", not a crash.
	// Checked on both the prompt and the candidate: either can be filtered.
	const blocked =
		response?.promptFeedback?.blockReason ||
		['SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII'].includes(
			response?.candidates?.[0]?.finishReason
		);
	if (blocked) return { findings: [], droppedCount: 0 };

	// The schema constrains generation but does not guarantee it, so the response is
	// re-validated here. Malformed JSON or a shape zod rejects yields NO findings
	// rather than a crash — the teaser degrades, it does not break.
	let raw = [];
	try {
		const parsed = FindingsSchema.parse(JSON.parse(response.text ?? ''));
		raw = parsed.findings;
	} catch {
		return { findings: [], droppedCount: 0 };
	}

	const { kept, dropped } = verifyFindings(raw, payload);

	return { findings: kept, droppedCount: dropped.length };
}

/**
 * Framework-neutral handler shared by the dev middleware and the Cloud Function.
 * @param {unknown} body parsed JSON request body — { place }
 */
export async function handleFindingsRequest(body) {
	const input = /** @type {any} */ (body) || {};
	const place = input.place;
	if (!place || typeof place !== 'object') {
		return { status: 400, body: { error: 'Missing "place" in request body' } };
	}

	const subScores = Array.isArray(input.sub_scores) ? input.sub_scores : [];
	const signedUp = input.signed_up === true;

	try {
		const { findings, droppedCount } = await generateFindings(place);
		const stamped = applyTeaserPolicy(findings, subScores, signedUp);
		return {
			status: 200,
			body: {
				findings: stamped.findings,
				sub_scores: stamped.sub_scores,
				// How many findings exist in total, so the client can say "3 more" without
				// having to count redacted rows itself.
				total_findings: findings.length,
				dropped: droppedCount
			}
		};
	} catch (exc) {
		const status = /** @type {any} */ (exc)?.status ?? 502;
		// Even when findings fail, the sub-scores still need their flags — the score
		// breakdown must not be left un-renderable by an unrelated outage.
		const fallback = applyTeaserPolicy([], subScores, signedUp);
		return {
			status,
			body: { error: /** @type {Error} */ (exc).message, sub_scores: fallback.sub_scores }
		};
	}
}
