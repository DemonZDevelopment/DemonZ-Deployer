/**
 * DemonZ Deployer — Notifications, Sounds & Toasts (v3.0.0)
 *
 * Professional Aternos-style sound design using Web Audio API.
 * Zero external audio files — all sounds are synthesized.
 */

const Notify = (() => {
  let _audioCtx    = null;
  let _soundOn     = true;
  let _toastContainer = null;
  const PREF_KEY   = 'dz_sound_enabled';

  /* ════════════════════════════ INIT ══ */
  function init(toastContainer) {
    _toastContainer = toastContainer;
    _soundOn = localStorage.getItem(PREF_KEY) !== 'false';
  }

  function _ensureAudioCtx() {
    if (!_audioCtx) {
      try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch { _soundOn = false; }
    }
    if (_audioCtx && _audioCtx.state === 'suspended') {
      _audioCtx.resume().catch(() => {});
    }
    return _audioCtx;
  }

  /* ════════════════════════════ SOUND DESIGN ══ */

  /**
   * Deploy Start — subtle low-to-high frequency sweep (200ms)
   * Feels like "powering up"
   */
  function playDeployStart() {
    if (!_soundOn) return;
    const ctx = _ensureAudioCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  }

  /**
   * Deploy Success — satisfying two-tone ascending chime (Aternos-style)
   * Two clean notes: C5 → E5 with slight overlap
   */
  function playSuccess() {
    if (!_soundOn) return;
    const ctx = _ensureAudioCtx();
    if (!ctx) return;
    try {
      // Note 1: C5 (523 Hz)
      const osc1 = ctx.createOscillator();
      const g1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.value = 523.25;
      g1.gain.setValueAtTime(0, ctx.currentTime);
      g1.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.02);
      g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc1.connect(g1).connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.4);

      // Note 2: E5 (659 Hz) — starts 150ms after note 1
      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.value = 659.25;
      g2.gain.setValueAtTime(0, ctx.currentTime + 0.15);
      g2.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.17);
      g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc2.connect(g2).connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.15);
      osc2.stop(ctx.currentTime + 0.6);
    } catch {}
  }

  /**
   * Deploy Failure — soft descending buzz
   * Low rumble with slight distortion feel
   */
  function playFailure() {
    if (!_soundOn) return;
    const ctx = _ensureAudioCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(330, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch {}
  }

  /**
   * Action Complete — single clean ping
   * Used for button confirmations, copy events, etc.
   */
  function playPing() {
    if (!_soundOn) return;
    const ctx = _ensureAudioCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch {}
  }

  /* ── Sound toggle ── */
  function isSoundOn() { return _soundOn; }
  function toggleSound() {
    _soundOn = !_soundOn;
    localStorage.setItem(PREF_KEY, _soundOn);
    return _soundOn;
  }

  /* ════════════════════════════ BROWSER NOTIFICATIONS ══ */
  async function requestPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }

  function send(title, body, icon = null) {
    try {
      if (!('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;
      new Notification(title, {
        body,
        icon: icon || 'assets/deployer.jpg',
        badge: 'assets/deployer.jpg',
        silent: true,
      });
    } catch {}
  }

  /* ════════════════════════════ TOAST SYSTEM ══ */
  function toast(message, type = 'info', duration = 3500) {
    if (!_toastContainer) return;

    const iconMap = {
      success: 'circle-check',
      error:   'circle-x',
      warn:    'triangle-alert',
      info:    'info',
    };

    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `
      <i data-lucide="${iconMap[type] || 'info'}" class="toast-icon"></i>
      <span class="toast-msg">${_esc(message)}</span>
      <button class="toast-close" aria-label="Dismiss">
        <i data-lucide="x"></i>
      </button>
    `;

    el.querySelector('.toast-close').addEventListener('click', () => _dismissToast(el));
    _toastContainer.appendChild(el);
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [el] });

    // Trigger entrance animation
    requestAnimationFrame(() => el.classList.add('show'));

    // Auto-dismiss
    const timer = setTimeout(() => _dismissToast(el), duration);
    el._timer = timer;
  }

  function _dismissToast(el) {
    if (el._dismissed) return;
    el._dismissed = true;
    clearTimeout(el._timer);
    el.classList.remove('show');
    el.classList.add('hide');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    // Fallback removal
    setTimeout(() => { if (el.parentNode) el.remove(); }, 500);
  }

  function _esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return {
    init, playDeployStart, playSuccess, playFailure, playPing,
    isSoundOn, toggleSound, requestPermission, send, toast,
  };
})();
