# Contributing to DAC7 Guard

Contributions are very welcome — especially marketplace selector updates (Kleinanzeigen, eBay, Vinted) and adapters for additional platforms (Etsy, momox, rebuy, Nebenan, Willhaben).

## Ground Rules

1. **Zero runtime dependencies:** Keep the extension loadable directly in Chrome without a build step (`chrome://extensions` → *Load unpacked*).
2. **Privacy-first:** Never add external network calls, analytics, or broader browser permissions than strictly necessary.
3. **Safe DOM handling:** Never interpolate scraped page content or user input into `innerHTML`. Always use `.textContent` or `.value`.
4. **Tests required:** Every change to `src/shared/` must include unit tests in `tests/`.

## Local Development

```bash
# Run all unit & integration tests (Node.js >= 20)
npm test

# Regenerate extension PNG icons
npm run icons

# Build a clean Chrome Web Store / GitHub Release zip
npm run pack
```

## Adding a New Marketplace Adapter

1. Add platform metadata in `src/shared/rules.js` (`PLATFORMS`).
2. Create `src/content/<platform>.js` using `window.__DAC7_GUARD_WIDGET__.createWidget(...)`.
3. Register the content script match patterns in `manifest.json`.
4. Test locally in Chrome and run `npm test`.
