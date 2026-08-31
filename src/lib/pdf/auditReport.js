/**
 * The audit report, drawn as a REAL PDF.
 *
 * The previous export ran the on-screen report through html2canvas: the whole page
 * became one tall PNG that jsPDF then sliced across pages. That produced a document
 * that was blurry the moment anyone zoomed, impossible to select or search, heavy,
 * and — because the slicing knew nothing about the content — happy to cut a line of
 * text in half at a page boundary.
 *
 * This module draws the same report with vector primitives instead. Text is text:
 * sharp at any zoom, selectable, searchable, a fraction of the size. Every block
 * measures itself before it draws, so a section moves to the next page whole rather
 * than being sliced through the middle.
 *
 * FONT CONSTRAINT (the reason for `safe()` below): the PDF standard fonts are
 * WinAnsi-encoded. Hand jsPDF a character outside that set and it silently switches
 * the ENTIRE string to two-byte encoding, which renders as garbage under a standard
 * font — one stray glyph corrupts the whole line. So unencodable characters are
 * mapped or dropped on the way in, and the star rating is DRAWN as a vector polygon
 * rather than typed.
 */
import { jsPDF } from 'jspdf';
import { rankRows } from '../audit/competitors.js';

const PAGE = { w: 595.28, h: 841.89 };
const M = { left: 46, right: 46, top: 64, bottom: 58 };
const CONTENT_W = PAGE.w - M.left - M.right;

const C = {
	ink: '#141414',
	body: '#4A4642',
	muted: '#6B6866',
	ghost: '#9A9691',
	line: '#E6E2DC',
	soft: '#FAF8F5',
	paper: '#FFFFFF',
	dark: '#141414',
	darkText: '#F5F1EA',
	darkMuted: '#A9A49C',
	orange: '#E8500A',
	orangeLite: '#FFF6F0',
	orangeLine: '#F5D9C9',
	deepOrange: '#B23A06',
	good: '#16A34A',
	bad: '#DC2626'
};

const SEVERITY = {
	urgent: { label: 'URGENT', color: C.bad },
	moderate: { label: 'QUICK WIN', color: C.orange },
	positive: { label: 'WHAT IS WORKING', color: C.good }
};

const scoreColor = (v) => (v >= 75 ? C.good : v >= 50 ? C.orange : C.bad);

