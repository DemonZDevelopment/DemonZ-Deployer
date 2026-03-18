/**
 * DemonZ Deployer — Configuration (v2.0.3)
 *
 * SETUP REQUIRED:
 * 1. Create (or update) a GitHub OAuth App at:
 *    https://github.com/settings/developers → OAuth Apps
 *
 *    Required settings for v2.0.3 Web Application Flow:
 *    - Homepage URL:              https://<your-username>.github.io/DemonZ-Deployer/
 *    - Authorization callback URL: https://<your-username>.github.io/DemonZ-Deployer/
 *      ↑ This was unused by Device Flow but is now actively required.
 *
 *    Copy your CLIENT_ID below. Do NOT put your Client Secret here —
 *    it lives exclusively in the Cloudflare Worker as an env variable.
 *
 * 2. Deploy worker/worker.js to Cloudflare Workers:
 *    https://workers.cloudflare.com
 *    - Add CLIENT_SECRET as an encrypted Secret in Worker Settings → Variables
 *    - Copy the *.workers.dev URL into PROXY_URL below
 *
 * That's it. No backend server. Client secret never exposed to the browser.
 */

const CONFIG = Object.freeze({
  // ── Required — fill these in ───────────────────────────────
  CLIENT_ID:  'Ov23liFAyEj9YNz0XrRN',
  PROXY_URL:  'https://demonzdeployer.demonzdevelopment.workers.dev',

  // ── Fixed — do not change ──────────────────────────────────
  DEPLOYER_REPO: 'DemonZDevelopment/DemonZ-Deployer',
  WORKFLOW_PATH: '.github/workflows/deployer-pipeline.yml',
  SCOPES:        'repo,workflow',
});
