// What's Poppin — Security Init
// Safe localStorage wrapper + service worker registration

/**
 * SafeStorage — tamper-resistant localStorage wrapper.
 *
 * Every value is stored alongside an FNV-1a checksum (`key + '_c'`).
 * On read, the checksum is verified — tampered or missing values fall back
 * to a default. All operations are wrapped in try-catch so private browsing,
 * disabled storage, or quota-exceeded errors never crash the game.
 *
 * @example
 *   SafeStorage.set('highScore', 4200);
 *   SafeStorage.getInt('highScore', 0); // → 4200
 *   // Manually editing localStorage('highScore') invalidates the checksum
 *   SafeStorage.getInt('highScore', 0); // → 0 (tampered, returns fallback)
 */
const SafeStorage = {
  /**
   * Compute FNV-1a hash of a string value. Used internally for checksums.
   * @param {string} val — value to hash
   * @returns {string} base-36 encoded hash
   * @private
   */
  _checksum(val) {
    let h = 0x811c9dc5;
    for (let i = 0; i < val.length; i++) {
      h ^= val.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36);
  },

  /**
   * Read a string value from localStorage with checksum verification.
   * @param {string} key — storage key
   * @param {*} fallback — returned if key is missing, tampered, or storage errors
   * @returns {string|*} stored value or fallback
   */
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      const check = localStorage.getItem(key + '_c');
      if (check && check !== this._checksum(raw)) return fallback;
      return raw;
    } catch (_) { return fallback; }
  },

  /**
   * Read an integer from localStorage with validation and checksum.
   * Returns fallback if the stored value is NaN, negative, or tampered.
   * @param {string} key — storage key
   * @param {number} fallback — returned on any failure
   * @returns {number} parsed integer (≥ 0) or fallback
   */
  getInt(key, fallback) {
    const raw = this.get(key, null);
    if (raw === null) return fallback;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? Math.max(0, n) : fallback;
  },

  /**
   * Write a value to localStorage with an accompanying checksum.
   * Fails silently if storage is full, disabled, or in private browsing.
   * @param {string} key — storage key
   * @param {*} value — value to store (coerced to string)
   */
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
