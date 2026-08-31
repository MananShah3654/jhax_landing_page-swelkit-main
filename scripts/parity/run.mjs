/**
 * Calculation-parity test: runs the ORIGINAL Python heuristics (scripts/parity/
 * py_ref.py) over a large deterministic grid of inputs, recomputes each with the
 * SvelteKit port, and asserts byte-identical results. Exits non-zero on any
 * mismatch. Run with:  npm run parity
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { estimateHealthScore, estimateMoneyLostWeekly } from '../../src/lib/audit/heuristics.js';
import { seededMetrics } from '../../src/lib/audit/seeded.js';

const here = dirname(fileURLToPath(import.meta.url));
const pyScript = resolve(here, 'py_ref.py');

function runPython() {
	for (const bin of ['python', 'python3', 'py']) {
		const r = spawnSync(bin, [pyScript], { encoding: 'utf-8', maxBuffer: 256 * 1024 * 1024 });
		if (r.status === 0 && r.stdout) return JSON.parse(r.stdout);
		if (r.error && r.error.code === 'ENOENT') continue;
		if (r.status !== 0) {
			console.error(`[parity] ${bin} failed:\n${r.stderr || r.error}`);
		}
	}
	throw new Error('Could not run py_ref.py with python/python3/py');
}

const ref = runPython();

let checked = 0;
const mismatches = [];

for (const row of ref.health_money) {
	const health = estimateHealthScore(row.rating, row.review_count);
	const money = estimateMoneyLostWeekly(row.rating, row.review_count);
	checked += 2;
	if (health !== row.health) {
		mismatches.push(
			`health(rating=${row.rating}, reviews=${row.review_count}) JS=${health} PY=${row.health}`
		);
	}
	if (money !== row.money) {
		mismatches.push(
			`money(rating=${row.rating}, reviews=${row.review_count}) JS=${money} PY=${row.money}`
		);
	}
}

for (const row of ref.seeded) {
	const [rating, reviewCount] = await seededMetrics(row.key);
	checked += 2;
	if (rating !== row.rating) {
		mismatches.push(`seeded.rating(key=${JSON.stringify(row.key)}) JS=${rating} PY=${row.rating}`);
	}
	if (reviewCount !== row.review_count) {
		mismatches.push(
			`seeded.reviews(key=${JSON.stringify(row.key)}) JS=${reviewCount} PY=${row.review_count}`
		);
	}
}

console.log(
	`[parity] health/money cases: ${ref.health_money.length}, seeded keys: ${ref.seeded.length}`
);
console.log(`[parity] total value comparisons: ${checked}`);

if (mismatches.length) {
	console.error(`\n[parity] FAIL — ${mismatches.length} mismatch(es):`);
	for (const m of mismatches.slice(0, 40)) console.error('  ' + m);
	if (mismatches.length > 40) console.error(`  … and ${mismatches.length - 40} more`);
	process.exit(1);
}

console.log('\n[parity] PASS — SvelteKit heuristics are byte-identical to the original Python backend.');
