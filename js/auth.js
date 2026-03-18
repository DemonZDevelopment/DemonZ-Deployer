/**
 * DemonZ Deployer — GitHub Device Flow Auth
 *
 * Device Flow works entirely client-side but GitHub's OAuth endpoints
 * block browser CORS. The Cloudflare Worker in /worker/worker.js acts
 * as a transparent CORS proxy — it forwards requests and adds the
 * required Access-Control headers. No secrets are involved.
 *
 * Flow:
 * 1. requestDeviceCode()  →  gets user_code + device_code from GitHub
 * 2. User visits GitHub, enters user_code
 * 3. pollForToken()       →  polls until user approves, returns access_token
 */

const Auth = (() => {
  let _pollTimer = null;
  let _visibilityListener = null;

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
      let isChecking = false; // Prevents overlapping requests if visibility triggers during a poll

      // THE FIX: Extracted polling logic so visibility API can trigger it instantly
      const checkToken = async () => {
        if (isChecking) return;
        isChecking = true;

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
            cancel();
            resolve(data.access_token);
            return;
          }

          switch (data.error) {
            case 'authorization_pending':
            case 'slow_down':
              break; // keep polling
            case 'access_denied':
              cancel();
              reject(new Error('Authorization was denied on GitHub.'));
              break;
            case 'expired_token':
              cancel();
              reject(new Error('The code expired. Please try again.'));
              break;
            default:
              if (data.error) {
                cancel();
                reject(new Error(data.error_description || data.error));
              }
          }
        } catch (err) {
          cancel();
          reject(err);
        } finally {
          isChecking = false;
        }
      };

      // THE FIX: Listen for tab switch to bypass the 5-second timer
      _visibilityListener = () => {
        if (document.visibilityState === 'visible') {
          checkToken();
        }
      };

      document.addEventListener('visibilitychange', _visibilityListener);
      _pollTimer = setInterval(checkToken, ms);
    });
  }

  /* ── Cancel any pending poll and cleanup listeners ── */
  function cancel() {
    if (_pollTimer) { 
      clearInterval(_pollTimer); 
      _pollTimer = null; 
    }
    if (_visibilityListener) {
      document.removeEventListener('visibilitychange', _visibilityListener);
      _visibilityListener = null;
    }
  }

  /* ── Session helpers (THE FIX: Changed to localStorage) ── */
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
    API.clearToken();
  }

  return { requestDeviceCode, pollForToken, cancel, saveSession, loadSession, clearSession };
})();
