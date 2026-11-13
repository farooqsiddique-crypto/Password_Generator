# Atlas Password Generator

A client-side password generator built with plain HTML, CSS and JavaScript. No dependencies, no build step, no network access.

## Run it
1. Put all files in **one folder** and open that folder in VS Code (File > Open Folder).
2. Install the **Live Server** extension, right-click `index.html`, choose **Open with Live Server**.
3. Optional: run the tests with node test.js (Node 18+).

## Files
| File | Role |
|---|---|
| `index.html` | Page structure and the Content-Security-Policy |
| `style.css` | Styling |
| `generator.js` | Core logic (no DOM access, unit-testable) |
| `app.js` | UI wiring, auto-clear, clipboard handling |

## Security design
| Measure | Why |
|---|---|
| `crypto.getRandomValues` only | Cryptographically secure randomness. The non-crypto RNG is never used and there is no fallback; if Web Crypto is missing, generation is refused. |
| Rejection sampling | Removes modulo bias so every character is equally likely. |
| Fisher-Yates shuffle | The guaranteed one-of-each-type characters do not end up in predictable positions. |
| Minimum length 12, validated in code | Input is checked in `generate()`, not only by the slider, so a tampered value is rejected. |
| Strict Content-Security-Policy | `default-src 'none'`: no network requests, no inline scripts, no external resources. Limits the impact of any injected code. |
| No dangerous sinks | No `innerHTML`, `eval`, `document.write`. Text is written with `textContent` only. `test.js` audits the source for these. |
| No storage, no history | Nothing is written to localStorage, cookies or disk. |
| Auto-clear after 60 s, Clear button | Limits how long the password sits on screen. |
| Clipboard cleared 30 s after copying | Reduces exposure to clipboard-reading malware or later pastes. This overwrites the clipboard with an empty string. |
| Hide / Show toggle | Protects against shoulder surfing. |
| `referrer: no-referrer` | No referrer information is leaked. |

## Threat model and limitations
- **Protects against:** weak or biased randomness, XSS-style injection, accidental exfiltration, shoulder surfing, leftover clipboard data.
- **Does not protect against:** malware or a malicious browser extension already running on the device, keyloggers, a compromised OS or browser.
- JavaScript strings are immutable, so the password cannot be reliably wiped from RAM. Clearing the UI removes references, and the garbage collector reclaims them later.
- The entropy figure is an estimate (length x log2(pool size)). Requiring one of each type makes the true value very slightly lower.
- A `<meta>` CSP cannot set `frame-ancestors` or other HTTP headers. If you deploy this on a real server, also send these headers: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`.
- If hosted publicly, serve it over HTTPS so the clipboard API and Web Crypto are available and the files cannot be tampered with in transit.

## Ideas for further work
- Passphrase (diceware) mode, Have I Been Pwned k-anonymity check, Subresource Integrity if external assets are ever added.
