// What's Poppin — Security Init
// Safe localStorage wrapper + service worker registration

/**
 * SafeStorage — tamper-resistant localStorage wrapper.
 *
 * Every value is stored alongside an FNV-1a checksum (`key_c`).
 * Reads that fail the checksum return the fallback, so casual
 * DevTools edits silently degrade rather than corrupt game state.
 *
 * All methods are try-catch guarded for private browsing / disabled storage.
 * @global
 */
const SafeStorage = {
  /**
   * Compute FNV-1a hash of a string value.
   * @param {string} val - Raw string to hash
   * @returns {string} Base-36 encoded 32-bit hash
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
   * Read a string value from localStorage with checksum validation.
   * @param {string} key - Storage key
   * @param {*} fallback - Returned when key is missing, storage throws, or checksum fails
   * @returns {string|*} Stored string or fallback
   */
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      const check = localStorage.getItem(key + '_c');
      // Reject if checksum is missing (orphaned write) or mismatched (tampered)
      if (!check || check !== this._checksum(raw)) return fallback;
      return raw;
    } catch (_) { return fallback; }
  },

  /**
   * Read a non-negative integer from localStorage with checksum validation.
   * @param {string} key - Storage key
   * @param {number} fallback - Returned when key is missing, NaN, negative, or tampered
   * @returns {number} Stored integer (≥ 0) or fallback
   */
  getInt(key, fallback) {
    const raw = this.get(key, null);
    if (raw === null) return fallback;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? Math.max(0, n) : fallback;
  },

  /**
   * Write a value to localStorage with an accompanying FNV-1a checksum.
   * Fails silently if storage is full or disabled.
   * @param {string} key - Storage key
   * @param {*} value - Value to store (coerced to string)
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
