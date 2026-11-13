/* Atlas core: password generation logic (no DOM access, so it can be unit-tested in Node). */
(function (root) {
  "use strict";

  const SETS = Object.freeze({
    lower: "abcdefghijklmnopqrstuvwxyz",
    upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    digits: "0123456789",
    symbols: "!@#$%^&*()-_=+[]{};:,.<>?/",
  });
  const TYPES = ["lower", "upper", "digits", "symbols"];
  const LOOKALIKES = /[Il1O0o|]/g;
  const MIN_LENGTH = 12;
  const MAX_LENGTH = 64;

  // Only the browser's cryptographic generator is used. If it is missing we refuse to
  // continue; there is deliberately NO fallback to a weaker generator.
  function secureRandom() {
    const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
    if (!c || typeof c.getRandomValues !== "function") {
      throw new Error("Secure random generator (Web Crypto) is not available in this browser.");
    }
    return c;
  }

  // Unbiased random integer in [0, max). Rejection sampling removes modulo bias.
  function randomInt(max) {
    if (!Number.isInteger(max) || max < 1 || max > 0x100000000) {
      throw new RangeError("randomInt: max must be an integer between 1 and 2^32.");
    }
    if (max === 1) return 0;
    const c = secureRandom();
    const limit = Math.floor(0x100000000 / max) * max;
    const buf = new Uint32Array(1);
    do { c.getRandomValues(buf); } while (buf[0] >= limit);
    return buf[0] % max;
  }

  // Fisher-Yates shuffle driven by randomInt.
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  function buildPools(opts) {
    return TYPES
      .filter((t) => opts[t] === true)
      .map((t) => (opts.noLookalikes === true ? SETS[t].replace(LOOKALIKES, "") : SETS[t]));
  }

  function entropyBits(length, poolSize) {
    return length * Math.log2(poolSize);
  }

  function rate(bits) {
    if (bits < 60) return { name: "Weak", key: "weak", note: "Too easy to guess. Use more characters or more character types." };
    if (bits < 80) return { name: "Fair", key: "fair", note: "Acceptable for low-risk accounts. Longer is better." };
    if (bits < 100) return { name: "Good", key: "good", note: "A solid password for most accounts." };
    return { name: "Strong", key: "strong", note: "Very hard to guess, even with powerful hardware." };
  }

  // opts: { length, lower, upper, digits, symbols, noLookalikes }
  function generate(opts) {
    if (!opts || typeof opts !== "object") throw new TypeError("Options are required.");
    const length = opts.length;
    if (!Number.isInteger(length) || length < MIN_LENGTH || length > MAX_LENGTH) {
      throw new RangeError(`Length must be a whole number from ${MIN_LENGTH} to ${MAX_LENGTH}.`);
    }
    const pools = buildPools(opts);
    if (pools.length === 0) throw new Error("Select at least one character type.");
    if (length < pools.length) throw new RangeError("Length is too short for the selected types.");

    const pool = pools.join("");
    const chars = pools.map((p) => p[randomInt(p.length)]); // one from every selected type
    while (chars.length < length) chars.push(pool[randomInt(pool.length)]);
    const password = shuffle(chars).join("");

    const poolSize = new Set(pool).size;
    return { password, pool, poolSize, bits: entropyBits(length, poolSize) };
  }

  const api = { generate, randomInt, shuffle, buildPools, entropyBits, rate, SETS, MIN_LENGTH, MAX_LENGTH };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.AtlasCore = Object.freeze(api);
})(typeof window !== "undefined" ? window : globalThis);
