import { cpSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Separate worker code from static assets for Wrangler deployment.
// Mirrors PackSmart's pattern: assets preserve the full base path structure.

const DIST = 'dist';
const ASSETS_DIR = 'dist-assets';
const WORKER_DIR = 'dist-worker';

// Clean previous output
if (existsSync(ASSETS_DIR)) rmSync(ASSETS_DIR, { recursive: true });
if (existsSync(WORKER_DIR)) rmSync(WORKER_DIR, { recursive: true });

// Copy worker code
mkdirSync(WORKER_DIR, { recursive: true });
cpSync(`${DIST}/_worker.js`, `${WORKER_DIR}/_worker.js`, { recursive: true });

// Copy static assets (everything except _worker.js and _routes.json)
// The dist/ directory contains tools/seo-check/ with the static files
// because of the Astro base path config. We preserve this structure.
mkdirSync(ASSETS_DIR, { recursive: true });
for (const entry of readdirSync(DIST)) {
  if (entry === '_worker.js' || entry === '_routes.json') continue;
  cpSync(join(DIST, entry), join(ASSETS_DIR, entry), { recursive: true });
}

console.log('Deploy assets prepared: dist-worker/ and dist-assets/');
