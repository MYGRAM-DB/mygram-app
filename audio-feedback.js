(() => {
  'use strict';

  const STORAGE_KEY = 'mygram.sound.enabled';
  let enabled = true;
  let audioContext = null;
  let toggleButton = null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'false') enabled = false;
  } catch {}

  const patterns = {
    message:      [{ f: 740, d: 0.09, at: 0 }, { f: 980, d: 0.13, at: 0.10 }],
    notification: [{ f: 660, d: 0.10, at: 0 }, { f: 880, d: 0.10, at: 0.12 }, { f: 1100, d: 0.15, at: 0.24 }],
    sent:         [{ f: 620, d: 0.08, at: 0 }, { f: 820, d: 0.08, at: 0.09 }],
    success:      [{ f: 520, d: 0.08, at: 0 }, { f: 780, d: 0.12, at: 0.09 }],
    error:        [{ f: 260, d: 0.13, at: 0 }, { f: 190, d: 0.16, at: 0.15 }],
    call:         [{ f: 560, d: 0.18, at: 0 }, { f: 740, d: 0.18, at: 0.25 }, { f: 560, d: 0.18, at: 0.55 }],
    reaction:     [{ f: 880, d: 0.08, at: 0 }]
  };

  function translate(value) {
    return window.MYGRAM_TRANSLATE_TEXT ? window.MYGRAM_TRANSLATE_TEXT(value) : value;
  }

  function ensureContext() {
    if (audioContext) return audioContext;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    try { audioContext = new AudioContextClass(); } catch { audioContext = null; }
    return audioContext;
  }

  function unlock() {
    const context = ensureContext();
    if (context && context.state === 'suspended') context.resume().catch(() => {});
  }

  function updateToggle() {
    if (!toggleButton) return;
    const label = enabled ? translate('أصوات التنبيه مفعّلة') : translate('أصوات التنبيه مكتومة');
    toggleButton.textContent = enabled ? '🔊' : '🔇';
    toggleButton.setAttribute('aria-pressed', String(enabled));
    toggleButton.setAttribute('aria-label', label);
    toggleButton.title = label;
    toggleButton.dataset.soundEnabled = String(enabled);
    toggleButton.classList.toggle('is-muted', !enabled);
  }

  function play(kind = 'notification') {
    if (!enabled) return false;
    const context = ensureContext();
    if (!context || context.state !== 'running') return false;
    const notes = patterns[kind] || patterns.notification;
    const base = context.currentTime + 0.015;
    for (const note of notes) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(note.f, base + note.at);
      gain.gain.setValueAtTime(0.0001, base + note.at);
      gain.gain.exponentialRampToValueAtTime(0.075, base + note.at + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, base + note.at + note.d);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(base + note.at);
      oscillator.stop(base + note.at + note.d + 0.025);
      oscillator.onended = () => {
        try { oscillator.disconnect(); gain.disconnect(); } catch {}
      };
    }
    return true;
  }

  function mountToggle() {
    if (toggleButton || !document.body) return;
    const parent = document.querySelector('.topbar-right')
      || document.querySelector('.topbar-inner')
      || document.querySelector('.services-topbar')
      || document.querySelector('header');
    if (!parent) return;
    toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.className = 'mygram-sound-toggle';
    toggleButton.addEventListener('click', async () => {
      unlock();
      enabled = !enabled;
      try { localStorage.setItem(STORAGE_KEY, String(enabled)); } catch {}
      updateToggle();
      if (enabled) {
        const context = ensureContext();
        if (context?.state === 'suspended') {
          try { await context.resume(); } catch {}
        }
        play('success');
      }
      window.dispatchEvent(new CustomEvent('mygram:sound-setting-changed', { detail: { enabled } }));
    });
    parent.appendChild(toggleButton);
    updateToggle();
    window.addEventListener('mygram:languagechange', updateToggle);
  }

  const style = document.createElement('style');
  style.textContent = [
    '.mygram-sound-toggle{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;min-width:38px;height:38px;padding:0 10px;border:1px solid #dce6f3;border-radius:12px;background:#fff;color:#526781;font:700 13px/1 system-ui,sans-serif;box-shadow:0 3px 10px #173b680a;cursor:pointer;transition:background .15s,border-color .15s,transform .15s}',
    '.mygram-sound-toggle:hover{background:#f0f7ff;border-color:#bedcff;transform:translateY(-1px)}',
    '.mygram-sound-toggle:focus-visible{outline:3px solid #087cf04a;outline-offset:2px}',
    '.mygram-sound-toggle.is-muted{color:#8793a5;background:#f5f7fa}',
    '.topbar-right .mygram-sound-toggle{margin-inline-start:4px}',
    '.topbar-inner>.mygram-sound-toggle{margin-inline-start:auto}',
    '@media(max-width:700px){.mygram-sound-toggle{min-width:34px;height:34px;padding:0 8px;border-radius:10px}}'
  ].join('\n');
  document.head.appendChild(style);

  window.MYGRAM_SOUNDS = {
    play,
    unlock,
    isEnabled: () => enabled,
    setEnabled(value) {
      enabled = Boolean(value);
      try { localStorage.setItem(STORAGE_KEY, String(enabled)); } catch {}
      updateToggle();
    }
  };

  for (const type of ['pointerdown', 'keydown', 'touchstart']) {
    window.addEventListener(type, unlock, { once: true, passive: true });
  }
  document.addEventListener('click', event => {
    const action = event.target.closest('[data-sound-effect]');
    if (action) play(action.dataset.soundEffect || 'tap');
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountToggle, { once: true });
  else mountToggle();
})();