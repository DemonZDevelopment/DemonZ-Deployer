/**
 * DemonZ Deployer — Terminal UI (v3.0.0)
 */

const Terminal = (() => {
  let _el      = null;
  let _cursor  = null;

  const TAG_MAP = {
    ok: ['ok', 'OK'],
    er: ['er', 'ERR'],
    in: ['in', 'INF'],
    wn: ['wn', 'WRN'],
  };

  function init(el) {
    _el = el;
    _appendCursor();
    log(`DemonZ Deployer v${CONFIG.VERSION} ready. Session persists across tabs.`, 'sys', 'in');
  }

  function _ts() {
    return new Date().toTimeString().slice(0, 8);
  }

  function _esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function _appendCursor() {
    _cursor = document.createElement('span');
    _cursor.className = 'term-cursor';
    _el.appendChild(_cursor);
  }

  function log(msg, type = 'info', tag = null) {
    if (!_el) return;
    if (_cursor) _cursor.remove();

    const tagHtml = tag
      ? `<span class="log-tag ${TAG_MAP[tag]?.[0] || ''}">${TAG_MAP[tag]?.[1] || tag}</span>`
      : '';

    const line = document.createElement('div');
    line.className = `log ${type}`;
    line.innerHTML = `
      <span class="log-ts">${_ts()}</span>
      <span class="log-sym">›</span>
      <span class="log-txt">${tagHtml}${_esc(msg)}</span>
    `;

    _el.appendChild(line);
    _appendCursor();
    _el.scrollTop = _el.scrollHeight;
  }

  function clear() {
    if (!_el) return;
    _el.innerHTML = '';
    _appendCursor();
    log('Terminal cleared.', 'sys');
  }

  function copyAll() {
    if (!_el) return;
    const lines = Array.from(_el.querySelectorAll('.log-txt'))
      .map(el => el.textContent.trim())
      .filter(Boolean);
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
  }

  return { init, log, clear, copyAll };
})();
