/**
 * DemonZ Deployer — Configuration (v3.0.0 "Command Center")
 *
 * SETUP REQUIRED:
 * 1. Create (or update) a GitHub OAuth App at:
 *    https://github.com/settings/developers → OAuth Apps
 *
 *    Required settings:
 *    - Homepage URL:              https://<your-username>.github.io/DemonZ-Deployer/
 *    - Authorization callback URL: https://<your-username>.github.io/DemonZ-Deployer/
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
  // ── App version ────────────────────────────────────────────
  VERSION: '3.0.0',

  // ── Required — fill these in ───────────────────────────────
  CLIENT_ID:  'Ov23liFAyEj9YNz0XrRN',
  PROXY_URL:  'https://demonzdeployer.demonzdevelopment.workers.dev',

  // ── Fixed — do not change ──────────────────────────────────
  DEPLOYER_REPO: 'DemonZDevelopment/DemonZ-Deployer',
  WORKFLOW_PATH: '.github/workflows/deployer-pipeline.yml',
  SCOPES:        'repo,workflow',

  // ── Pipeline version tracking ──────────────────────────────
  // The deployer-pipeline.yml contains a tag like:
  //   # DZ_PIPELINE_VERSION=3.0.0
  // This is used to detect outdated pipelines in user repos.
  PIPELINE_VERSION:     '3.0.0',
  PIPELINE_VERSION_TAG: 'DZ_PIPELINE_VERSION',

  // ── Defaults ───────────────────────────────────────────────
  DEFAULT_COMMIT_MSG: 'build(sync): update workspace via DemonZ Deployer',
  MAX_HISTORY_ENTRIES: 50,
  ACTIONS_POLL_INTERVAL: 5000,  // ms between Actions status polls
  ACTIONS_POLL_TIMEOUT:  300000, // stop polling after 5 minutes
});
