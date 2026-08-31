<script>
	import { onMount } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import {
		Search,
		Star,
		MessageSquare,
		Clock,
		Activity,
		Wrench,
		Sparkles,
		AlertTriangle,
		ArrowRight,
		Download,
		Loader2,
		X,
		Building2,
		User,
		Mail,
		Phone,
		MapPin,
		Link2,
		Lock,
		CheckCircle2,
		Quote
	} from 'lucide-svelte';
	import { runAudit as runAuditRequest, resolveAuditTarget, unlockAudit } from '@/audit/index.js';
	import { track } from '@/analytics.js';
	import { isMapsLink, MAPS_LINK_MAX } from '@/audit/mapsLink.js';
	import { rankRows } from '@/audit/competitors.js';
	import { FRESHNESS_HORIZON_DAYS } from '@/audit/subscores.js';
	import { saveLead } from '@/leads.js';
	import { scrollToEl } from '@/lenis.js';
	import { formatLocaleNumber, formatMoney, isIndiaRoute } from '@/siteVariant.js';

	// Kept in sync with the backend heuristics (audit.js).
	const BENCHMARK_RATING = 4.7;
	const VISIBILITY_REVIEW_FLOOR = 150;
	const INDIA = isIndiaRoute();
	const LOCALE = INDIA ? 'en-IN' : 'en-US';

	// The four waves runAudit emits, in order. These are REAL progress: each one is
	// marked done when its stage event actually lands, never on a timer.
	const WAVES = [
		{ key: 'place', emoji: '\u{1F50D}', label: 'Finding your restaurant' },
		{ key: 'scores', emoji: '\u{1F4CA}', label: 'Scoring your listing' },
		{ key: 'competitors', emoji: '\u{1F4CD}', label: 'Sizing up your neighbourhood' },
		{ key: 'findings', emoji: '\u{1F4D6}', label: 'Reading your reviews' }
	];

	const EXAMPLES = INDIA
		? [
				{ name: 'Indian Accent', city: 'New Delhi', label: 'Indian Accent · New Delhi' },
				{ name: 'Toit', city: 'Bengaluru', label: 'Toit · Bengaluru' },
				{ name: 'Bastian', city: 'Mumbai', label: 'Bastian · Mumbai' }
			]
		: [
				{ name: "Katz's Delicatessen", city: 'New York', label: "Katz's Delicatessen · New York" },
				{ name: 'Franklin Barbecue', city: 'Austin', label: 'Franklin Barbecue · Austin' },
				{ name: 'Pike Place Chowder', city: 'Seattle', label: 'Pike Place Chowder · Seattle' }
			];

	// Findings carry BOTH kind ('working' | 'quick_win') and severity, and the severity
	// is what drives the icon and colour. The icon stays visible when a row is locked —
	// a locked row should still tell you how much it matters.
	const SEVERITY_STYLES = {
		urgent: {
			Icon: AlertTriangle,
			label: 'URGENT',
			color: '#F87171',
			bg: 'rgba(220,38,38,0.10)',
			bd: 'rgba(220,38,38,0.35)'
		},
		moderate: {
			Icon: Wrench,
			label: 'QUICK WIN',
			color: '#FF6B2B',
			bg: 'rgba(232,80,10,0.12)',
			bd: 'rgba(232,80,10,0.40)'
		},
		positive: {
			Icon: CheckCircle2,
			label: "WHAT'S WORKING",
			color: '#22C55E',
			bg: 'rgba(22,163,74,0.10)',
			bd: 'rgba(22,163,74,0.30)'
		}
	};

	// Fall back on kind if a severity ever arrives unrecognised, so a row never renders
	// without an icon.
	const findingStyle = (f) =>
		SEVERITY_STYLES[f?.severity] ||
		(f?.kind === 'working' ? SEVERITY_STYLES.positive : SEVERITY_STYLES.moderate);

	// Missing flag => locked. The server is the authority; an item whose flag has not
	// arrived yet (or was stripped) fails closed rather than leaking.
	const isUnlocked = (item) => item?.teaser_visible === true;

	// ---------- Turn each stage event into what the report UI renders ----------
	// Split by wave: the head renders from Places data alone, the numbers arrive a
	// tick later, and the findings seconds after that. Nothing here invents a value —
	// a missing field renders as — rather than a guess.

	function buildHead(place) {
		return {
			name: place.name || 'Your restaurant',
			location: place.address || 'From public info only',
			photoUrl: place.photo_url || null,
			website: place.website || null,
			dataSource: place.data_source || 'estimated',
			reviews: Array.isArray(place.top_reviews) ? place.top_reviews : []
		};
	}

	function buildKpis(place) {
		const rating = typeof place.rating === 'number' ? place.rating : null;
		const reviewCount = typeof place.review_count === 'number' ? place.review_count : null;
		const openNow = place.opening_hours?.open_now;
		return [
			{ label: 'Rating', value: rating != null ? rating.toFixed(1) : '—', suffix: rating != null ? '★' : '', icon: Star },
			{ label: 'Reviews', value: reviewCount != null ? reviewCount.toLocaleString(LOCALE) : '—', icon: MessageSquare },
			{ label: 'Open now', value: openNow === true ? 'Open' : openNow === false ? 'Closed' : '—', icon: Clock },
			{ label: 'Photos', value: place.photo_count != null ? String(place.photo_count) : '—', icon: Sparkles }
		];
	}


	// ---------- Component state ----------
	// Two entry paths, one CTA: "restaurant name (+ optional city)" OR a Google Maps
	// link. Either alone is enough to submit. When BOTH are filled the link wins —
	// it points at one specific place, where a typed name is only a guess.
	const AUDIT_LIMITS = {
		name: { min: 2, max: 100 },
		city: { min: 2, max: 60 },
		mapsLink: { max: MAPS_LINK_MAX }
	};

	let form = $state({ name: '', city: '', mapsLink: '' });
	let auditErrors = $state({ name: '', city: '', mapsLink: '' });

	let state = $state('idle'); // idle | loading | disambiguate | notfound | report | error
	// Candidate places awaiting a choice. Plain JSON (see resolvePlace.js) — the live
	// provider objects stay out of $state so they are never deep-proxied.
	let candidates = $state([]);
	let report = $state(null);
	// The provider's raw place object, kept so we can re-request the redacted detail
	// after signup without re-running the Places lookup.
	let rawPlace = $state(null);
	// Which waves have actually landed. Drives both the progress list and which parts
	// of the teaser are rendered vs still skeletons — no timers involved.
	let landed = $state({ place: false, scores: false, competitors: false, findings: false });
	let findingsError = $state('');
	let error = $state('');
	let pdfState = $state('idle'); // idle | working
	let pdfMsg = $state(''); // user-visible download result / error
	let showSignup = $state(false);
	let signedUp = $state(false);
	let signup = $state({ businessName: '', personName: '', email: '', phone: '' });
	let signupState = $state('idle'); // idle | submitting
	let signupError = $state(''); // submit-level failure (network / Firestore)
	let fieldErrors = $state({ businessName: '', personName: '', email: '', phone: '' });

	let timeouts = [];
	const clearTimers = () => {
		timeouts.forEach(clearTimeout);
		timeouts = [];
	};

	// The download result strip auto-hides after 5s. Kept on its own timer (not in
	// `timeouts`) so clearTimers() — which belongs to the loading steps — can't
	// leave a stale message pinned on screen.
	const PDF_MSG_TTL = 5000;
	let pdfMsgTimer = null;
	function setPdfMsg(msg) {
		clearTimeout(pdfMsgTimer);
		pdfMsgTimer = null;
		pdfMsg = msg;
		if (msg) pdfMsgTimer = setTimeout(() => (pdfMsg = ''), PDF_MSG_TTL);
	}

	// One-time signup gate — remembered ACROSS browser sessions via localStorage.
	// Once a user has signed up (any restaurant, any time), the form never shows
	// again on this device; downloads go straight through. `signup` fields are also
	// restored so the (now-hidden) form stays prefilled.
	const SIGNUP_KEY = 'jhax_audit_signup';

	function persistSignup(details) {
		try {
			localStorage.setItem(SIGNUP_KEY, JSON.stringify({ signedUp: true, ...details }));
		} catch {
			/* storage disabled / private mode — non-fatal */
		}
	}

	onMount(() => {
		try {
			const saved = JSON.parse(localStorage.getItem(SIGNUP_KEY) || 'null');
			if (saved?.signedUp) {
				signedUp = true;
				signup.businessName = saved.businessName || '';
				signup.personName = saved.personName || '';
				signup.email = saved.email || '';
				signup.phone = saved.phone || '';
			}
		} catch {
			/* ignore malformed/blocked storage */
		}
		return () => {
			clearTimers();
			clearTimeout(pdfMsgTimer);
		};
	});

	// ---------- Search form validation ----------
	// Rules: name 2–100 chars, city optional but 2–60 when filled, Maps link must be
	// maps.app.goo.gl/* or google.com/maps/*. Every failure renders inline beside the
	// field it belongs to — never a toast, never an alert().

	/** Which path a submit would take. The link wins the moment it has any content. */
	const activePath = () => (form.mapsLink.trim() ? 'link' : 'name');

	/** @returns {string} error message, or '' when the field is valid */
	function validateAuditField(key, raw) {
		const value = (raw ?? '').trim();

		if (key === 'mapsLink') {
			if (!value) return ''; // the name path is in use
			if (value.length > AUDIT_LIMITS.mapsLink.max) return 'That link is too long to be a Maps link.';
			if (!isMapsLink(value)) {
				return 'That does not look like a Maps link — it should start with maps.app.goo.gl/ or google.com/maps/.';
			}
			return '';
		}

		// A link outranks these two, so they must never block a submit while one is set.
		if (activePath() === 'link') return '';

		if (key === 'name') {
			const { min, max } = AUDIT_LIMITS.name;
			if (!value) return 'Enter your restaurant name, or paste your Google Maps link below.';
			if (value.length < min) return `Restaurant name must be at least ${min} characters.`;
			if (value.length > max) return `Restaurant name must be ${max} characters or less.`;
			return '';
		}

		if (key === 'city') {
			if (!value) return ''; // optional — the name alone is a valid search
			const { min, max } = AUDIT_LIMITS.city;
			if (value.length < min) return `City must be at least ${min} characters.`;
			if (value.length > max) return `City must be ${max} characters or less.`;
			return '';
		}

		return '';
	}

	function validateAuditForm() {
		const next = {
			name: validateAuditField('name', form.name),
			city: validateAuditField('city', form.city),
			mapsLink: validateAuditField('mapsLink', form.mapsLink)
		};
		auditErrors = next;
		return Object.values(next).every((m) => !m);
	}

	// Live-clear a field's error once it is corrected, so the message goes away as the
	// user types rather than surviving until the next submit.
	function onAuditInput(key, value) {
		form[key] = value;
		if (auditErrors[key] && !validateAuditField(key, value)) auditErrors[key] = '';
		// Typing a link switches paths — stale name/city errors no longer apply.
		if (key === 'mapsLink' && value.trim()) {
			auditErrors.name = '';
			auditErrors.city = '';
		}
	}

	// ---------- Resolution, then audit ----------
	// Two deliberately separate steps. Step one works out WHICH restaurant this is and
	// is allowed to stop and ask; step two audits the one that was chosen. Nothing
	// picks a restaurant on the user's behalf unless the match is unambiguous.

	/** What the last submit was about — drives the wording of every failure state. */
	let lastQuery = $state({ viaLink: false, rawInput: '' });

	/** Wipe every trace of a previous run so nothing bleeds across searches. */
	function resetRunState() {
		clearTimers();
		error = '';
		findingsError = '';
		report = null;
		rawPlace = null;
		landed = { place: false, scores: false, competitors: false, findings: false };
		// A fresh search starts clean — the previous report's download message must
		// never carry over onto a different restaurant.
		setPdfMsg('');
	}

	/**
	 * Map a thrown lookup failure onto the copy the visitor sees.
	 *
	 * Note 404 is nearly unreachable now: "Google answered, and matched nothing" is a
	 * resolution RESULT that gets its own not-found screen, not an exception. This
	 * still handles it for the legacy path and for a Maps link that names no place.
	 */
	function describeFailure(err) {
		const status = err?.status;
		const viaLink = lastQuery.viaLink;
		if (status === 503) {
			// Two different switches: the Places API key, and the deployed link resolver.
			return viaLink
				? "Maps links aren't switched on yet — type the restaurant name and city instead."
				: "Live lookups aren't switched on yet — this needs a Google Places API key.";
		}
		if (status === 400) return 'Type a restaurant name to run the audit.';
		// The provider itself refused — e.g. the OSM source, which has no ratings.
		if (status === 502) return err?.message || 'That lookup failed. Give it another try in a moment.';
		if (status === 404) {
			return viaLink
				? "We couldn't read a restaurant out of that Google Maps link. Try the name and city instead."
				: "We couldn't find that restaurant on Google Maps.";
		}
		return viaLink
			? 'Something went wrong reading that Maps link. Give it another try in a moment.'
			: 'Something went wrong looking that up. Give it another try in a moment.';
	}

	/** Step one: resolve the query to one place, several, or none. */
	async function startAudit({ name = '', city = '', mapsLink = '' }) {
		resetRunState();
		candidates = [];
		lastQuery = { viaLink: Boolean(mapsLink.trim()), rawInput: '' };
		state = 'loading';

		let resolution;
		try {
			resolution = await resolveAuditTarget({ name, city, mapsLink });
		} catch (err) {
			clearTimers();
			error = describeFailure(err);
			state = 'error';
			return;
		}

		lastQuery = { viaLink: resolution.viaLink, rawInput: resolution.rawInput };

		if (resolution.status === 'not_found') {
			track('place_resolution_failed', {
				raw_input: resolution.rawInput,
				input_mode: resolution.viaLink ? 'maps_link' : 'name_city'
			});
			state = 'notfound';
			return;
		}

		if (resolution.status === 'disambiguate') {
			candidates = resolution.candidates;
			track('place_disambiguation_shown', { candidate_count: candidates.length });
			state = 'disambiguate';
			return;
		}

		await executeAudit(resolution.candidate);
	}

	/** Step two: audit the place that was chosen (confidently, or by tapping a card). */
	async function executeAudit(candidate) {
		resetRunState();
		state = 'loading';

		try {
			await runAuditRequest({ candidate, signedUp }, (event) => {
				if (event.stage === 'place') {
					rawPlace = event.place;
					report = { ...buildHead(event.place), kpis: buildKpis(event.place), subScores: [], findings: [] };
					landed.place = true;
					state = 'report';
				} else if (event.stage === 'scores') {
					const est = event.estimated || {};
					report = {
						...report,
						healthScore: est.health_score ?? 0,
						healthLabel: est.health_label || '',
						moneyLost: est.money_lost_weekly ?? 0,
						basis: est.basis || '',
						subScores: event.sub_scores || []
					};
					landed.scores = true;
				} else if (event.stage === 'competitors') {
					// A refused ranking is simply absent — never a half-drawn panel or a
					// rank of zero. The wave still counts as landed so the progress list
					// does not stall on a neighbourhood we could not read.
					const ranking = event.ranking?.ok ? event.ranking : null;
					report = { ...report, competitors: ranking };
					if (ranking) {
						track('audit_local_rank_shown', { rank: ranking.rank, total: ranking.total });
					}
					landed.competitors = true;
				} else if (event.stage === 'findings') {
					report = {
						...report,
						findings: event.findings || [],
						// Flags for the breakdown arrive with this wave; keep the values we
						// already painted if the server sent none. Testing `.length` and not
						// just truthiness matters: a findings outage answers with an EMPTY
						// array, and `[] || x` is `[]` — which would blank the whole
						// breakdown and, with it, the Unlock button that counts locked rows.
						subScores: event.sub_scores?.length ? event.sub_scores : report.subScores,
						totalFindings: event.total_findings || (event.findings || []).length
					};
					if (event.error) findingsError = event.error.message || 'Findings unavailable';
					landed.findings = true;
				}
			});
		} catch (err) {
			clearTimers();
			error = describeFailure(err);
			state = 'error';
		}
	}

	/** Tapping a card IS the selection — there is no separate confirm step. */
	function chooseCandidate(candidate) {
		if (state === 'loading') return;
		executeAudit(candidate);
	}

	/**
	 * Retry from the not-found screen. Deliberately KEEPS what was typed: a failed
	 * lookup is usually a typo, and clearing the field would make the user retype it.
	 */
	function retryResolution() {
		resetRunState();
		candidates = [];
		state = 'idle';
		if (typeof window !== 'undefined') {
			requestAnimationFrame(() => document.getElementById('audit-name')?.focus());
		}
	}

	/** Not-found's second option: send them to the Maps-link path with the field focused. */
	function suggestMapsLink() {
		resetRunState();
		candidates = [];
		state = 'idle';
		if (typeof window !== 'undefined') {
			requestAnimationFrame(() => {
				const el = /** @type {HTMLInputElement | null} */ (document.getElementById('audit-maps-link'));
				el?.focus();
				el?.scrollIntoView({ block: 'center' });
			});
		}
	}

	function submit(e) {
		e?.preventDefault?.();
		if (state === 'loading') return;
		// The button stays enabled on empty/invalid input on purpose — clicking it is
		// what surfaces the inline errors.
		if (!validateAuditForm()) return;

		const mapsLink = form.mapsLink.trim();
		if (mapsLink) startAudit({ mapsLink });
		else startAudit({ name: form.name.trim(), city: form.city.trim() });
	}

	// Examples FILL the fields rather than submitting, so a first-time visitor sees
	// how the two paths work before anything runs.
	function useExample(ex) {
		form.name = ex.name;
		form.city = ex.city;
		form.mapsLink = '';
		auditErrors = { name: '', city: '', mapsLink: '' };
	}

	function reset() {
		clearTimers();
		state = 'idle';
		report = null;
		candidates = [];
		landed = { place: false, scores: false, competitors: false, findings: false };
		error = '';
		findingsError = '';
		form = { name: '', city: '', mapsLink: '' };
		auditErrors = { name: '', city: '', mapsLink: '' };
		setPdfMsg('');
		// Scroll back UP to the audit search section. Must go through Lenis — native
		// scrollIntoView is overridden by Lenis's RAF loop (worked neither on phone
		// nor desktop before). rAF lets the report unmount first so the target is right.
		if (typeof window !== 'undefined') {
			requestAnimationFrame(() => scrollToEl('audit', -80));
		}
	}

	const slugify = (s) =>
		(s || 'restaurant')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'restaurant';

	/**
	 * Export the report as a PDF.
	 *
	 * Draws a real vector document (src/lib/pdf/auditReport.js) rather than
	 * photographing the DOM: sharp at any zoom, selectable, searchable, and roughly a
	 * tenth of the size the rasterised version was. The renderer is imported lazily so
	 * jsPDF only reaches visitors who actually download something.
	 */
	async function downloadPdf() {
		if (!report || pdfState === 'working') return;
		pdfState = 'working';
		setPdfMsg('');
		try {
			const { buildAuditPdf } = await import('@/pdf/auditReport.js');
			const doc = buildAuditPdf(report, {
				generatedOn: new Date().toLocaleDateString(LOCALE, {
					year: 'numeric',
					month: 'long',
					day: 'numeric'
				}),
				// Value only — the renderer writes the "per week" itself.
				money: formatMoney(report.moneyLost || 0),
				formatNumber: (n) => formatLocaleNumber(n)
			});
			doc.save(`${slugify(report.name)}-jhax-audit-report.pdf`);
			setPdfMsg('Report downloaded to this device — check your downloads folder.');
		} catch (err) {
			// eslint-disable-next-line no-console
			console.error('PDF export failed', err);
			setPdfMsg("Couldn't generate the report — please try again.");
		} finally {
			pdfState = 'idle';
		}
	}

	function handleDownloadClick() {
		if (signedUp) {
			downloadPdf();
			return;
		}
		signupError = '';
		fieldErrors = { businessName: '', personName: '', email: '', phone: '' };
		showSignup = true;
	}

	const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

	// ---------- Signup form validation ----------
	// Rules: business name 2–100 chars, your name 2–50 chars, valid email,
	// phone exactly 10 digits (optional — blank is allowed, partial is not).
	const SIGNUP_LIMITS = {
		businessName: { min: 2, max: 100 },
		personName: { min: 2, max: 50 },
		email: { max: 254 },
		phone: { digits: 10 }
	};

	const digitsOnly = (v) => (v || '').replace(/\D/g, '');

	/** @returns {string} error message, or '' when the field is valid */
	function validateField(key, raw) {
		const value = (raw ?? '').trim();

		if (key === 'businessName') {
			const { min, max } = SIGNUP_LIMITS.businessName;
			if (!value) return 'Business name is required.';
			if (value.length < min) return `Business name must be at least ${min} characters.`;
			if (value.length > max) return `Business name must be ${max} characters or less.`;
			return '';
		}

		if (key === 'personName') {
			const { min, max } = SIGNUP_LIMITS.personName;
			if (!value) return 'Your name is required.';
			if (value.length < min) return `Your name must be at least ${min} characters.`;
			if (value.length > max) return `Your name must be ${max} characters or less.`;
			return '';
		}

		if (key === 'email') {
			if (!value) return 'Email is required.';
			if (value.length > SIGNUP_LIMITS.email.max) return 'That email address is too long.';
			if (!validEmail(value)) return 'Please enter a valid email address (e.g. you@restaurant.com).';
			return '';
		}

		if (key === 'phone') {
			if (!value) return ''; // optional
			const digits = digitsOnly(value);
			if (digits.length !== SIGNUP_LIMITS.phone.digits || digits !== value) {
				return `Phone must be exactly ${SIGNUP_LIMITS.phone.digits} digits.`;
			}
			return '';
		}

		return '';
	}

	function validateSignup() {
		const next = {
			businessName: validateField('businessName', signup.businessName),
			personName: validateField('personName', signup.personName),
			email: validateField('email', signup.email),
			phone: validateField('phone', signup.phone)
		};
		fieldErrors = next;
		return Object.values(next).every((m) => !m);
	}

	// Live-clear a field's error once the user has corrected it, so the message
	// disappears as they type instead of only on the next submit.
	function onSignupInput(key, raw) {
		const value = key === 'phone' ? digitsOnly(raw).slice(0, SIGNUP_LIMITS.phone.digits) : raw;
		signup[key] = value;
		if (fieldErrors[key] && !validateField(key, value)) fieldErrors[key] = '';
		signupError = '';
	}

	/**
	 * Pull down the detail that was withheld while locked, so the report on screen —
	 * and the PDF built from it — is complete. Best-effort: if it fails the user still
	 * gets their download, just without the previously locked rows expanded.
	 */
	async function unlockFullReport() {
		if (!rawPlace || !report) return;
		try {
			// No sub-scores passed: unlockAudit rebuilds them from the place. The copy
			// held here has had its locked values redacted away and cannot be restored.
			const res = await unlockAudit(rawPlace);
			report = {
				...report,
				findings: res.findings,
				subScores: res.subScores?.length ? res.subScores : report.subScores,
				totalFindings: res.totalFindings
			};
			findingsError = '';
		} catch (err) {
			// The download still proceeds — a findings outage must not block the PDF —
			// but it is no longer silent. Swallowing this left an empty findings panel
			// with nothing on screen to explain it, in the report AND the PDF.
			findingsError = err?.message || 'Findings unavailable';
		}
	}

	async function submitSignup(e) {
		e?.preventDefault?.();
		if (signupState === 'submitting') return;

		const businessName = signup.businessName.trim();
		const personName = signup.personName.trim();
		const email = signup.email.trim();
		const phone = signup.phone.trim();

		if (!validateSignup()) {
			signupError = '';
			return;
		}

		signupState = 'submitting';
		signupError = '';
		try {
			await saveLead({
				email,
				business_name: businessName,
				person_name: personName,
				phone: phone || null,
				source: 'audit_report_download'
			});
			signedUp = true;
			persistSignup({ businessName, personName, email, phone });
			// Locked detail was never sent to the browser — fetch it before building the
			// PDF, or the report would print rows with no title or body.
			await unlockFullReport();
			showSignup = false;
			signupState = 'idle';
			downloadPdf();
		} catch (err) {
			// eslint-disable-next-line no-console
			console.error('[leads] Firestore write failed:', err?.code || '', err?.message || err);
			signupState = 'idle';
			signupError = 'Something went wrong. Please try again.';
		}
	}

	let totalImpact = $derived(report ? report.moneyLost : 0);

	// Counts come from the server's flags, never from a hardcoded rule, so the copy and
	// the rendering can never disagree about what is locked.
	let lockedSubScores = $derived((report?.subScores || []).filter((sc) => !isUnlocked(sc)).length);
	let lockedFindings = $derived((report?.findings || []).filter((f) => !isUnlocked(f)).length);

	const signupFields = [
		{ key: 'businessName', label: 'Business name', placeholder: 'e.g. The Corner Bistro', Icon: Building2, type: 'text', testid: 'signup-business', maxlength: SIGNUP_LIMITS.businessName.max, autocomplete: 'organization' },
		{ key: 'personName', label: 'Your name', placeholder: 'e.g. Maria Lopez', Icon: User, type: 'text', testid: 'signup-name', maxlength: SIGNUP_LIMITS.personName.max, autocomplete: 'name' },
		{ key: 'email', label: 'Email', placeholder: 'you@restaurant.com', Icon: Mail, type: 'email', testid: 'signup-email', maxlength: SIGNUP_LIMITS.email.max, autocomplete: 'email' },
		{ key: 'phone', label: 'Phone (optional)', placeholder: '5551234567', Icon: Phone, type: 'tel', testid: 'signup-phone', maxlength: SIGNUP_LIMITS.phone.digits, inputmode: 'numeric', autocomplete: 'tel' }
	];

	const exSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
	const kpiSlug = (label) => label.toLowerCase().replace(/\s+/g, '-');
