/**
 * DemonZ Deployer — GitHub Device Flow Auth
 *
 * Device Flow works entirely client-side but GitHub's OAuth endpoints
 * block browser CORS. The Cloudflare Worker in /worker/worker.js acts
 * as a transparent CORS proxy — it forwards requests and adds the
 * required Access-Control headers. No secrets are involved.
 *
 * Flow:
 *  1. requestDeviceCode()  →  gets user_code + device_code from GitHub
 *  2. User visits GitHub, enters user_code
 *  3. pollForToken()       →  polls until user approves, returns access_token
 */

const Auth = (() => {
  let _pollTimer = null;

  /* ── Request device + user codes from GitHub via proxy ── */
  async function requestDeviceCode() {
    const res = await fetch(`${CONFIG.PROXY_URL}/device/code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CONFIG.CLIENT_ID,
        scope: CONFIG.SCOPES,
      }),
    });

    if (!res.ok) throw new Error(`Proxy error ${res.status} — check your PROXY_URL in config.js`);

    const data = await res.json();
    if (data.error) throw new Error(data.error_description || data.error);
    return data; // { device_code, user_code, verification_uri, expires_in, interval }
  }

  /* ── Poll until the user approves (or it expires/is denied) ── */
  function pollForToken(deviceCode, intervalSec) {
    return new Promise((resolve, reject) => {
      const ms = Math.max((intervalSec || CONFIG.POLL_INTERVAL), 5) * 1000;

      _pollTimer = setInterval(async () => {
        try {
          const res = await fetch(`${CONFIG.PROXY_URL}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id:   CONFIG.CLIENT_ID,
              device_code: deviceCode,
              grant_type:  'urn:ietf:params:oauth:grant-type:device_code',
            }),
          });

          const data = await res.json();

          if (data.access_token) {
            clearInterval(_pollTimer);
            resolve(data.access_token);
            return;
          }

          switch (data.error) {
            case 'authorization_pending':
              break; // keep polling
            case 'slow_down':
              // GitHub is asking us to slow down — handled via interval already
              break;
            case 'access_denied':
              clearInterval(_pollTimer);
              reject(new Error('Authorization was denied on GitHub.'));
              break;
            case 'expired_token':
              clearInterval(_pollTimer);
              reject(new Error('The code expired. Please try again.'));
              break;
            default:
              if (data.error) {
                clearInterval(_pollTimer);
                reject(new Error(data.error_description || data.error));
              }
          }
        } catch (err) {
          clearInterval(_pollTimer);
          reject(err);
        }
      }, ms);
    });
  }

  /* ── Cancel any pending poll ── */
  function cancel() {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  }

  /* ── Session helpers (sessionStorage clears on tab close) ── */
  function saveSession(token, user) {
    sessionStorage.setItem('dz_token', token);
    sessionStorage.setItem('dz_user',  JSON.stringify(user));
  }

  function loadSession() {
    const token   = sessionStorage.getItem('dz_token');
    const userStr = sessionStorage.getItem('dz_user');
    if (!token || !userStr) return null;
    try { return { token, user: JSON.parse(userStr) }; }
    catch { return null; }
  }

  function clearSession() {
    sessionStorage.removeItem('dz_token');
    sessionStorage.removeItem('dz_user');
    API.clearToken();
  }

  return { requestDeviceCode, pollForToken, cancel, saveSession, loadSession, clearSession };
})();
