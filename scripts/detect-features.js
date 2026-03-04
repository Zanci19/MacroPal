#!/usr/bin/env node
/**
 * MacroPal — Feature Detection Script
 * =====================================
 * Scans App.tsx for every <Route> path and then checks whether a matching
 * Cypress test exists in cypress/e2e/. Prints a coverage report so you can
 * see which routes have E2E tests and which ones are still missing coverage.
 *
 * Usage:
 *   node scripts/detect-features.js
 *
 * Output example:
 *   ✅  /login               → cypress/e2e/app.cy.ts
 *   ❌  /new-feature         → no Cypress test found
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

// ── 1. Extract routes from App.tsx ─────────────────────────────────────────

const appTsx = readFileSync(join(REPO_ROOT, 'src', 'App.tsx'), 'utf8');

// Match both:
//   path="/some/route"
//   path='/some/route'
const routeRegex = /\bpath=["']([^"']+)["']/g;
const routes = new Set();
let match;
while ((match = routeRegex.exec(appTsx)) !== null) {
  const p = match[1];
  // Skip regex-like or parameter-only paths
  if (p && !p.startsWith(':')) {
    routes.add(p);
  }
}

// ── 2. Read all Cypress test files ─────────────────────────────────────────

const e2eDir = join(REPO_ROOT, 'cypress', 'e2e');
let cyFiles = [];
try {
  cyFiles = readdirSync(e2eDir)
    .filter((f) => f.endsWith('.cy.ts') || f.endsWith('.cy.js'))
    .map((f) => ({ name: f, content: readFileSync(join(e2eDir, f), 'utf8') }));
} catch {
  console.warn('⚠️  Could not read cypress/e2e directory.');
}

// ── 3. For each route, check if any Cypress file references it ─────────────

const results = [];
for (const route of [...routes].sort()) {
  // A Cypress test references a route if it contains the path string
  const coveringFile = cyFiles.find((f) => f.content.includes(route));
  results.push({ route, coveringFile: coveringFile?.name ?? null });
}

// ── 4. Print report ────────────────────────────────────────────────────────

const covered = results.filter((r) => r.coveringFile);
const missing = results.filter((r) => !r.coveringFile);

console.log('\n══════════════════════════════════════════════════════════════');
console.log('  MacroPal — Feature / Route Coverage Report');
console.log(`  Scanned: src/App.tsx   |   Cypress: cypress/e2e/`);
console.log('══════════════════════════════════════════════════════════════\n');

if (results.length === 0) {
  console.log('No <Route path=…> entries found in App.tsx.');
} else {
  for (const { route, coveringFile } of results) {
    if (coveringFile) {
      console.log(`  ✅  ${route.padEnd(36)} → ${coveringFile}`);
    } else {
      console.log(`  ❌  ${route.padEnd(36)} → no Cypress test found`);
    }
  }
}

console.log('\n──────────────────────────────────────────────────────────────');
console.log(`  Total routes  : ${results.length}`);
console.log(`  Covered       : ${covered.length}`);
console.log(`  Missing tests : ${missing.length}`);
console.log('──────────────────────────────────────────────────────────────\n');

if (missing.length > 0) {
  console.log('Routes without Cypress tests:');
  missing.forEach(({ route }) => console.log(`  • ${route}`));
  console.log(
    '\nTip: add a test block to cypress/e2e/app.cy.ts for each missing route.'
  );
  console.log();
}

// Exit with code 1 if any routes are uncovered (useful for CI)
process.exit(missing.length > 0 ? 1 : 0);
