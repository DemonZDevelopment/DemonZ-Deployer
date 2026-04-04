/**
 * DemonZ Deployer — GitHub API Wrapper (v3.0.0)
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

    let res;
    try {
      res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null,
      });
    } catch (networkErr) {
      const err = new Error(`Network error: ${networkErr.message}. Check your connection.`);
      err.status = 0;
      throw err;
    }

    if (res.status === 204) return null;

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err = new Error(data.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.response = data;
      throw err;
    }

    return data;
  }

  /* ── Paginated fetch — loads all pages ── */
  async function requestAllPages(path, maxPages = 10) {
    const results = [];
    for (let page = 1; page <= maxPages; page++) {
      const separator = path.includes('?') ? '&' : '?';
      const data = await request('GET', `${path}${separator}per_page=100&page=${page}`);
      if (!Array.isArray(data) || data.length === 0) break;
      results.push(...data);
      if (data.length < 100) break;
    }
    return results;
  }

  return {
    setToken,
    getToken,
    clearToken,

    // ── User ──
    getUser: () =>
      request('GET', '/user'),

    // ── Repos ── (full pagination)
    listRepos: () =>
      requestAllPages('/user/repos?sort=updated&type=all'),

    // ── Repo details ──
    getRepoDetails: (repo) =>
      request('GET', `/repos/${repo}`),

    // ── Branches ──
    listBranches: (repo) =>
      requestAllPages(`/repos/${repo}/branches`),

    getBranchDetails: (repo, branch) =>
      request('GET', `/repos/${repo}/branches/${encodeURIComponent(branch)}`),

    createBranch: (repo, branchName, sha) =>
      request('POST', `/repos/${repo}/git/refs`, {
        ref: `refs/heads/${branchName}`,
        sha,
      }),

    // ── Commits ──
    listCommits: (repo, branch = 'main', perPage = 5) =>
      request('GET', `/repos/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=${perPage}`),

    // ── Repo creation ──
    createRepo: (name, description, isPrivate) =>
      request('POST', '/user/repos', {
        name,
        description,
        private: isPrivate,
        auto_init: true,
      }),

    // ── File operations ──
    getFile: (repo, path, branch = 'main') =>
      request('GET', `/repos/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`),

    putFile: (repo, path, message, content, sha = null, branch = 'main') => {
      const body = { message, content, branch };
      if (sha) body.sha = sha;
      return request('PUT', `/repos/${repo}/contents/${encodeURIComponent(path)}`, body);
    },

    // ── GitHub Actions ──
    listWorkflowRuns: (repo, perPage = 5) =>
      request('GET', `/repos/${repo}/actions/runs?per_page=${perPage}`),

    getWorkflowRun: (repo, runId) =>
      request('GET', `/repos/${repo}/actions/runs/${runId}`),

    getJobsForRun: (repo, runId) =>
      request('GET', `/repos/${repo}/actions/runs/${runId}/jobs`),

    triggerWorkflowDispatch: (repo, workflowId, ref, inputs = {}) =>
      request('POST', `/repos/${repo}/actions/workflows/${workflowId}/dispatches`, {
        ref,
        inputs,
      }),

    // ── Issues (for dashboard) ──
    getIssueCount: (repo) =>
      request('GET', `/repos/${repo}/issues?state=open&per_page=1`),
  };
})();