/** '#E8500A' -> [232, 80, 10] */
function rgb(hex) {
	const h = hex.replace('#', '');
	return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * The characters the standard fonts CAN render: Latin-1 plus the cp1252 additions
 * (em dash, curly quotes, bullet, ellipsis...). Anything else has to go, or the line
 * it sits in is lost.
 */
const CP1252_EXTRA = new Set([
	0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152,
	0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a,
	0x0153, 0x017e, 0x0178
]);

/**
 * Make a string safe to typeset. The rupee sign becomes "Rs" — it is outside WinAnsi
 * and would otherwise corrupt its whole line. The star is dropped because callers
 * draw it. Anything else unencodable is dropped rather than shown as a wrong glyph.
 */
export function safe(value) {
	let out = '';
	for (const ch of String(value ?? '')) {
		const c = ch.codePointAt(0);
		if (c === 0x2605) continue;
		if (c === 0x20b9) {
			// "Rs 5,040", not "Rs5,040" — the space the symbol implied has to come back.
			out += out.endsWith(' ') ? 'Rs ' : ' Rs ';
			continue;
		}
		if (c <= 0xff || CP1252_EXTRA.has(c)) out += ch;
	}
	return out.replace(/ {2,}/g, ' ').trim();
}

/**
 * One report, one renderer. Everything below closes over `doc` and the `y` cursor,
 * and nothing draws without first asking `room()` whether the block still fits.
 *
 * @param {object} report the same object the on-screen report renders from
 * @param {{ generatedOn: string, money: string, formatNumber?: (n: number) => string }} opts
 * @returns {import('jspdf').jsPDF}
 */
export function buildAuditPdf(report, opts) {
	const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true });
	const fmtNum = opts.formatNumber || ((n) => String(n));
	let y = M.top;

	// ---- primitives ----------------------------------------------------------
	const fill = (hex) => doc.setFillColor(...rgb(hex));
	const stroke = (hex) => doc.setDrawColor(...rgb(hex));
	const ink = (hex) => doc.setTextColor(...rgb(hex));
	const font = (style, size) => {
		doc.setFont('helvetica', style);
		doc.setFontSize(size);
	};

	const box = (x, yy, w, h, r, bg, border) => {
		if (bg) fill(bg);
		if (border) {
			stroke(border);
			doc.setLineWidth(0.6);
		}
		doc.roundedRect(x, yy, w, h, r, r, bg && border ? 'FD' : bg ? 'F' : 'S');
	};

	const text = (str, x, yy, o = {}) => {
		font(o.style || 'normal', o.size || 10);
		ink(o.color || C.ink);
		doc.text(safe(str), x, yy, { align: o.align || 'left', charSpace: o.track || 0 });
	};

	/** Wrap to a width, returning the lines so a caller can measure before drawing. */
	const wrap = (str, width, style, size) => {
		font(style, size);
		return doc.splitTextToSize(safe(str), width);
	};

	const paragraph = (lines, x, yy, o = {}) => {
		font(o.style || 'normal', o.size || 10);
		ink(o.color || C.body);
		const lead = o.lead || (o.size || 10) * 1.42;
		lines.forEach((ln, i) => doc.text(ln, x, yy + i * lead, { align: o.align || 'left' }));
		return lines.length * lead;
	};

	/** A five-pointed star, drawn — see the FONT CONSTRAINT note at the top. */
	const star = (cx, cy, r, color) => {
		const pts = [];
		for (let i = 0; i < 10; i++) {
			const rad = i % 2 === 0 ? r : r * 0.44;
			const a = -Math.PI / 2 + (i * Math.PI) / 5;
			pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]);
		}
		const deltas = [];
		for (let i = 1; i < pts.length; i++) {
			deltas.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
		}
		fill(color);
		doc.lines(deltas, pts[0][0], pts[0][1], [1, 1], 'F', true);
	};

	// ---- page chrome ---------------------------------------------------------
	const chrome = () => {
		text('JHAX', M.left, 38, { style: 'bold', size: 10.5, color: C.orange, track: 0.6 });
		const w = doc.getTextWidth('JHAX');
		text('Restaurant Health Report', M.left + w + 8, 38, { size: 9.5, color: C.muted });
		text(opts.generatedOn, PAGE.w - M.right, 38, { size: 9, color: C.ghost, align: 'right' });
		stroke(C.line);
		doc.setLineWidth(0.6);
		doc.line(M.left, 46, PAGE.w - M.right, 46);
	};

	const newPage = () => {
		doc.addPage();
		chrome();
		y = M.top;
	};

	/** Reserve vertical space, breaking the page FIRST when the block will not fit. */
	const room = (h) => {
		if (y + h > PAGE.h - M.bottom) newPage();
	};

	/**
	 * A section heading, and the guarantee that it does not end up alone.
	 *
	 * `firstBlockH` is the height of whatever draws immediately after: the heading and
	 * that first block are reserved TOGETHER, so a section can never sit stranded at
	 * the foot of one page with its content beginning on the next.
	 */
	const section = (title, firstBlockH = 0) => {
		room(26 + firstBlockH);
		text(title.toUpperCase(), M.left, y, {
			style: 'bold',
			size: 8.5,
			color: C.orange,
			track: 1.1
		});
		y += 13;
	};

	// ---- blocks --------------------------------------------------------------

	/** Masthead: who this is, and the one number that matters, on a dark panel. */
	const hero = () => {
		const nameLines = wrap(report.name, CONTENT_W - 175, 'bold', 20).slice(0, 2);
		const addrLines = wrap(report.location, CONTENT_W - 185, 'normal', 9).slice(0, 2);
		const h = Math.max(104, 56 + nameLines.length * 23 + addrLines.length * 12);
		box(M.left, y, CONTENT_W, h, 14, C.dark, null);

		const x = M.left + 22;
		text('RESTAURANT HEALTH', x, y + 26, { style: 'bold', size: 8, color: C.orange, track: 1.4 });
		paragraph(nameLines, x, y + 50, { style: 'bold', size: 20, color: C.darkText, lead: 23 });
		paragraph(addrLines, x, y + 50 + nameLines.length * 23, {
			size: 9,
			color: C.darkMuted,
			lead: 12
		});

		// Score, right-aligned inside the panel.
		const sx = M.left + CONTENT_W - 22;
		const sc = report.healthScore ?? 0;
		text('/100', sx, y + 58, { style: 'bold', size: 12, color: C.darkMuted, align: 'right' });
		const slashW = doc.getTextWidth('/100');
		text(String(sc), sx - slashW - 4, y + 58, {
			style: 'bold',
			size: 40,
			color: scoreColor(sc),
			align: 'right'
		});
		text(String(report.healthLabel || '').toUpperCase(), sx, y + 76, {
			style: 'bold',
			size: 8.5,
			color: scoreColor(sc),
			align: 'right',
			track: 1
		});
		text('HEALTH SCORE', sx, y + 90, { size: 7.5, color: C.darkMuted, align: 'right', track: 1 });

		y += h + 12;
	};

	/** The money line — the reason an owner keeps reading. */
	const moneyStrip = () => {
		const basis = wrap(report.basis || '', CONTENT_W - 36, 'normal', 8.5);
		const h = 48 + Math.max(0, basis.length) * 11;
		room(h + 10);
		box(M.left, y, CONTENT_W, h, 12, C.orangeLite, C.orangeLine);
		text('ESTIMATED MONEY LOST', M.left + 18, y + 19, {
			style: 'bold',
			size: 7.5,
			color: C.deepOrange,
			track: 1.2
		});
		text(opts.money, M.left + 18, y + 40, { style: 'bold', size: 19, color: C.orange });
		const mw = doc.getTextWidth(safe(opts.money));
		text('per week', M.left + 25 + mw, y + 40, { size: 9, color: C.deepOrange });
		if (basis.length) {
			paragraph(basis, M.left + 18, y + 56, { size: 8.5, color: C.muted, lead: 11 });
		}
		y += h + 15;
	};

	/** Four headline numbers, evenly divided across the content width. */
	const kpis = () => {
		const rows = (report.kpis || []).filter(Boolean);
		if (!rows.length) return;
		const gap = 10;
		const w = (CONTENT_W - gap * (rows.length - 1)) / rows.length;
		const h = 52;
		section('Key numbers', h);
		rows.forEach((k, i) => {
			const x = M.left + i * (w + gap);
			box(x, y, w, h, 10, C.soft, C.line);
			text(String(k.label).toUpperCase(), x + 12, y + 18, {
				style: 'bold',
				size: 7,
				color: C.ghost,
				track: 0.9
			});
			text(String(k.value), x + 12, y + 40, { style: 'bold', size: 17, color: C.ink });
			// The rating card's star is drawn, never typed.
			if (k.suffix) {
				const vw = doc.getTextWidth(safe(String(k.value)));
				star(x + 12 + vw + 8, y + 34, 5.4, C.orange);
			}
		});
		y += h + 15;
	};

	/** The four dimensions behind the headline score, each with its bar. */
	const subScores = () => {
		const rows = (report.subScores || []).filter((sc) => sc && sc.label);
		if (!rows.length) return;
		const gap = 10;
		const w = (CONTENT_W - gap * (rows.length - 1)) / rows.length;
		// The tallest basis line decides the row height, so no card clips its own text.
		const bases = rows.map((sc) =>
			wrap(
				typeof sc.value === 'number' ? sc.basis || '' : 'Google did not return this data',
				w - 22,
				'normal',
				7.5
			).slice(0, 3)
		);
		const h = 60 + Math.max(...bases.map((b) => b.length)) * 9.5;
		section('Score breakdown', h);
		rows.forEach((sc, i) => {
			const x = M.left + i * (w + gap);
			const has = typeof sc.value === 'number';
			const col = has ? scoreColor(sc.value) : C.ghost;
			box(x, y, w, h, 10, C.paper, C.line);
			text(String(sc.label).toUpperCase(), x + 11, y + 18, {
				style: 'bold',
				size: 7,
				color: C.ghost,
				track: 0.9
			});
			text(has ? String(sc.value) : '-', x + 11, y + 39, { style: 'bold', size: 19, color: col });
			if (has) {
				const nw = doc.getTextWidth(String(sc.value));
				text('/100', x + 14 + nw, y + 39, { style: 'bold', size: 8, color: C.ghost });
			}
			// Track, then fill — the bar reads faster than the number it repeats.
			fill(C.line);
			doc.roundedRect(x + 11, y + 46, w - 22, 4, 2, 2, 'F');
			if (has && sc.value > 0) {
				fill(col);
				doc.roundedRect(x + 11, y + 46, ((w - 22) * sc.value) / 100, 4, 2, 2, 'F');
			}
			paragraph(bases[i], x + 11, y + 61, { size: 7.5, color: C.muted, lead: 9.5 });
		});
		y += h + 15;
	};

	/** Local rank — the comparison an owner cannot argue with. */
	const localRank = () => {
		const c = report.competitors;
		if (!c) return;
		const rows = rankRows(c);
		if (!rows.length) return;

		const headline =
			c.rank === 1
				? 'Rated higher than every other restaurant nearby.'
				: 'You are ' + c.gap_to_next + ' stars behind ' + c.next_up.name + '.';
		const headLines = wrap(headline, CONTENT_W - 32, 'bold', 11);
		const basisLines = wrap(c.basis || '', CONTENT_W - 32, 'normal', 7.5);
		const rowH = 24;
		const gaps = rows.filter((r) => r.gap_before).length;
		const h =
			46 + headLines.length * 14 + rows.length * (rowH + 4) + gaps * 10 + basisLines.length * 10;

		section('How you compare locally', h);
		box(M.left, y, CONTENT_W, h, 12, C.paper, C.line);

		let ry = y + 22;
		text('#' + c.rank, M.left + 16, ry, { style: 'bold', size: 22, color: C.orange });
		const rw = doc.getTextWidth('#' + c.rank);
		text('of ' + c.total + ' nearby', M.left + 22 + rw, ry, { size: 9.5, color: C.muted });
		ry += 16;
		ry += paragraph(headLines, M.left + 16, ry, {
			style: 'bold',
			size: 11,
			color: C.ink,
			lead: 14
		});
		ry += 6;

		rows.forEach((r) => {
			if (r.gap_before) {
				text('...', M.left + 26, ry + 6, { style: 'bold', size: 9, color: C.ghost });
				ry += 10;
			}
			const mine = r.is_subject;
			box(
				M.left + 12,
				ry,
				CONTENT_W - 24,
				rowH,
				7,
				mine ? C.orangeLite : C.soft,
				mine ? C.orangeLine : C.line
			);
			text('#' + r.rank, M.left + 22, ry + 16, {
				style: 'bold',
				size: 9,
				color: mine ? C.orange : C.ghost
			});
			const nm = wrap(r.name, CONTENT_W - 200, mine ? 'bold' : 'normal', 9.5)[0] || '';
			text(nm, M.left + 48, ry + 16, {
				style: mine ? 'bold' : 'normal',
				size: 9.5,
				color: C.ink
			});
			if (mine) {
				font('bold', 9.5);
				const nw2 = doc.getTextWidth(nm);
				text('YOU', M.left + 54 + nw2, ry + 16, {
					style: 'bold',
					size: 6.5,
					color: C.orange,
					track: 0.8
				});
			}
			// Review count furthest right, then rating and its drawn star.
			text(fmtNum(r.review_count), M.left + CONTENT_W - 22, ry + 16, {
				size: 8,
				color: C.ghost,
				align: 'right'
			});
			text(String(r.rating), M.left + CONTENT_W - 76, ry + 16, {
				style: 'bold',
				size: 9.5,
				color: C.orange,
				align: 'right'
			});
			star(M.left + CONTENT_W - 69, ry + 12.5, 4.4, C.orange);
			ry += rowH + 4;
		});

		if (basisLines.length) {
			paragraph(basisLines, M.left + 16, ry + 8, { size: 7.5, color: C.ghost, lead: 10 });
		}
		y += h + 15;
	};

	/** The prose. Redacted rows carry no detail, so they are not printed at all. */
	const findings = () => {
		const rows = (report.findings || []).filter((f) => f && f.title && f.body);

		if (!rows.length) {
			const lines = wrap(
				'The findings service could not be reached when this report was generated, so this ' +
					'section is empty. Every score and number above is unaffected.',
				CONTENT_W - 28,
				'normal',
				9
			);
			const h = 22 + lines.length * 12;
			section('What JHAX found', h);
			box(M.left, y, CONTENT_W, h, 10, C.soft, C.line);
			paragraph(lines, M.left + 14, y + 19, { size: 9, color: C.muted, lead: 12 });
			y += h + 15;
			return;
		}

		/**
		 * Measure a card up front. The height has to account for the evidence box AND
		 * its source line, which sit BELOW the body text — getting this short is what
		 * made the quote spill past the card's own border.
		 */
		const measure = (f) => {
			const innerW = CONTENT_W - 36;
			const titleLines = wrap(f.title, innerW, 'bold', 11);
			const bodyLines = wrap(f.body, innerW, 'normal', 9.5);
			const evLines = f.evidence ? wrap('"' + f.evidence + '"', innerW - 16, 'italic', 8.5) : [];
			const h =
				45 +
				titleLines.length * 14 +
				bodyLines.length * 13 +
				(evLines.length ? evLines.length * 11 + 26 : 0);
			return { innerW, titleLines, bodyLines, evLines, h };
		};

		const measured = rows.map(measure);
		section('What JHAX found', measured[0].h);

		rows.forEach((f, idx) => {
			const meta = SEVERITY[f.severity] || SEVERITY.moderate;
			const { innerW, titleLines, bodyLines, evLines, h } = measured[idx];

			room(h + 8);
			box(M.left, y, CONTENT_W, h, 10, C.paper, C.line);
			// Severity spine: colour before words, readable at a glance.
			fill(meta.color);
			doc.roundedRect(M.left, y, 3.5, h, 1.5, 1.5, 'F');

			let fy = y + 19;
			text(meta.label, M.left + 18, fy, { style: 'bold', size: 7, color: meta.color, track: 1.1 });
			fy += 15;
			fy += paragraph(titleLines, M.left + 18, fy, {
				style: 'bold',
				size: 11,
				color: C.ink,
				lead: 14
			});
			fy += 3;
			fy += paragraph(bodyLines, M.left + 18, fy, { size: 9.5, color: C.body, lead: 13 });

			if (evLines.length) {
				const evTop = fy + 2;
				fill(C.soft);
				doc.roundedRect(M.left + 18, evTop, innerW, evLines.length * 11 + 20, 6, 6, 'F');
				stroke(meta.color);
				doc.setLineWidth(1.8);
				doc.line(M.left + 20, evTop + 4, M.left + 20, evTop + evLines.length * 11 + 6);
				paragraph(evLines, M.left + 28, evTop + 13, {
					style: 'italic',
					size: 8.5,
					color: C.muted,
					lead: 11
				});
				text(
					'SOURCE: ' + String(f.evidence_source || 'listing').split('_').join(' ').toUpperCase(),
					M.left + 28,
					evTop + evLines.length * 11 + 14,
					{ style: 'bold', size: 6.5, color: C.ghost, track: 0.7 }
				);
			}
			y += h + 9;
		});
		y += 9;
	};

	/** What people actually said, in their words. */
	const reviews = () => {
		const rows = (report.reviews || []).slice(0, 3);
		if (!rows.length) {
			const h = 34;
			section('What people are saying', h);
			box(M.left, y, CONTENT_W, h, 10, C.soft, C.line);
			text('No public reviews available for this restaurant.', M.left + 14, y + 21, {
				size: 9,
				color: C.muted
			});
			y += h + 15;
			return;
		}
		const measured = rows.map((r) => {
			const lines = r.text ? wrap(r.text, CONTENT_W - 28, 'normal', 9) : [];
			return { lines, h: 32 + lines.length * 12 + (r.relative_time ? 12 : 0) };
		});
		section('What people are saying', measured[0].h);

		rows.forEach((r, idx) => {
			const { lines, h } = measured[idx];
			room(h + 6);
			box(M.left, y, CONTENT_W, h, 10, C.soft, C.line);
			text(r.author || 'Google user', M.left + 14, y + 20, {
				style: 'bold',
				size: 9.5,
				color: C.ink
			});
			if (r.rating != null) {
				text(String(r.rating), M.left + CONTENT_W - 26, y + 20, {
					style: 'bold',
					size: 9.5,
					color: C.orange,
					align: 'right'
				});
				star(M.left + CONTENT_W - 19, y + 16.5, 4.4, C.orange);
			}
			let ry = y + 33;
			if (lines.length) {
				ry += paragraph(lines, M.left + 14, ry, { size: 9, color: C.body, lead: 12 });
			}
			if (r.relative_time) {
				text(String(r.relative_time).toUpperCase(), M.left + 14, ry + 3, {
					size: 6.5,
					color: C.ghost,
					track: 0.8
				});
			}
			y += h + 7;
		});
		y += 8;
	};

	/** What this document is, and what in it is estimated. */
	const colophon = () => {
		const lines = wrap(
			'Generated by JHAX.ai from this restaurant’s public Google Maps listing on ' +
				opts.generatedOn +
				'. Every finding is checked against that data before it is shown; nothing here is ' +
				'estimated except the money figure, which is derived from rating and review volume.',
			CONTENT_W,
			'normal',
			7.5
		);
		room(lines.length * 10 + 20);
		stroke(C.line);
		doc.setLineWidth(0.6);
		doc.line(M.left, y, PAGE.w - M.right, y);
		paragraph(lines, M.left, y + 14, { size: 7.5, color: C.ghost, lead: 10 });
		y += lines.length * 10 + 16;
	};

	// ---- compose -------------------------------------------------------------
	chrome();
	hero();
	moneyStrip();
	kpis();
	subScores();
	localRank();
	findings();
	reviews();
	colophon();

	// Footers last: the page count is only known once everything has been laid out.
	const total = doc.internal.getNumberOfPages();
	for (let i = 1; i <= total; i++) {
		doc.setPage(i);
		stroke(C.line);
		doc.setLineWidth(0.6);
		doc.line(M.left, PAGE.h - 40, PAGE.w - M.right, PAGE.h - 40);
		text('Generated by JHAX', M.left, PAGE.h - 26, { size: 8, color: C.ghost });
		text('Page ' + i + ' of ' + total, PAGE.w - M.right, PAGE.h - 26, {
			size: 8,
			color: C.ghost,
			align: 'right'
		});
	}

	return doc;
}
