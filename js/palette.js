/**
 * DemonZ Deployer — Command Palette (v3.0.0)
 *
 * VS Code-style Ctrl+K command palette for quick actions.
 */

const Palette = (() => {
  let _overlay   = null;
  let _input     = null;
  let _list      = null;
  let _commands  = [];
  let _filtered  = [];
  let _activeIdx = 0;
  let _visible   = false;

  function init(overlay) {
    _overlay = overlay;
    _input   = overlay.querySelector('#paletteInput');
    _list    = overlay.querySelector('#paletteList');

    _input.addEventListener('input', _onInput);
    _input.addEventListener('keydown', _onKeydown);
    _overlay.addEventListener('click', (e) => {
      if (e.target === _overlay) hide();
    });
  }

  /**
   * Register commands for the palette.
   * @param {Array} cmds — [{ id, label, icon, category, handler, shortcut? }]
   */
  function register(cmds) {
    _commands = cmds;
  }

  function show() {
    if (!_overlay) return;
    _visible = true;
    _overlay.classList.remove('hidden');
    _input.value = '';
    _activeIdx = 0;
    _filtered = [..._commands];
    _render();
    // Small delay so animation starts properly
    requestAnimationFrame(() => {
      _overlay.classList.add('open');
      _input.focus();
    });
  }

  function hide() {
    if (!_overlay) return;
    _visible = false;
    _overlay.classList.remove('open');
    setTimeout(() => _overlay.classList.add('hidden'), 200);
  }

  function toggle() {
    _visible ? hide() : show();
  }

  function isVisible() { return _visible; }

  /* ── Filtering ── */
  function _onInput() {
    const q = _input.value.toLowerCase().trim();
    _filtered = q
      ? _commands.filter(c =>
          c.label.toLowerCase().includes(q) ||
          (c.category || '').toLowerCase().includes(q)
        )
      : [..._commands];
    _activeIdx = 0;
    _render();
  }

  /* ── Keyboard nav ── */
  function _onKeydown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _activeIdx = Math.min(_activeIdx + 1, _filtered.length - 1);
      _render();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      _activeIdx = Math.max(_activeIdx - 1, 0);
      _render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (_filtered[_activeIdx]) {
        hide();
        _filtered[_activeIdx].handler();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      hide();
    }
  }

  /* ── Render ── */
  function _render() {
    if (!_list) return;
    _list.innerHTML = '';

    if (_filtered.length === 0) {
      _list.innerHTML = '<div class="palette-empty">No matching commands</div>';
      return;
    }

    let lastCat = '';
    _filtered.forEach((cmd, idx) => {
      // Category header
      if (cmd.category && cmd.category !== lastCat) {
        lastCat = cmd.category;
        const catEl = document.createElement('div');
        catEl.className = 'palette-category';
        catEl.textContent = cmd.category;
        _list.appendChild(catEl);
      }

      const item = document.createElement('div');
      item.className = `palette-item${idx === _activeIdx ? ' active' : ''}`;
      item.innerHTML = `
        <i data-lucide="${cmd.icon || 'terminal'}" class="palette-item-icon"></i>
        <span class="palette-item-label">${_esc(cmd.label)}</span>
        ${cmd.shortcut ? `<span class="palette-item-shortcut">${_esc(cmd.shortcut)}</span>` : ''}
      `;
      item.addEventListener('click', () => {
        hide();
        cmd.handler();
      });
      item.addEventListener('mouseenter', () => {
        _activeIdx = idx;
        _render();
      });
      _list.appendChild(item);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [_list] });

    // Scroll active into view
    const activeEl = _list.querySelector('.palette-item.active');
    if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
  }

  function _esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { init, register, show, hide, toggle, isVisible };
})();