</script>

<section id="audit" data-testid="free-audit-section" class="relative py-24 md:py-32">
	<div
		aria-hidden="true"
		class="absolute left-1/2 -translate-x-1/2 -top-10 w-[900px] h-[420px] blur-3xl opacity-40 pointer-events-none"
		style="background: radial-gradient(closest-side, rgba(232,80,10,0.22), transparent);"
	></div>

	<div class="relative max-w-[1180px] mx-auto px-6 md:px-10">
		<!-- Header -->
		<div class="text-center">
			<div
				class="inline-flex items-center gap-2 rounded-full font-mono uppercase tracking-[0.18em]"
				style="background: rgba(232,80,10,0.08); border: 1px solid rgba(232,80,10,0.28); color: #FF6B2B; padding: 6px 14px; font-size: 10.5px;"
			>
				Free Restaurant Audit
			</div>
			<h2
				class="font-display text-cream mt-5 mx-auto"
				style="font-size: clamp(30px, 5vw, 60px); letter-spacing: -0.035em; line-height: 1.02; max-width: 900px;"
			>
				Find out what your restaurant is losing — <span class="text-orange">for free</span>.
			</h2>
			<p
				class="mt-5 mx-auto text-muted-warm"
				style="max-width: 620px; font-size: 16px; line-height: 1.55; font-weight: 300;"
			>
				{#if INDIA}
					No sign-up. No credit card. Type your restaurant name — or paste your Google Maps
					link — and we&apos;ll show you exactly where revenue is slipping through the cracks.
				{:else}
					No sign-up. No credit card. Type your restaurant name — or paste your Google Maps
					link — and we&apos;ll show you exactly where money is slipping through the cracks.
				{/if}
			</p>
		</div>

		<!-- Search form — two entry paths, one CTA.
		     novalidate: we render our own inline errors; the browser's native validation
		     bubbles would otherwise fire first and hide them (type="url" especially). -->
		{#snippet fieldError(id, message)}
			{#if message}
				<div
					{id}
					data-testid={id}
					class="text-[11.5px] mt-1.5 ml-5 flex items-start gap-1.5 text-left"
					style="color: #F87171;"
				>
					<AlertTriangle size={11} class="flex-shrink-0 mt-[3px]" />
					<span>{message}</span>
				</div>
			{/if}
		{/snippet}

		<form onsubmit={submit} novalidate data-testid="audit-form" class="mt-9 mx-auto max-w-[720px]">
			<!-- Path 1 — restaurant name (required on this path) + city (optional) -->
			<div class="flex flex-col sm:flex-row gap-3">
				<div class="flex-1 min-w-0">
					<label class="sr-only" for="audit-name">Restaurant name</label>
					<div
						class="w-full flex items-center gap-2 rounded-full px-5"
						style="background: #0d0d0d; border: 1px solid {auditErrors.name
							? 'rgba(220,38,38,0.55)'
							: '#1E1E1E'}; height: 56px; transition: border-color .2s;"
					>
						<Search
							size={16}
							color={auditErrors.name ? '#F87171' : undefined}
							class="text-muted-warm flex-shrink-0"
						/>
						<input
							id="audit-name"
							type="text"
							value={form.name}
							oninput={(e) => onAuditInput('name', e.currentTarget.value)}
							onblur={() => (auditErrors.name = validateAuditField('name', form.name))}
							placeholder={INDIA ? 'Restaurant name (e.g. Toit)' : "Restaurant name (e.g. Joe's Pizza)"}
							maxlength={AUDIT_LIMITS.name.max}
							autocomplete="organization"
							aria-invalid={auditErrors.name ? 'true' : 'false'}
							aria-describedby={auditErrors.name ? 'audit-name-error' : undefined}
							data-testid="audit-input-name"
							class="flex-1 min-w-0 w-full bg-transparent outline-none text-cream placeholder:text-muted-warm"
							style="font-size: 15px; font-weight: 500;"
							disabled={state === 'loading'}
						/>
					</div>
					{@render fieldError('audit-name-error', auditErrors.name)}
				</div>

				<div class="w-full sm:w-[240px] flex-shrink-0">
					<label class="sr-only" for="audit-city">City (optional)</label>
					<div
						class="w-full flex items-center gap-2 rounded-full px-5"
						style="background: #0d0d0d; border: 1px solid {auditErrors.city
							? 'rgba(220,38,38,0.55)'
							: '#1E1E1E'}; height: 56px; transition: border-color .2s;"
					>
						<MapPin
							size={16}
							color={auditErrors.city ? '#F87171' : undefined}
							class="text-muted-warm flex-shrink-0"
						/>
						<input
							id="audit-city"
							type="text"
							value={form.city}
							oninput={(e) => onAuditInput('city', e.currentTarget.value)}
							onblur={() => (auditErrors.city = validateAuditField('city', form.city))}
							placeholder="City (optional)"
							maxlength={AUDIT_LIMITS.city.max}
							autocomplete="address-level2"
							aria-invalid={auditErrors.city ? 'true' : 'false'}
							aria-describedby={auditErrors.city ? 'audit-city-error' : undefined}
							data-testid="audit-input-city"
							class="flex-1 min-w-0 w-full bg-transparent outline-none text-cream placeholder:text-muted-warm"
							style="font-size: 15px; font-weight: 500;"
							disabled={state === 'loading'}
						/>
					</div>
					{@render fieldError('audit-city-error', auditErrors.city)}
				</div>
			</div>

			<!-- Either path alone is enough — say so out loud. -->
			<div class="flex items-center gap-3 my-4" aria-hidden="true">
				<span class="flex-1 h-px" style="background: #1E1E1E;"></span>
				<span class="font-mono uppercase tracking-[0.2em] text-ghost" style="font-size: 10px;">or</span>
				<span class="flex-1 h-px" style="background: #1E1E1E;"></span>
			</div>

			<!-- Path 2 — Google Maps link. Wins over name/city when both are filled. -->
			<div>
				<label class="sr-only" for="audit-maps-link">Google Maps link</label>
				<div
					class="w-full flex items-center gap-2 rounded-full px-5"
					style="background: #0d0d0d; border: 1px solid {auditErrors.mapsLink
						? 'rgba(220,38,38,0.55)'
						: '#1E1E1E'}; height: 56px; transition: border-color .2s;"
				>
					<Link2
						size={16}
						color={auditErrors.mapsLink ? '#F87171' : undefined}
						class="text-muted-warm flex-shrink-0"
					/>
					<input
						id="audit-maps-link"
						type="url"
						value={form.mapsLink}
						oninput={(e) => onAuditInput('mapsLink', e.currentTarget.value)}
						onblur={() => (auditErrors.mapsLink = validateAuditField('mapsLink', form.mapsLink))}
						placeholder="Paste your Google Maps link"
						maxlength={AUDIT_LIMITS.mapsLink.max}
						inputmode="url"
						spellcheck="false"
						aria-invalid={auditErrors.mapsLink ? 'true' : 'false'}
						aria-describedby={auditErrors.mapsLink
							? 'audit-maps-link-error'
							: form.mapsLink.trim()
								? 'audit-maps-link-hint'
								: undefined}
						data-testid="audit-input-maps-link"
						class="flex-1 min-w-0 w-full bg-transparent outline-none text-cream placeholder:text-muted-warm"
						style="font-size: 15px; font-weight: 500;"
						disabled={state === 'loading'}
					/>
				</div>
				{#if auditErrors.mapsLink}
					{@render fieldError('audit-maps-link-error', auditErrors.mapsLink)}
				{:else if form.mapsLink.trim()}
					<div
						id="audit-maps-link-hint"
						data-testid="audit-maps-link-hint"
						class="text-[11.5px] mt-1.5 ml-5 text-left text-ghost"
					>
						Using your Maps link — the name and city above are ignored.
					</div>
				{/if}
			</div>

			<!-- One primary CTA, whichever path the visitor used -->
			<button
				type="submit"
				disabled={state === 'loading'}
				data-testid="audit-submit"
				class="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-full px-7 font-semibold whitespace-nowrap"
				style="background: #E8500A; color: #fff; font-size: 15px; height: 56px; opacity: {state ===
				'loading'
					? 0.55
					: 1}; box-shadow: 0 20px 60px -20px rgba(232,80,10,0.6); transition: opacity .2s, transform .2s;"
			>
				{#if state === 'loading'}
					<Loader2 size={16} class="animate-spin" /> Working…
				{:else}
					Get my free score <ArrowRight size={14} />
				{/if}
			</button>
		</form>

		<!-- Example chips -->
		<div class="mt-5 flex flex-wrap justify-center gap-2" data-testid="audit-examples">
			<span class="font-mono uppercase tracking-[0.18em] text-ghost mr-1 self-center" style="font-size: 10px;">
				Or try:
			</span>
			{#each EXAMPLES as ex (ex.label)}
				<button
					type="button"
					onclick={() => useExample(ex)}
					disabled={state === 'loading'}
					data-testid="audit-example-{exSlug(ex.name)}"
					class="rounded-full transition-colors"
					style="background: #0d0d0d; border: 1px solid #1E1E1E; color: #6B6866; padding: 8px 14px; font-size: 12.5px;"
					onmouseenter={(e) => {
						if (state !== 'loading') {
							e.currentTarget.style.borderColor = 'rgba(232,80,10,0.4)';
							e.currentTarget.style.color = '#FF6B2B';
						}
					}}
					onmouseleave={(e) => {
						e.currentTarget.style.borderColor = '#1E1E1E';
						e.currentTarget.style.color = '#6B6866';
					}}
				>
					{ex.label}
				</button>
			{/each}
		</div>

		<!-- Progress panel — only up until the first wave lands. From then on the
		     report itself is on screen and fills in place. Each row ticks when its
		     stage event actually arrives, so this reflects real progress. -->
		{#if state === 'loading'}
			<div
				in:fly={{ y: 16, duration: 450, opacity: 0, easing: cubicOut }}
				out:fly={{ y: -8, duration: 450, opacity: 0, easing: cubicOut }}
				class="mt-10 mx-auto max-w-[720px] rounded-2xl p-6 md:p-7"
				style="background: #0d0d0d; border: 1px solid #1E1E1E;"
				data-testid="audit-loading"
			>
				<div class="font-mono text-[10px] uppercase tracking-[0.24em] text-orange mb-4">
					JHAX is looking at your restaurant…
				</div>
				<ul class="space-y-3">
					{#each WAVES as w, i (w.key)}
						{@const isDone = landed[w.key]}
						{@const isActive = !isDone && (i === 0 || landed[WAVES[i - 1].key])}
						<li
							class="flex items-center gap-3"
							data-testid="audit-step-{w.key}"
							style="opacity: {isDone || isActive ? 1 : 0.35}; transition: opacity .3s;"
						>
							<span
								class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
								style="background: {isActive
									? 'rgba(232,80,10,0.14)'
									: isDone
										? 'rgba(22,163,74,0.14)'
										: '#0f0f0f'}; border: 1px solid {isActive
									? 'rgba(232,80,10,0.4)'
									: isDone
										? 'rgba(22,163,74,0.35)'
										: '#1E1E1E'}; font-size: 15px;"
							>
								{#if isDone}
									<span style="color: #22C55E; font-size: 14px;">✓</span>
								{:else if isActive}
									<Loader2 size={14} class="animate-spin" color="#FF6B2B" />
								{:else}
									<span>{w.emoji}</span>
								{/if}
							</span>
							<span
								class="text-[14.5px]"
								style="color: {isActive ? '#F5F2ED' : isDone ? '#6B6866' : '#3a3835'}; font-weight: {isActive
									? 500
									: 400};"
							>
								{w.label}
							</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		<!-- Disambiguation panel — more than one plausible match, so the user picks.
		     Deliberately NOT pre-selected: an operations manager with four branches of
		     the same name must not have one chosen for them. -->
		{#if state === 'disambiguate'}
			<div
				in:fly={{ y: 16, duration: 450, opacity: 0, easing: cubicOut }}
				out:fly={{ y: -8, duration: 450, opacity: 0, easing: cubicOut }}
				class="mt-10 mx-auto max-w-[720px] rounded-2xl p-6 md:p-7"
				style="background: #0d0d0d; border: 1px solid rgba(232,80,10,0.28);"
				data-testid="audit-disambiguation"
			>
				<div class="font-mono text-[10px] uppercase tracking-[0.24em] text-orange mb-1">
					Which one is yours?
				</div>
				<div class="text-cream text-[15px] mb-5" style="font-weight: 500; line-height: 1.35;">
					We found {candidates.length} places matching that search. Pick the one you want audited.
				</div>

				<ul class="space-y-2.5">
					{#each candidates as c, i (c.id)}
						<li>
							<button
								type="button"
								onclick={() => chooseCandidate(c)}
								data-testid="audit-candidate"
								data-candidate-index={i}
								class="w-full text-left flex items-center gap-4 rounded-xl p-3 transition-colors"
								style="background: #0f0f0f; border: 1px solid #1E1E1E;"
								onmouseenter={(e) => (e.currentTarget.style.borderColor = 'rgba(232,80,10,0.45)')}
								onmouseleave={(e) => (e.currentTarget.style.borderColor = '#1E1E1E')}
							>
								<!-- Thumbnail. A place with no photo still gets a tile, so the
								     rows never jump around by one image's width. -->
								<span
									class="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center"
									style="background: #141414; border: 1px solid #1E1E1E;"
								>
									{#if c.photo_url}
										<img
											src={c.photo_url}
											alt=""
											loading="lazy"
											class="w-full h-full object-cover"
										/>
									{:else}
										<Building2 size={18} color="#3a3835" />
									{/if}
								</span>

								<span class="flex-1 min-w-0">
									<span class="block text-cream text-[15px] truncate" style="font-weight: 600;">
										{c.name}
									</span>
									<span class="flex items-start gap-1.5 mt-0.5 text-[12.5px] text-muted-warm">
										<MapPin size={12} class="flex-shrink-0 mt-[3px]" />
										<span class="truncate">{c.address || 'Address unavailable'}</span>
									</span>
									<!-- Rating renders only when Google has one; an unrated place
									     shows nothing rather than a zero that reads as terrible. -->
									{#if c.rating != null}
										<span class="flex items-center gap-1.5 mt-1">
											<Star size={12} color="#FF6B2B" fill="#FF6B2B" />
											<span class="text-[12.5px]" style="color: #FF6B2B; font-weight: 700;">
												{c.rating.toFixed(1)}
											</span>
											{#if c.review_count != null}
												<span class="text-[12px] text-ghost">
													{formatLocaleNumber(c.review_count)} reviews
												</span>
											{/if}
										</span>
									{:else}
										<span class="block text-[12px] text-ghost mt-1">No rating yet</span>
									{/if}
								</span>

								<ArrowRight size={16} color="#6B6866" class="flex-shrink-0" />
							</button>
						</li>
					{/each}
				</ul>

				<button
					type="button"
					onclick={retryResolution}
					data-testid="audit-disambiguation-back"
					class="mt-5 text-[13px] underline underline-offset-4"
					style="color: #6B6866;"
				>
					None of these — refine my search
				</button>
			</div>
		{/if}

		<!-- Not-found panel — Google answered and matched nothing. Distinct from the
		     error panel below, which is for lookups that never got an answer. -->
		{#if state === 'notfound'}
			<div
				in:fly={{ y: 16, duration: 450, opacity: 0, easing: cubicOut }}
				out:fly={{ y: -8, duration: 450, opacity: 0, easing: cubicOut }}
				class="mt-10 mx-auto max-w-[720px] rounded-2xl p-6 md:p-7 flex items-start gap-4"
				style="background: #0d0d0d; border: 1px solid #1E1E1E;"
				data-testid="audit-not-found"
			>
				<div
					class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
					style="background: #141414; border: 1px solid #1E1E1E;"
				>
					<Search size={18} color="#6B6866" />
				</div>
				<div class="flex-1 min-w-0">
					<div class="font-mono text-[10px] uppercase tracking-[0.24em] mb-1 text-muted-warm">
						No match on Google Maps
					</div>
					<div class="text-cream text-[15px]" style="font-weight: 500; line-height: 1.35;">
						{#if lastQuery.viaLink}
							That Maps link didn't match a place we can audit. Try the restaurant name and
							city instead.
						{:else}
							We couldn't find a restaurant matching that search. Check the spelling, or add
							the city.
						{/if}
					</div>

					<div class="flex flex-wrap items-center gap-3 mt-4">
						<button
							type="button"
							onclick={retryResolution}
							data-testid="audit-not-found-retry"
							class="inline-flex items-center gap-2 rounded-full text-[13px] font-semibold"
							style="background: #E8500A; color: #fff; padding: 10px 18px;"
						>
							Try again
						</button>

						<!-- The link path often succeeds where a name search can't: it names the
						     exact place. Pointless to offer when a link is what just failed. -->
						{#if !lastQuery.viaLink}
							<button
								type="button"
								onclick={suggestMapsLink}
								data-testid="audit-not-found-maps-link"
								class="inline-flex items-center gap-2 rounded-full text-[13px] font-semibold"
								style="background: transparent; color: #FF6B2B; border: 1px solid rgba(232,80,10,0.4); padding: 10px 18px;"
							>
								<Link2 size={14} />
								Paste your Maps link instead
							</button>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<!-- Error panel -->
		{#if state === 'error'}
			<div
				in:fly={{ y: 16, duration: 450, opacity: 0, easing: cubicOut }}
				out:fly={{ y: -8, duration: 450, opacity: 0, easing: cubicOut }}
				class="mt-10 mx-auto max-w-[720px] rounded-2xl p-6 md:p-7 flex items-start gap-4"
				style="background: #0d0d0d; border: 1px solid rgba(220,38,38,0.35);"
				data-testid="audit-error"
			>
				<div
					class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
					style="background: rgba(220,38,38,0.10); border: 1px solid rgba(220,38,38,0.35);"
				>
					<AlertTriangle size={18} color="#F87171" />
				</div>
				<div class="flex-1 min-w-0">
					<div class="font-mono text-[10px] uppercase tracking-[0.24em] mb-1" style="color: #F87171;">
						Restaurant not found
					</div>
					<div class="text-cream text-[15px]" style="font-weight: 500; line-height: 1.3;">{error}</div>
					<button
						type="button"
						onclick={reset}
						data-testid="audit-error-retry"
						class="mt-4 inline-flex items-center gap-2 rounded-full text-[13px] font-semibold"
						style="background: #E8500A; color: #fff; padding: 10px 18px;"
					>
						Try again
					</button>
				</div>
			</div>
		{/if}

		<!-- Report -->
		{#if state === 'report' && report}
			<div
				in:fly={{ y: 24, duration: 700, opacity: 0, easing: cubicOut }}
				class="mt-10 rounded-[22px] relative overflow-hidden"
				style="background: #0c0c0c; border: 1px solid rgba(232,80,10,0.28); box-shadow: 0 40px 120px -40px rgba(232,80,10,0.35);"
				data-testid="audit-report"
			>
				<div
					aria-hidden="true"
					class="absolute top-0 left-0 right-0 h-[3px]"
					style="background: linear-gradient(90deg, transparent, #E8500A 30%, #FF6B2B 60%, transparent);"
				></div>
				<div class="p-6 md:p-8">
					<!-- Head — stacks vertically on mobile so labels never overlap and the
					     name has full width to wrap normally at word boundaries. -->
					<div
						class="flex flex-col sm:flex-row sm:flex-wrap sm:items-start sm:justify-between gap-5 sm:gap-6"
					>
						<div
							class="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5 sm:flex-1 min-w-0 sm:min-w-[260px]"
						>
							<!-- Wave 1: the photo lands with the name, before any number exists. -->
							{#if report.photoUrl}
								<img
									src={report.photoUrl}
									alt=""
									loading="lazy"
									decoding="async"
									data-testid="audit-report-photo"
									class="w-[92px] h-[92px] rounded-2xl object-cover flex-shrink-0"
									style="border: 1px solid #1E1E1E;"
								/>
							{/if}

							<!-- Wave 2: the dial replaces its own placeholder in place. -->
							{#if landed.scores}
								{#await import('./AuditHealthDial.svelte') then { default: AuditHealthDial }}
									<AuditHealthDial value={report.healthScore} />
								{/await}
							{:else}
								<div
									class="w-[128px] h-[128px] rounded-full flex-shrink-0 flex items-center justify-center"
									style="border: 10px solid #1E1E1E;"
									data-testid="audit-dial-pending"
									aria-label="Calculating your score"
								>
									<Loader2 size={20} class="animate-spin" color="#FF6B2B" />
								</div>
							{/if}
							<div class="min-w-0 w-full">
								<div class="font-mono text-[10px] uppercase tracking-[0.24em] text-orange">
									Free audit · Restaurant health
								</div>
								<div
									class="font-display text-cream mt-1"
									style="font-size: clamp(22px, 3vw, 34px); letter-spacing: -0.03em; line-height: 1.08; overflow-wrap: break-word;"
									data-testid="audit-report-name"
								>
									{report.name}
								</div>
								<div
									class="text-muted-warm text-[13px] mt-1"
									style="overflow-wrap: break-word;"
								>
									{report.location} · From public info only
								</div>
							</div>
						</div>

						<div class="text-left sm:text-right">
							<div class="font-mono text-[10px] uppercase tracking-[0.24em] text-ghost">
								Estimated money lost
							</div>
							<div
								class="font-display mt-1"
								style="color: #FF6B2B; font-size: clamp(28px, 3.4vw, 40px); letter-spacing: -0.03em; line-height: 1;"
								data-testid="audit-total-impact"
							>
								{landed.scores ? formatLocaleNumber(totalImpact) : '—'}
							</div>
							<div class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-warm mt-1">
								Every week · Estimated
							</div>
						</div>
					</div>

					<!-- Estimated-data note -->
					{#if report.dataSource === 'estimated'}
						<div
							class="mt-5 flex items-start gap-3 rounded-xl p-3.5"
							style="background: rgba(232,80,10,0.06); border: 1px solid rgba(232,80,10,0.22);"
							data-testid="audit-estimated-note"
						>
							<AlertTriangle size={15} color="#FF6B2B" class="flex-shrink-0 mt-0.5" />
							<div class="text-muted-warm text-[12.5px] leading-snug">
								<span class="text-cream" style="font-weight: 500;">These numbers are estimated.</span>
								Location is real; rating and reviews are modelled from public map data. Full verified
								analysis is available once connected to Google.
							</div>
						</div>
					{/if}

					<!-- KPI pills -->
					<div class="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
						{#each report.kpis as k (k.label)}
							{@const Icon = k.icon}
							<div
								class="rounded-xl p-4"
								style="background: #0a0a0a; border: 1px solid #1E1E1E;"
								data-testid="audit-kpi-{kpiSlug(k.label)}"
							>
								<div class="flex items-center gap-2 mb-2">
									<Icon size={12} class="text-orange" />
									<span class="font-mono text-[9.5px] uppercase tracking-[0.2em] text-ghost">{k.label}</span>
								</div>
								<div class="flex items-baseline gap-1">
									<span class="font-display text-cream" style="font-size: 26px; letter-spacing: -0.03em;">
										{k.value}
									</span>
									{#if k.suffix}
										<span class="font-mono text-orange" style="font-size: 12px;">{k.suffix}</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>

					<!-- Sub-scores — the first is fully visible; the rest are locked behind
					     signup. Locked cards still show the LABEL so the visitor knows what
					     they'd get, but never a fabricated number. -->
					{#if landed.scores && report.subScores?.length}
						<div class="mt-6" data-testid="audit-subscores">
							<div class="flex items-center justify-between gap-3 mb-3 flex-wrap">
								<div class="font-mono text-[10px] uppercase tracking-[0.24em] text-orange">
									Score breakdown
								</div>
								{#if lockedSubScores > 0}
									<div class="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ghost">
										{report.subScores.length - lockedSubScores} of {report.subScores.length} unlocked
									</div>
								{/if}
							</div>

							<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
								{#each report.subScores as sc (sc.key)}
									{@const unlocked = isUnlocked(sc)}
									{@const unavailable = unlocked && sc.value === null}
									<div
										in:fly={{ y: 10, duration: 420, opacity: 0, easing: cubicOut }}
										class="rounded-xl p-4 relative overflow-hidden"
										style="background: #0a0a0a; border: 1px solid {unlocked ? '#1E1E1E' : '#171717'};"
										data-testid="audit-subscore-{sc.key}"
										data-locked={unlocked ? 'false' : 'true'}
									>
										<div class="flex items-center justify-between gap-2 mb-2">
											<span class="font-mono text-[9.5px] uppercase tracking-[0.2em] text-ghost">
												{sc.label}
											</span>
											{#if !unlocked}
												<Lock size={11} color="#3a3835" />
											{/if}
										</div>

										{#if !unlocked}
											<!-- Locked: same shape as an unlocked card — a value line and a
											     bar — so the two rhyme and the row reads as withheld rather
											     than broken. The number itself never left the server. -->
											<div class="font-display" style="font-size: 26px; color: #2e2c2a; letter-spacing: -0.03em;">
												••
											</div>
											<div
												class="mt-2 h-1 rounded-full overflow-hidden"
												style="background: #1E1E1E;"
												role="presentation"
											>
												<div
													class="h-full rounded-full"
													style="width: 100%; background: repeating-linear-gradient(90deg, #262422 0 6px, #1a1917 6px 12px);"
												></div>
											</div>
											<div class="text-[10.5px] text-ghost mt-2 leading-snug">Locked</div>
										{:else if unavailable}
											<div class="font-display text-muted-warm" style="font-size: 26px;">—</div>
											<div class="text-[10.5px] text-ghost mt-1 leading-snug">
												Google didn't return this data
											</div>
										{:else}
											<div class="flex items-baseline gap-1">
												<span
													class="font-display text-cream"
													style="font-size: 26px; letter-spacing: -0.03em;"
												>
													{sc.value}
												</span>
												<span class="font-mono text-orange" style="font-size: 11px;">/100</span>
											</div>
											<div
												class="mt-2 h-1 rounded-full overflow-hidden"
												style="background: #1E1E1E;"
												role="presentation"
											>
												<div
													class="h-full rounded-full"
													style="width: {sc.value}%; background: {sc.value >= 75
														? '#22C55E'
														: sc.value >= 50
															? '#FF6B2B'
															: '#F87171'}; transition: width .9s cubic-bezier(0.22,1,0.36,1);"
												></div>
											</div>
											{#if sc.basis}
												<div class="text-[10.5px] text-ghost mt-2 leading-snug">{sc.basis}</div>
											{/if}
										{/if}
									</div>
								{/each}
							</div>

							{#if lockedSubScores > 0}
								<button
									type="button"
									onclick={handleDownloadClick}
									data-testid="audit-unlock-subscores"
									class="mt-3 w-full rounded-xl text-[12.5px] flex items-center justify-center gap-2 py-3"
									style="background: rgba(232,80,10,0.06); border: 1px dashed rgba(232,80,10,0.3); color: #FF6B2B;"
								>
									<Lock size={12} /> Unlock {lockedSubScores} more score{lockedSubScores === 1 ? '' : 's'}
								</button>
							{/if}

							<div class="mt-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ghost">
								Freshness uses the most recent of the {report.reviews?.length ?? 0} reviews Google returned,
								over a {FRESHNESS_HORIZON_DAYS}-day window
							</div>
						</div>
					{/if}

					<!-- Local rank — real Google data on the restaurants a diner picks
					     instead. Deliberately free and fully visible: this is the part an
					     owner leans in for, and it is browser-side data anyway, so "locking"
					     it would be theatre rather than a gate. -->
					{#if landed.competitors && report.competitors}
						{@const c = report.competitors}
						<div
							class="mt-6"
							data-testid="audit-local-rank"
							in:fly={{ y: 10, duration: 420, opacity: 0, easing: cubicOut }}
						>
							<div class="flex items-center justify-between gap-3 mb-3 flex-wrap">
								<div class="font-mono text-[10px] uppercase tracking-[0.24em] text-orange">
									How you compare locally
								</div>
								<div class="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ghost">
									Within {(c.radius_m / 1000).toFixed(1)} km
								</div>
							</div>

							<div class="rounded-xl p-4" style="background: #0a0a0a; border: 1px solid #1E1E1E;">
								<div class="flex items-baseline gap-2 flex-wrap">
									<span class="font-display text-cream" style="font-size: 34px; letter-spacing: -0.03em;">
										#{c.rank}
									</span>
									<span class="font-mono text-orange" style="font-size: 12px;">of {c.total} nearby</span>
								</div>

								<div class="text-[12.5px] text-muted-warm mt-1 leading-snug" data-testid="audit-local-rank-line">
									{#if c.rank === 1}
										Nobody within {(c.radius_m / 1000).toFixed(1)} km is rated higher. That is worth defending.
									{:else}
										{c.gap_to_next}★ behind {c.next_up.name}{#if c.gap_to_leader > c.gap_to_next}, and {c.gap_to_leader}★ off
											{c.leader.name} at the top{/if}.
									{/if}
								</div>

								<div class="mt-4 space-y-1.5">
									{#each rankRows(c) as r (r.rank)}
										{#if r.gap_before}
											<div class="text-ghost text-center leading-none" style="font-size: 13px;">⋮</div>
										{/if}
										<div
											class="flex items-center gap-3 rounded-lg px-3 py-2"
											style="background: {r.is_subject
												? 'rgba(232,80,10,0.07)'
												: '#0f0f0f'}; border: 1px solid {r.is_subject ? 'rgba(232,80,10,0.3)' : '#171717'};"
											data-testid="audit-rank-row"
											data-subject={r.is_subject ? 'true' : 'false'}
										>
											<span class="font-mono text-[11px] w-7 shrink-0 {r.is_subject ? 'text-orange' : 'text-ghost'}">
												#{r.rank}
											</span>
											<span
												class="flex-1 min-w-0 truncate text-[12.5px] {r.is_subject ? 'text-cream' : 'text-muted-warm'}"
											>
												{r.name}
												{#if r.is_subject}
													<span class="font-mono text-[9px] uppercase tracking-[0.14em] text-orange ml-1">You</span>
												{/if}
											</span>
											<span class="font-mono text-[11.5px] text-cream shrink-0">
												{r.rating}<span class="text-orange">★</span>
											</span>
											<span class="font-mono text-[10px] text-ghost shrink-0 hidden sm:inline">
												{formatLocaleNumber(r.review_count)}
											</span>
										</div>
									{/each}
								</div>

								<div class="text-[10.5px] text-ghost mt-3 leading-snug">{c.basis}</div>
							</div>
						</div>
					{/if}

					<!-- Estimate basis note -->
					{#if report.basis}
						<div class="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ghost" data-testid="audit-basis">
							{report.basis}
						</div>
					{/if}

					<!-- Findings + Reviews -->
					<div class="mt-6 grid gap-5 lg:grid-cols-[1.4fr,1fr]">
						<div class="space-y-3">
							<div class="font-mono text-[10px] uppercase tracking-[0.24em] text-orange">
								What JHAX found
							</div>

							{#if !landed.findings}
								<!-- Wave 3 still in flight. Skeletons, not a blocking spinner —
								     everything above is already readable. -->
								<div class="space-y-3" data-testid="audit-findings-pending">
									{#each [0, 1] as i (i)}
										<div
											class="rounded-xl p-4"
											style="background: #0a0a0a; border: 1px solid #1E1E1E;"
										>
											<div class="flex items-center gap-2 text-muted-warm text-[13px]">
												<Loader2 size={13} class="animate-spin" color="#FF6B2B" />
												{i === 0 ? 'Reading your reviews…' : 'Checking your listing…'}
											</div>
											<div class="mt-3 h-2 rounded-full" style="background: #141414; width: 85%;"></div>
											<div class="mt-2 h-2 rounded-full" style="background: #141414; width: 60%;"></div>
										</div>
									{/each}
								</div>
							{:else if findingsError}
								<div
									class="rounded-xl p-4 flex items-start gap-3"
									style="background: #0a0a0a; border: 1px solid rgba(220,38,38,0.3);"
									data-testid="audit-findings-error"
								>
									<AlertTriangle size={15} color="#F87171" class="flex-shrink-0 mt-0.5" />
									<div class="text-muted-warm text-[13px] leading-snug">
										<span class="text-cream" style="font-weight: 500;">
											We couldn&apos;t read your reviews just now.
										</span>
										Your score and listing data above are still accurate.
									</div>
								</div>
							{:else if report.findings.length === 0}
								<div
									class="rounded-xl p-4 text-muted-warm text-[13px] leading-snug"
									style="background: #0a0a0a; border: 1px solid #1E1E1E;"
									data-testid="audit-findings-empty"
								>
									Google didn&apos;t return enough about this listing to say anything specific we
									can stand behind. We&apos;d rather show you nothing than something generic.
								</div>
							{:else}
								<!-- One 'working' and one 'quick win' are always fully visible; anything
								     beyond that pair is locked until signup. -->
								{#each report.findings as f, i (i)}
									{@const unlocked = isUnlocked(f)}
									{@const st = findingStyle(f)}
									{@const Icon = st.Icon}
									<div
										in:fly={{ y: 10, duration: 500, delay: 100 + i * 90, opacity: 0, easing: cubicOut }}
										class="rounded-xl p-4 flex items-start gap-3"
										style="background: #0a0a0a; border: 1px solid {unlocked ? st.bd : '#1E1E1E'};"
										data-testid="audit-finding-{i}"
										data-kind={f.kind}
										data-severity={f.severity}
										data-locked={unlocked ? 'false' : 'true'}
									>
										<!-- The severity icon stays, locked or not. A locked row still has
										     to say how much this matters — that is the whole point of the
										     tease. It is dimmed, not replaced. -->
										<div
											class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
											style="background: {st.bg}; border: 1px solid {st.bd}; opacity: {unlocked ? 1 : 0.55};"
										>
											<Icon size={16} color={st.color} />
										</div>

										<div class="flex-1 min-w-0">
											<div class="flex items-center gap-2 flex-wrap">
												<span
													class="font-mono text-[9.5px] uppercase tracking-[0.22em] px-2 py-0.5 rounded-full inline-block"
													style="color: {st.color}; background: {st.bg}; border: 1px solid {st.bd}; opacity: {unlocked
														? 1
														: 0.7};"
												>
													{st.label}
												</span>
												{#if !unlocked}
													<Lock size={11} color="#3a3835" />
												{/if}
											</div>

											{#if !unlocked}
												<!-- Locked rows name the real issue. `label` is verified
												     server-side like every other claim, so it is accurate even
												     though the detail behind it is withheld. The detail was
												     never sent — these bars stand in for text that is not in
												     the DOM at all. -->
												<div
													class="text-[14.5px] mt-1.5"
													style="color: #8a8681; font-weight: 500; line-height: 1.25;"
													data-testid="audit-finding-{i}-label"
												>
													{f.label}
												</div>
												<div class="mt-2.5 space-y-2" aria-label="Details locked until sign-up">
													<div class="h-2 rounded-full" style="background: #171614; width: 92%;"></div>
													<div class="h-2 rounded-full" style="background: #171614; width: 68%;"></div>
												</div>
											{:else}
												<div
													class="text-cream text-[15px] mt-1.5"
													style="font-weight: 500; line-height: 1.25;"
												>
													{f.title}
												</div>
												<div class="text-muted-warm text-[13px] mt-1 leading-snug">{f.body}</div>
												{#if f.evidence}
													<!-- The receipt. Verified server-side against the Places
													     payload before it was allowed through. -->
													<div
														class="mt-2.5 flex items-start gap-2 pl-2.5"
														style="border-left: 2px solid {st.bd};"
														data-testid="audit-finding-{i}-evidence"
													>
														<Quote size={11} color="#6B6866" class="flex-shrink-0 mt-1" />
														<span class="text-ghost text-[12px] italic leading-snug">
															{f.evidence}
														</span>
													</div>
												{/if}
											{/if}
										</div>
									</div>
								{/each}

								{#if lockedFindings > 0}
									<button
										type="button"
										onclick={handleDownloadClick}
										data-testid="audit-unlock-findings"
										class="w-full rounded-xl text-[12.5px] flex items-center justify-center gap-2 py-3"
										style="background: rgba(232,80,10,0.06); border: 1px dashed rgba(232,80,10,0.3); color: #FF6B2B;"
									>
										<Lock size={12} /> Unlock {lockedFindings} more finding{lockedFindings === 1 ? '' : 's'}
									</button>
								{/if}
							{/if}
						</div>

						<!-- Reviews panel -->
						<div
							class="rounded-2xl p-5"
							style="background: #0a0a0a; border: 1px solid #1E1E1E;"
							data-testid="audit-reviews"
						>
							<div class="flex items-center justify-between mb-4">
								<div class="font-mono text-[10px] uppercase tracking-[0.24em] text-orange">
									What people are saying
								</div>
								<div class="font-mono text-[10px] uppercase tracking-[0.18em] text-ghost">From Google</div>
							</div>
							{#if report.reviews.length === 0}
								<div class="text-muted-warm text-[13px]">No public reviews yet.</div>
							{:else}
								<div class="space-y-3">
									{#each report.reviews.slice(0, 3) as r, i (i)}
										<div
											class="rounded-xl p-3"
											style="background: #0d0d0d; border: 1px solid #1E1E1E;"
											data-testid="audit-review-{i}"
										>
											<div class="flex items-center justify-between mb-1 gap-2">
												<span class="text-cream text-[13px] truncate" style="font-weight: 500;">
													{r.author || 'Google user'}
												</span>
												{#if r.rating != null}
													<span class="font-mono text-[11px] text-orange whitespace-nowrap">{r.rating}★</span>
												{/if}
											</div>
											{#if r.text}
												<div
													class="text-muted-warm text-[12.5px] leading-snug"
													style="display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;"
												>
													{r.text}
												</div>
											{/if}
											{#if r.relative_time}
												<div class="font-mono text-[10px] uppercase tracking-[0.16em] text-ghost mt-1.5">
													{r.relative_time}
												</div>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</div>

					<!-- Bottom CTA -->
					<div
						class="mt-7 rounded-2xl p-5 md:p-6 flex flex-wrap items-center justify-between gap-4"
						style="background: linear-gradient(90deg, rgba(232,80,10,0.08), rgba(232,80,10,0.02)); border: 1px solid rgba(232,80,10,0.35);"
						data-testid="audit-cta"
					>
						<div class="flex-1 min-w-[240px]">
							<div class="text-cream font-display" style="font-size: 20px; letter-spacing: -0.02em; line-height: 1.2;">
								This is only what we can see from the outside.
							</div>
							<div class="text-muted-warm text-[14px] mt-1.5">
								{INDIA ? 'Plug in your Petpooja' : 'Plug in your Square'} and JHAX shows you the money you&apos;re losing
								<em style="font-style: italic; color: #F5F2ED;">inside</em> your restaurant too — every
								regular, every shift, every dish.
							</div>
						</div>
						<div class="flex flex-col sm:flex-row flex-wrap gap-2.5 w-full sm:w-auto">
							<button
								type="button"
								onclick={handleDownloadClick}
								disabled={pdfState === 'working'}
								data-testid="audit-download"
								data-html2canvas-ignore="true"
								class="inline-flex items-center justify-center gap-2 rounded-full text-[13px] font-semibold w-full sm:w-auto"
								style="background: #0a0a0a; border: 1px solid rgba(232,80,10,0.45); color: #FF6B2B; padding: 12px 18px; opacity: {pdfState ===
									'working'
									? 0.6
									: 1};"
							>
								{#if pdfState === 'working'}
									<Loader2 size={14} class="animate-spin" /> Preparing…
								{:else}
									<Download size={14} /> Download report
								{/if}
							</button>
							<button
								type="button"
								onclick={reset}
								data-testid="audit-run-another"
								class="rounded-full text-[13px] w-full sm:w-auto text-center"
								style="background: #0a0a0a; border: 1px solid #1E1E1E; color: #6B6866; padding: 12px 18px;"
							>
								Run another
							</button>
							<a
								href="#book-demo"
								data-testid="audit-cta-book"
								class="inline-flex items-center justify-center gap-2 rounded-full text-[14px] font-semibold w-full sm:w-auto"
								style="background: #E8500A; color: #fff; padding: 12px 22px; box-shadow: 0 16px 40px -14px rgba(232,80,10,0.6);"
							>
								{INDIA ? 'Connect your Petpooja' : 'Connect your Square'} <ArrowRight size={14} />
							</a>
						</div>
						{#if pdfMsg}
							<div
								transition:fade={{ duration: 300 }}
								class="basis-full font-mono text-[11px] uppercase tracking-[0.16em] mt-1"
								style="color: {pdfMsg.startsWith('Couldn') ? '#F87171' : '#22C55E'};"
								data-testid="audit-pdf-msg"
							>
								{pdfMsg}
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<!-- Idle helper strip -->
		{#if state === 'idle'}
			<div
				class="mt-8 flex items-center justify-center gap-6 font-mono text-[10.5px] uppercase tracking-[0.2em] text-ghost"
			>
				<span>Uses only public info</span>
				<span>·</span>
				<span>Instant results</span>
				<span>·</span>
				<span>{INDIA ? 'Real Google Maps data' : 'Real Google data'}</span>
			</div>
		{/if}
	</div>

	<!-- Signup gate before report download -->
	{#if showSignup}
		<div
			class="fixed inset-0 z-[60] flex items-center justify-center p-4"
			style="background: rgba(4,4,4,0.72); backdrop-filter: blur(4px);"
			transition:fade={{ duration: 250 }}
			onclick={() => signupState !== 'submitting' && (showSignup = false)}
			onkeydown={(e) => e.key === 'Escape' && signupState !== 'submitting' && (showSignup = false)}
			role="button"
			tabindex="-1"
			data-testid="audit-signup-overlay"
		>
			<div
				class="w-full max-w-[440px] rounded-[20px] relative overflow-hidden"
				style="background: #0d0d0d; border: 1px solid rgba(232,80,10,0.3); box-shadow: 0 40px 120px -40px rgba(232,80,10,0.45);"
				in:fly={{ y: 18, duration: 350, opacity: 0, easing: cubicOut }}
				out:fly={{ y: 10, duration: 350, opacity: 0, easing: cubicOut }}
				onclick={(e) => e.stopPropagation()}
				onkeydown={() => {}}
				role="dialog"
				aria-modal="true"
				tabindex="-1"
				data-testid="audit-signup-modal"
			>
				<div
					aria-hidden="true"
					class="absolute top-0 left-0 right-0 h-[3px]"
					style="background: linear-gradient(90deg, transparent, #E8500A 30%, #FF6B2B 60%, transparent);"
				></div>
				<div class="p-6 md:p-7">
					<button
						type="button"
						onclick={() => signupState !== 'submitting' && (showSignup = false)}
						data-testid="audit-signup-close"
						class="absolute top-4 right-4 flex items-center justify-center rounded-full"
						style="width: 30px; height: 30px; background: #0a0a0a; border: 1px solid #1E1E1E; color: #6B6866;"
					>
						<X size={15} />
					</button>

					<div class="font-mono text-[10px] uppercase tracking-[0.24em] text-orange">One quick step</div>
					<h3 class="font-display text-cream mt-2" style="font-size: 24px; letter-spacing: -0.02em; line-height: 1.15;">
						Get your full report
					</h3>
					<p class="text-muted-warm text-[13.5px] mt-2" style="line-height: 1.5;">
						Enter your details and your full PDF report downloads to this device right away.
					</p>

					<!-- novalidate: we show our own inline messages instead of the browser's
					     native tooltips, which would otherwise block submit on type="email". -->
					<form onsubmit={submitSignup} novalidate class="mt-5 space-y-3" data-testid="audit-signup-form">
						{#each signupFields as field (field.key)}
							{@const Icon = field.Icon}
							{@const err = fieldErrors[field.key]}
							<div>
								<label class="font-mono text-[9px] uppercase tracking-[0.18em] text-ghost" for="audit-{field.testid}">
									{field.label}
								</label>
								<div
									class="flex items-center gap-2 mt-1 rounded-lg px-3 min-w-0"
									style="background: #0a0a0a; border: 1px solid {err ? 'rgba(220,38,38,0.55)' : '#1E1E1E'}; height: 44px; transition: border-color .2s;"
								>
									<Icon size={14} color={err ? '#F87171' : undefined} class="text-muted-warm flex-shrink-0" />
									<input
										id="audit-{field.testid}"
										type={field.type}
										value={signup[field.key]}
										oninput={(e) => onSignupInput(field.key, e.currentTarget.value)}
										onblur={() => (fieldErrors[field.key] = validateField(field.key, signup[field.key]))}
										placeholder={field.placeholder}
										disabled={signupState === 'submitting'}
										maxlength={field.maxlength}
										inputmode={field.inputmode}
										autocomplete={field.autocomplete}
										aria-invalid={err ? 'true' : 'false'}
										aria-describedby={err ? `audit-${field.testid}-error` : undefined}
										data-testid="audit-{field.testid}"
										class="flex-1 min-w-0 w-full bg-transparent outline-none text-cream placeholder:text-muted-warm"
										style="font-size: 14px;"
									/>
								</div>
								{#if err}
									<div
										id="audit-{field.testid}-error"
										data-testid="audit-{field.testid}-error"
										class="text-[11.5px] mt-1 flex items-center gap-1.5"
										style="color: #F87171;"
									>
										<AlertTriangle size={11} class="flex-shrink-0" /> {err}
									</div>
								{/if}
							</div>
						{/each}

						{#if signupError}
							<div class="text-[12.5px] flex items-center gap-2" style="color: #F87171;" data-testid="audit-signup-error">
								<AlertTriangle size={13} /> {signupError}
							</div>
						{/if}

						<button
							type="submit"
							disabled={signupState === 'submitting'}
							data-testid="audit-signup-submit"
							class="w-full inline-flex items-center justify-center gap-2 rounded-full font-semibold mt-1"
							style="background: #E8500A; color: #fff; height: 48px; font-size: 15px; opacity: {signupState ===
								'submitting'
								? 0.6
								: 1}; box-shadow: 0 16px 40px -14px rgba(232,80,10,0.6);"
						>
							{#if signupState === 'submitting'}
								<Loader2 size={15} class="animate-spin" /> Preparing your report…
							{:else}
								Download my report <Download size={15} />
							{/if}
						</button>
						<div class="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ghost text-center">
							No spam · Only about your audit
						</div>
					</form>
				</div>
			</div>
		</div>
	{/if}
</section>
