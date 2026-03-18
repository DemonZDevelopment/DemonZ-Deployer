/**
 * DemonZ Deployer — GitHub Auth (v2.0.3 — Web Application Flow)
 *
 * UPGRADE FROM v2.0.2:
 *   Device Flow has been deprecated. Auth is now a standard OAuth 2.0
 *   Authorization Code Grant ("Web Application Flow") — the same pattern
 *   used by Discord, Notion, and every other modern OAuth app.
 *
 * Flow:
 *   1. startOAuthRedirect()
 *      Builds the GitHub authorize URL and redirects the entire browser tab.
 *
 *   2. GitHub authenticates the user and redirects back to the app with:
 *      https://your-app-url/?code=TEMP_CODE&state=RANDOM
 *
 *   3. app.js detects the ?code= parameter on init and calls:
 *      exchangeCode(code, state) → POST to Cloudflare Worker /exchange endpoint
 *      The Worker injects CLIENT_SECRET server-side and returns access_token.
 *
 *   4. Token is saved to localStorage. URL is cleaned via replaceState.
 *
 * Security:
 *   - CLIENT_SECRET never appears in any frontend file.
 *   - A random `state` param is generated and validated to prevent CSRF.
 *   - The Worker enforces origin whitelist + rate limiting on /exchange.
 */

const Auth = (() => {

  // localStorage key for the CSRF state value
  const STATE_KEY = 'dz_oauth_state';

  /* ── Build a cryptographically random state string ── */
  function _generateState() {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Step 1 — Redirect the browser to GitHub's authorization page.
   * A random `state` value is saved to localStorage so we can validate
   * it when GitHub redirects back (CSRF protection).
   */
  function startOAuthRedirect() {
    const state = _generateState();
    localStorage.setItem(STATE_KEY, state);

    const params = new URLSearchParams({
      client_id: CONFIG.CLIENT_ID,
      scope:     CONFIG.SCOPES,
      state,
      // redirect_uri is omitted — GitHub uses the URL registered in the OAuth App.
      // If you need dynamic redirect (e.g. local dev), add it here AND in the Worker call.
    });

    window.location.href = `https://github.com/login/oauth/authorize?${params}`;
  }

  /**
   * Step 3 — Exchange the temporary code for a permanent access_token.
   * Called by app.js when it detects ?code= in the URL on init.
   *
   * @param   {string} code   The short-lived code from GitHub's redirect
   * @param   {string} state  The state value from GitHub's redirect
   * @returns {string}        The access_token
   * @throws  {Error}         On CSRF mismatch, network error, or GitHub error
   */
  async function exchangeCode(code, state) {
    // ── CSRF validation ──
    const savedState = localStorage.getItem(STATE_KEY);
    localStorage.removeItem(STATE_KEY); // consume immediately — one-time use

    if (!savedState || savedState !== state) {
      throw new Error('OAuth state mismatch — possible CSRF attack. Please try logging in again.');
    }

    // ── Send code to Cloudflare Worker for secure server-side exchange ──
    const res = await fetch(`${CONFIG.PROXY_URL}/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CONFIG.CLIENT_ID,
        code,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Worker error ${res.status}`);
    }

    const data = await res.json();

    // GitHub returns `error` as a field even on HTTP 200 for OAuth failures
    if (data.error) {
      throw new Error(data.error_description || data.error);
    }

    if (!data.access_token) {
      throw new Error('No access_token in Worker response — check CLIENT_SECRET binding.');
    }

    return data.access_token;
  }

  /* ── Session helpers ── */

  function saveSession(token, user) {
    localStorage.setItem('dz_token', token);
    localStorage.setItem('dz_user',  JSON.stringify(user));
  }

  function loadSession() {
    const token   = localStorage.getItem('dz_token');
    const userStr = localStorage.getItem('dz_user');
    if (!token || !userStr) return null;
    try { return { token, user: JSON.parse(userStr) }; }
    catch { return null; }
  }

  function clearSession() {
    localStorage.removeItem('dz_token');
    localStorage.removeItem('dz_user');
    localStorage.removeItem(STATE_KEY);
    API.clearToken();
  }

  return { startOAuthRedirect, exchangeCode, saveSession, loadSession, clearSession };
})();
