/**
 * DemonZ Deployer — Deployment History Manager (v3.0.0)
 *
 * Persistently tracks all deployments in localStorage.
 */

const History = (() => {
  const STORAGE_KEY = 'dz_deploy_history';

  function _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function _save(entries) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {}
  }

  /**
   * Add a deployment entry.
   * @returns {string} id of the new entry
   */
  function add(entry) {
    const entries = _load();
    const id = `dz_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    entries.unshift({
      id,
      repo:       entry.repo,
      branch:     entry.branch,
      commitSha:  entry.commitSha || null,
      fileName:   entry.fileName || 'workspace.zip',
      fileSize:   entry.fileSize || 0,
      fileCount:  entry.fileCount || 0,
      status:     entry.status || 'pending',  // pending | success | failed
      actionsStatus: null,                     // null | queued | in_progress | completed | failure
      actionsRunId:  null,
      timestamp:  new Date().toISOString(),
      commitMsg:  entry.commitMsg || '',
      deployMode: entry.deployMode || 'merge',
    });

    // Trim to max
    while (entries.length > CONFIG.MAX_HISTORY_ENTRIES) entries.pop();
    _save(entries);
    return id;
  }

  /**
   * Update an existing entry by ID.
   */
  function update(id, updates) {
    const entries = _load();
    const idx = entries.findIndex(e => e.id === id);
    if (idx >= 0) {
      Object.assign(entries[idx], updates);
      _save(entries);
    }
  }

  /**
   * Get all entries.
   */
  function getAll() {
    return _load();
  }

  /**
   * Get a single entry by ID.
   */
  function get(id) {
    return _load().find(e => e.id === id) || null;
  }

  /**
   * Clear all history.
   */
  function clear() {
    _save([]);
  }

  /**
   * Render the history list into a container.
   */
  function render(container, onItemClick) {
    const entries = _load();
    container.innerHTML = '';

    if (entries.length === 0) {
      container.innerHTML = `
        <div class="history-empty">
          <i data-lucide="clock" class="history-empty-icon"></i>
          <span>No deployments yet</span>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [container] });
      return;
    }

    entries.forEach(entry => {
      const el = document.createElement('div');
      el.className = 'history-item';
      el.dataset.id = entry.id;

      const statusClass = entry.status === 'success' ? 'ok' :
                          entry.status === 'failed'  ? 'er' : 'pending';

      const actionsHtml = entry.actionsStatus
        ? `<span class="history-actions-badge ${_actionsBadgeClass(entry.actionsStatus)}">${_actionsLabel(entry.actionsStatus)}</span>`
        : '';

      const timeAgo = _timeAgo(entry.timestamp);
      const sha = entry.commitSha ? entry.commitSha.slice(0, 7) : '—';

      el.innerHTML = `
        <div class="history-item-left">
          <div class="history-status-dot ${statusClass}"></div>
          <div class="history-item-info">
            <div class="history-item-repo">${_esc(entry.repo)}</div>
            <div class="history-item-meta">
              <span>${_esc(entry.branch)}</span>
              <span class="history-sep">·</span>
              <span>${sha}</span>
              <span class="history-sep">·</span>
              <span>${timeAgo}</span>
            </div>
          </div>
        </div>
        <div class="history-item-right">
          ${actionsHtml}
          <i data-lucide="chevron-right" class="history-chevron"></i>
        </div>
      `;

      el.addEventListener('click', () => {
        if (onItemClick) onItemClick(entry);
      });

      container.appendChild(el);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [container] });
  }

  /* ── Helpers ── */
  function _timeAgo(iso) {
    try {
      const diff = Date.now() - new Date(iso).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      const days = Math.floor(hrs / 24);
      return `${days}d ago`;
    } catch { return '—'; }
  }

  function _actionsBadgeClass(status) {
    const map = { completed: 'ok', success: 'ok', failure: 'er', cancelled: 'er',
                  in_progress: 'active', queued: 'pending' };
    return map[status] || 'pending';
  }

  function _actionsLabel(status) {
    const map = { completed: '✓ Actions', success: '✓ Actions', failure: '✗ Actions',
                  cancelled: '⊘ Cancelled', in_progress: '⟳ Running', queued: '⏳ Queued' };
    return map[status] || status;
  }

  function _esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { add, update, get, getAll, clear, render };
})();
