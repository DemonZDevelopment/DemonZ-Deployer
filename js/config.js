/**
 * DemonZ Deployer — Configuration
 *
 * SETUP REQUIRED:
 * 1. Create a GitHub OAuth App at:
 * https://github.com/settings/developers → OAuth Apps → New OAuth App
 * - Homepage URL:            https://<your-username>.github.io/DemonZ-Deployer/
 * - Authorization callback:  (same URL — device flow doesn't use it, but GitHub requires it)
 * - Copy the CLIENT_ID below (do NOT copy the client secret — device flow never needs it)
 *
 * 2. Deploy worker/worker.js to Cloudflare Workers (free):
 * https://workers.cloudflare.com
 * - Paste the worker code, deploy, copy the *.workers.dev URL into PROXY_URL below
 *
 * That's it. No backend, no secrets exposed.
 */

const CONFIG = Object.freeze({
  // ── Required ───────────────────────────────────────────────
  CLIENT_ID:     'Ov23liFAyEj9YNz0XrRN',
  PROXY_URL:     'https://demonzdeployer.demonzdevelopment.workers.dev',

  // ── Fixed — do not change ──────────────────────────────────
  DEPLOYER_REPO:  'DemonZDevelopment/DemonZ-Deployer',
  WORKFLOW_PATH:  '.github/workflows/deployer-pipeline.yml',
  
  // THE FIX: Added 'workflow' so GitHub allows pipeline installation
  SCOPES:         'repo,workflow', 
  
  POLL_INTERVAL:  5,   // seconds — GitHub minimum is 5
});
