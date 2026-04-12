import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';

// Separate worker code from static assets for Wrangler deployment.
// Astro's Cloudflare adapter puts everything in dist/, but Wrangler
// needs the worker entry point and static assets in separate directories.

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
mkdirSync(ASSETS_DIR, { recursive: true });
cpSync(`${DIST}/_astro`, `${ASSETS_DIR}/_astro`, { recursive: true });
cpSync(`${DIST}/favicon.svg`, `${ASSETS_DIR}/favicon.svg`);
cpSync(`${DIST}/index.html`, `${ASSETS_DIR}/index.html`);

console.log('Deploy assets prepared: dist-worker/ and dist-assets/');
