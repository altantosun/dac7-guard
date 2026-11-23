# Changelog

All notable changes to **DAC7 Guard** will be documented in this file.

## [0.2.0] - 2026-11-23

### Added
- Pan-EU multi-TLD support for **eBay** (`.de`, `.at`, `.fr`, `.it`, `.es`, `.nl`, `.be`, `.ie`, `.pl`) and **Vinted** (`.de`, `.fr`, `.it`, `.es`, `.nl`, `.pl`, `.be`, `.at`, `.pt`).
- Unified EU marketplace adapter (`src/content/eu-marketplaces.js`) for **Willhaben (AT)**, **Leboncoin (FR)**, **Marktplaats (NL)**, **2dehands/2ememain (BE)**, **Wallapop (ES/IT/PT)**, **Subito.it (IT)**, and **Etsy (EU)**.
- Lightweight DE/EN i18n helper (`src/shared/i18n.js`) with browser auto-detection and Dashboard language switcher.
- Firefox MV3 Add-on packager (`npm run pack:firefox`).
- Dynamic platform dropdowns & smart active-platform card grid in Dashboard.

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
