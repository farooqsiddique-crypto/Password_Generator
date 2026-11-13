// Run with:  node test.js   (Node 18 or newer)
if (!globalThis.crypto) globalThis.crypto = require("crypto").webcrypto;
const fs = require("fs");
const core = require("./generator.js");
let failed = 0;
const check = (name, ok) => { console.log((ok ? "PASS  " : "FAIL  ") + name); if (!ok) failed++; };
const throws = (fn) => { try { fn(); return false; } catch (e) { return true; } };
const all = { length: 16, lower: true, upper: true, digits: true, symbols: true, noLookalikes: false };

// 1. randomInt is uniform (chi-square, 7 buckets, df = 6, critical value 22.46 at p = 0.001)
{
  const N = 70000, counts = new Array(7).fill(0);
  for (let i = 0; i < N; i++) counts[core.randomInt(7)]++;
  const exp = N / 7, chi = counts.reduce((s, c) => s + (c - exp) ** 2 / exp, 0);
  check(`randomInt is uniform (chi-square ${chi.toFixed(2)} < 22.46)`, chi < 22.46);
}
// 2. Every selected type appears, length is exact
{
  let ok = true;
  for (let i = 0; i < 3000; i++) {
    const { password } = core.generate(all);
    ok = ok && password.length === 16 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password);
  }
  check("3000 passwords: exact length and all four types present", ok);
}
// 3. Only selected types are used
{
  let ok = true;
  for (let i = 0; i < 1000; i++) ok = ok && /^[0-9]+$/.test(core.generate({ ...all, lower: false, upper: false, symbols: false }).password);
  check("digits-only option produces digits only", ok);
}
// 4. Look-alike exclusion
{
  let ok = true;
  for (let i = 0; i < 1000; i++) ok = ok && !/[Il1O0o|]/.test(core.generate({ ...all, noLookalikes: true }).password);
  check("look-alike characters are excluded", ok);
}
// 5. Input validation
check("rejects length below minimum", throws(() => core.generate({ ...all, length: 8 })));
check("rejects length above maximum", throws(() => core.generate({ ...all, length: 65 })));
check("rejects non-integer length", throws(() => core.generate({ ...all, length: 16.5 })));
check("rejects string length", throws(() => core.generate({ ...all, length: "16" })));
check("rejects no character types", throws(() => core.generate({ ...all, lower: false, upper: false, digits: false, symbols: false })));
// 6. No duplicates in 5000 passwords
{
  const seen = new Set();
  for (let i = 0; i < 5000; i++) seen.add(core.generate(all).password);
  check("5000 passwords are all unique", seen.size === 5000);
}
// 7. Source audit: no weak RNG, no dangerous APIs, no storage, no network calls
{
  const banned = [/Math\.random/, /innerHTML/, /outerHTML/, /insertAdjacentHTML/, /document\.write/, /\beval\s*\(/, /new Function/, /localStorage/, /sessionStorage/, /indexedDB/, /\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /sendBeacon/];
  for (const file of ["generator.js", "app.js"]) {
    const src = fs.readFileSync(file, "utf8");
    const hits = banned.filter((re) => re.test(src)).map(String);
    check(`${file} source audit (no weak RNG / HTML injection / storage / network)`, hits.length === 0);
    if (hits.length) console.log("   found:", hits.join(", "));
  }
  const html = fs.readFileSync("index.html", "utf8");
  check("index.html has a Content-Security-Policy", /Content-Security-Policy/.test(html));
  check("index.html has no inline scripts or event handlers", !/<script(?![^>]*\bsrc=)[^>]*>/.test(html) && !/\son[a-z]+\s*=/.test(html));
}
console.log(failed ? `\n${failed} test(s) FAILED` : "\nAll tests passed");
process.exit(failed ? 1 : 0);
