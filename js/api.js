/**
 * DemonZ Deployer — GitHub API Wrapper
 * All calls to api.github.com go through here.
 */

const API = (() => {
  const BASE = 'https://api.github.com';
  let _token = null;

  function setToken(t)  { _token = t; }
  function getToken()   { return _token; }
  function clearToken() { _token = null; }

  async function request(method, path, body = null) {
    const headers = { 'Accept': 'application/vnd.github.v3+json' };
    if (_token)  headers['Authorization']  = `token ${_token}`;
    if (body)    headers['Content-Type']   = 'application/json';

    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });

    if (res.status === 204) return null;

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err = new Error(data.message || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }

    return data;
  }

  return {
    setToken,
    getToken,
    clearToken,

    /** Authenticated user profile */
    getUser: () =>
      request('GET', '/user'),

    /** All repos the token can access, sorted by last updated */
    listRepos: (page = 1) =>
      request('GET', `/user/repos?per_page=100&page=${page}&sort=updated&type=all`),

    /** Branches for a repo */
    listBranches: (repo) =>
      request('GET', `/repos/${repo}/branches`),

    /** Create a new repo under the authenticated user */
    createRepo: (name, description, isPrivate) =>
      request('POST', '/user/repos', {
        name,
        description,
        private: isPrivate,
        auto_init: true,
      }),

    /** Get a file's metadata + base64 content */
    getFile: (repo, path, branch = 'main') =>
      request('GET', `/repos/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`),

    /**
     * Create or update a file.
     * @param {string}      content  Base64-encoded content
     * @param {string|null} sha      Required when updating an existing file
     */
    putFile: (repo, path, message, content, sha = null, branch = 'main') => {
      const body = { message, content, branch };
      if (sha) body.sha = sha;
      return request('PUT', `/repos/${repo}/contents/${encodeURIComponent(path)}`, body);
    },
  };
})();
