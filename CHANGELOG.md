# Changelog

All notable changes to **DAC7 Guard** will be documented in this file.

## [0.1.0] - 2026-11-23

### Added
- Manifest V3 Chrome Extension (`storage`-only permission, zero runtime dependencies).
- DAC7 / PStTG limit tracking per platform & calendar year (`>= 30` sales or `> 2.000,00 €` revenue).
- Kleinanzeigen distinction between reportable (*„Sicher bezahlen“*) and non-reportable private sales (*Bar / PayPal / Überweisung*).
- § 23 EStG short-term profit tracker (`1.000 €` Freigrenze) with intra-year loss offsetting.
- Shadow DOM floating status pill & quick-capture modal for Kleinanzeigen, eBay, and Vinted.
- Full Dashboard with inline sale editing, search/filter, print/PDF report, Excel-compatible CSV export (with formula-injection protection), and JSON backup/restore.
- Real-time cross-tab synchronization via `chrome.storage.onChanged` and serialized service-worker write queue.
- Automated Node test suite (`rules`, `export`, `storage`) and GitHub Actions CI.
