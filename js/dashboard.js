/**
 * DemonZ Deployer — Repository Dashboard (v3.0.0)
 *
 * Shows repo stats, recent commits, and quick-access links
 * after a repository is selected.
 */

const Dashboard = (() => {

  /**
   * Load dashboard data for a repo.
   * @param {string} repo — owner/repo
   * @param {string} branch — default branch name
   * @returns {Promise<DashboardData>}
   */
  async function load(repo, branch) {
    const [details, commits] = await Promise.allSettled([
      API.getRepoDetails(repo),
      API.listCommits(repo, branch, 5),
    ]);

    return {
      repo,
      details: details.status === 'fulfilled' ? details.value : null,
      commits: commits.status === 'fulfilled' ? commits.value : [],
    };
  }

  /**
   * Render the dashboard into a container.
   */
  function render(container, data) {
    if (!container || !data) return;
    container.innerHTML = '';

    const d = data.details;
    const commits = data.commits || [];

    // Stats cards
    const statsHtml = `
      <div class="dash-stats">
        <div class="dash-stat">
          <div class="dash-stat-value">${d ? _fmtSize(d.size) : '—'}</div>
          <div class="dash-stat-label">Size</div>
        </div>
        <div class="dash-stat">
          <div class="dash-stat-value">${d ? (d.stargazers_count || 0) : '—'}</div>
          <div class="dash-stat-label">Stars</div>
        </div>
        <div class="dash-stat">
          <div class="dash-stat-value">${d ? (d.open_issues_count || 0) : '—'}</div>
          <div class="dash-stat-label">Issues</div>
        </div>
        <div class="dash-stat">
          <div class="dash-stat-value">${d ? (d.forks_count || 0) : '—'}</div>
          <div class="dash-stat-label">Forks</div>
        </div>
      </div>
    `;

    // Quick links
    const linksHtml = d ? `
      <div class="dash-links">
        <a href="${d.html_url}" target="_blank" rel="noopener" class="dash-link">
          <i data-lucide="external-link"></i> Repository
        </a>
        <a href="${d.html_url}/issues" target="_blank" rel="noopener" class="dash-link">
          <i data-lucide="circle-dot"></i> Issues
        </a>
        <a href="${d.html_url}/pulls" target="_blank" rel="noopener" class="dash-link">
          <i data-lucide="git-pull-request"></i> PRs
        </a>
        <a href="${d.html_url}/actions" target="_blank" rel="noopener" class="dash-link">
          <i data-lucide="play"></i> Actions
        </a>
      </div>
    ` : '';

    // Recent commits
    let commitsHtml = '';
    if (commits.length > 0) {
      commitsHtml = `
        <div class="dash-commits-label">Recent Commits</div>
        <div class="dash-commits">
          ${commits.map(c => {
            const sha = c.sha?.slice(0, 7) || '—';
            const msg = _esc(_truncate(c.commit?.message?.split('\n')[0] || '—', 60));
            const author = _esc(c.commit?.author?.name || c.author?.login || '—');
            const date = _timeAgo(c.commit?.author?.date);
            return `
              <a class="dash-commit" href="${c.html_url || '#'}" target="_blank" rel="noopener">
                <span class="dash-commit-sha">${sha}</span>
                <span class="dash-commit-msg">${msg}</span>
                <span class="dash-commit-meta">${author} · ${date}</span>
              </a>
            `;
          }).join('')}
        </div>
      `;
    }

    container.innerHTML = statsHtml + linksHtml + commitsHtml;

    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [container] });
  }

  /* ── Helpers ── */
  function _fmtSize(sizeKB) {
    if (!sizeKB) return '—';
    if (sizeKB < 1024) return `${sizeKB} KB`;
    return `${(sizeKB / 1024).toFixed(1)} MB`;
  }

  function _timeAgo(dateStr) {
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      const days = Math.floor(hrs / 24);
      if (days < 30) return `${days}d ago`;
      return new Date(dateStr).toLocaleDateString();
    } catch { return '—'; }
  }

  function _truncate(str, len) {
    if (str.length <= len) return str;
    return str.slice(0, len - 1) + '…';
  }

  function _esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { load, render };
})();
