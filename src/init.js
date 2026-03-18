// What's Poppin — Security Init
// Safe localStorage wrapper + service worker registration

const SafeStorage = {
  _checksum(val) {
    // Simple FNV-1a hash to detect casual tampering
    let h = 0x811c9dc5;
    for (let i = 0; i < val.length; i++) {
      h ^= val.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36);
  },

  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      const check = localStorage.getItem(key + '_c');
      if (check && check !== this._checksum(raw)) return fallback; // tampered
      return raw;
    } catch (_) { return fallback; }
  },

  getInt(key, fallback) {
    const raw = this.get(key, null);
    if (raw === null) return fallback;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? Math.max(0, n) : fallback;
  },

  set(key, value) {
    try {
      const str = String(value);
      localStorage.setItem(key, str);
      localStorage.setItem(key + '_c', this._checksum(str));
    } catch (_) { /* storage full or disabled — fail silently */ }
  },
};

window.SafeStorage = SafeStorage;

// Service worker registration
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () {});
}
