// Run against `npm run dev -- --port 4193 --strictPort`, never a build preview.
// Reuses all production focus/save/navigation cases with a real replay guard.
if (!process.env.QA_DEV_URL) {
  throw new Error('Set QA_DEV_URL to the development server (not QA_URL)');
}
process.env.QA_URL = process.env.QA_DEV_URL;
process.env.QA_STRICT_MODE = '1';
await import('./qa-focus.mjs');
