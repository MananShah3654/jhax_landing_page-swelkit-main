/**
 * Copy the shared Maps-link modules from src/lib into functions/shared/.
 *
 * Firebase deploys the functions/ directory in isolation — it cannot reach up into
 * src/ — but we refuse to keep two copies of the resolver by hand. This script runs
 * as the functions `predeploy` hook in firebase.json, so every deploy ships exactly
 * what dev just ran. The destination layout preserves the relative import
 * (`../audit/mapsLink.js`) that resolveMapsLink.js uses.
 *
 *   npm run sync:functions
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const FILES = [
	['src/lib/audit/mapsLink.js', 'functions/shared/audit/mapsLink.js'],
	['src/lib/server/resolveMapsLink.js', 'functions/shared/server/resolveMapsLink.js'],
	['src/lib/server/auditFindings.js', 'functions/shared/server/auditFindings.js']
];

const BANNER =
	'/* AUTO-GENERATED — do not edit. Copied from %SRC% by scripts/sync-functions-shared.mjs. */\n';

for (const [from, to] of FILES) {
	const src = resolve(root, from);
	const dest = resolve(root, to);
	mkdirSync(dirname(dest), { recursive: true });
	writeFileSync(dest, BANNER.replace('%SRC%', from) + readFileSync(src, 'utf-8'), 'utf-8');
	console.log(`[sync-functions] ${from} -> ${to}`);
}
