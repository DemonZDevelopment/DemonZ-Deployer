/**
 * DemonZ Deployer — Keyboard Shortcuts (v3.0.0)
 */

const Shortcuts = (() => {
  const _bindings = [];
  let _enabled = true;

  function init() {
    document.addEventListener('keydown', _handler);
  }

  /**
   * Register a keyboard shortcut.
   * @param {object} opts
   * @param {string} opts.key       — Key value (e.g. 'k', 'd', 'Escape')
   * @param {boolean} opts.ctrl     — Require Ctrl/Cmd
   * @param {boolean} opts.shift    — Require Shift
   * @param {string}  opts.label    — Human-readable label (for palette)
   * @param {string}  opts.category — Category grouping
   * @param {Function} opts.handler — Callback
   */
  function bind(opts) {
    _bindings.push({
      key:      opts.key.toLowerCase(),
      ctrl:     !!opts.ctrl,
      shift:    !!opts.shift,
      label:    opts.label || '',
      category: opts.category || 'General',
      handler:  opts.handler,
    });
  }

  function _handler(e) {
    if (!_enabled) return;

    // Don't capture when typing in inputs/textareas (unless Escape)
    const tag = (e.target.tagName || '').toLowerCase();
    const isInput = tag === 'input' || tag === 'textarea' || tag === 'select';

    for (const b of _bindings) {
      const ctrlMatch = b.ctrl ? (e.ctrlKey || e.metaKey) : true;
      const shiftMatch = b.shift ? e.shiftKey : true;
      const keyMatch = e.key.toLowerCase() === b.key;

      if (keyMatch && ctrlMatch && shiftMatch) {
        // Allow Escape even in inputs
        if (isInput && e.key !== 'Escape' && !b.ctrl) continue;
        e.preventDefault();
        e.stopPropagation();
        b.handler(e);
        return;
      }
    }
  }

  function getBindings() {
    return _bindings.map(b => ({
      key: b.key,
      ctrl: b.ctrl,
      shift: b.shift,
      label: b.label,
      category: b.category,
    }));
  }

  function setEnabled(v) { _enabled = v; }

  return { init, bind, getBindings, setEnabled };
})();
