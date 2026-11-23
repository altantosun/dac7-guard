# Security & Privacy Policy

## Privacy-First Architecture

DAC7 Guard is designed to handle sensitive personal sales records with **zero remote attack surface**:

- **100 % Local Storage:** All data stays inside `chrome.storage.local` on the user's device.
- **Zero Network Requests:** The extension makes no external API calls, telemetry, or analytics requests.
- **Minimal Permissions:** Only `storage` is requested in `manifest.json`.
- **Zero Runtime Dependencies:** No third-party npm packages are bundled or executed at runtime.
- **XSS & CSV Hardening:** All scraped marketplace text is written via DOM properties (`.value` / `.textContent`) inside an isolated Shadow DOM, and CSV exports neutralize Excel formula injection prefixes (`=`, `+`, `-`, `@`).

## Reporting a Vulnerability

If you discover a security issue (e.g., DOM injection, permission escalation, or data leakage), please report it privately via **GitHub Security Advisories** in this repository rather than opening a public issue.

We aim to acknowledge reports within 48 hours and release a patch promptly.
