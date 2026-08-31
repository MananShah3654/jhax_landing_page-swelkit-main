/**
 * Export the Firestore `leads` collection to an Excel .xlsx file that opens
 * pre-formatted (readable column widths, bold frozen header, autofilter, phone
 * as text) — no manual resizing needed.
 *
 * Uses firebase-admin with a service-account key, which bypasses the Firestore
 * security rules (clients are blocked from reading leads; the owner reads them
 * with admin credentials — this is the intended, secure path).
 *
 * Formatting:
 *   - ALL rows are exported (duplicate emails included), newest first.
 *   - Column widths are pre-set so nothing is clipped on open.
 *   - The phone column is real Excel TEXT (numFmt '@') → no 7.38E+09 scientific
 *     notation, and leading zeros are preserved.
 *
 * Setup (one time):
 *   1. Firebase console → project jhax-coo → Project settings (gear) →
 *      "Service accounts" tab → "Generate new private key" → save the JSON as
 *      serviceAccountKey.json in this project folder (it's gitignored — keep it secret).
 *   2. npm install            (installs the exceljs + firebase-admin devDependencies)
 *
 * Run:
 *   npm run export:leads
 *   # or point at a key elsewhere:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/key.json npm run export:leads
 *
 * Output: leads.xlsx  →  double-click to open in Excel, already formatted.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ExcelJS from 'exceljs';

// Columns (order, header text, and pre-set width in Excel character units).
export const COLUMNS = [
	{ header: 'created_at', key: 'created_at', width: 26 },
	{ header: 'business_name', key: 'business_name', width: 22 },
	{ header: 'person_name', key: 'person_name', width: 22 },
	{ header: 'email', key: 'email', width: 42 },
	{ header: 'phone', key: 'phone', width: 18 },
	{ header: 'source', key: 'source', width: 24 },
	{ header: 'id', key: 'id', width: 24 }
];

/**
 * Sort lead records newest-first (created_at is an ISO string → lexicographic
 * sort == chronological). Keeps ALL rows (no deduplication).
 * @param {Array<Record<string, any>>} records
 */
export function sortNewestFirst(records) {
	return records
		.slice()
		.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

/**
 * Build a formatted ExcelJS workbook from lead records.
 * @param {Array<Record<string, any>>} records
 * @returns {ExcelJS.Workbook}
 */
export function buildWorkbook(records) {
	const wb = new ExcelJS.Workbook();
	wb.creator = 'JHAX lead export';

	const ws = wb.addWorksheet('Leads', {
		views: [{ state: 'frozen', ySplit: 1 }] // keep the header visible while scrolling
	});
	ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));

	// Phone column → Excel text, so numbers keep leading zeros and never turn into
	// scientific notation. Set at the column level and per-cell (belt + suspenders).
	ws.getColumn('phone').numFmt = '@';

	// Header styling.
	const header = ws.getRow(1);
	header.font = { bold: true };
	header.alignment = { vertical: 'middle' };
	header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2E9E1' } };
	header.border = { bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } } };

	for (const r of sortNewestFirst(records)) {
		const row = ws.addRow({
			created_at: r.created_at ?? '',
			business_name: r.business_name ?? '',
			person_name: r.person_name ?? '',
			email: r.email ?? '',
			phone: r.phone === null || r.phone === undefined ? '' : String(r.phone),
			source: r.source ?? '',
			id: r.id ?? ''
		});
		row.getCell('phone').numFmt = '@';
	}

	// Filter dropdowns on the header row.
	ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };

	return wb;
}

async function main() {
	const { initializeApp, cert } = await import('firebase-admin/app');
	const { getFirestore } = await import('firebase-admin/firestore');

	const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || resolve('serviceAccountKey.json');
	let serviceAccount;
	try {
		serviceAccount = JSON.parse(readFileSync(keyPath, 'utf-8'));
	} catch {
		console.error(
			`\n[export] Could not read service account key at:\n  ${keyPath}\n\n` +
				`Download it from: Firebase console → jhax-coo → Project settings →\n` +
				`Service accounts → "Generate new private key", save as serviceAccountKey.json,\n` +
				`or set GOOGLE_APPLICATION_CREDENTIALS to its path.\n`
		);
		process.exit(1);
	}

	initializeApp({ credential: cert(serviceAccount) });
	const db = getFirestore();

	const snap = await db.collection('leads').get();
	const records = snap.docs.map((doc) => {
		const d = doc.data();
		return {
			created_at: d.created_at?.toDate ? d.created_at.toDate().toISOString() : '',
			business_name: d.business_name,
			person_name: d.person_name,
			email: d.email,
			phone: d.phone,
			source: d.source,
			id: doc.id
		};
	});

	const wb = buildWorkbook(records);
	await wb.xlsx.writeFile('leads.xlsx');
	console.log(`[export] Wrote ${records.length} lead(s) → leads.xlsx`);
}

// Only connect to Firestore when run directly (so the pure helpers above can be
// imported/tested without credentials).
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
	main().catch((err) => {
		console.error('[export] failed:', err);
		process.exit(1);
	});
}
