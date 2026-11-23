# 🛡️ DAC7 Guard

**Open-Source Chrome Extension (Manifest V3) zum lokalen Tracking der DAC7 / PStTG-Meldegrenzen und § 23 EStG Gewinne für Kleinanzeigen, eBay & Vinted.**

> **100 % lokal • Zero Dependencies • Keine Server • Kein Tracking • MIT-Lizenz**

---

## Warum DAC7 Guard?

Seit dem **Plattformen-Steuertransparenzgesetz (PStTG / EU-Richtlinie DAC7)** müssen Online-Marktplätze (Kleinanzeigen, eBay, Vinted, Etsy u. a.) private Verkäufer automatisch an das Bundeszentralamt für Steuern (BZSt) melden, sobald **pro Kalenderjahr und pro Plattform** eine der beiden Schwellen erreicht wird:

| Grenze (pro Plattform & Jahr) | Schwellenwert (PStTG § 4 Abs. 5) |
|---|---|
| **Anzahl Verkäufe** | **ab 30 Transaktionen** (`≥ 30`) |
| **Gesamtumsatz (Brutto)** | **über 2.000 €** (`> 2.000,00 €`) |

Zusätzlich gilt für private Veräußerungsgeschäfte innerhalb der 1-Jahres-Spekulationsfrist (**§ 23 EStG**, z. B. Sammlerstücke, Uhren, Nicht-Alltagsgegenstände) eine **Freigrenze von 1.000 € Gewinn** pro Jahr.

**Wichtig:** Eine Meldung bedeutet *nicht* automatisch Steuern (normaler gebrauchter Hausrat, der unter Einkaufspreis verkauft wird, bleibt steuerfrei). Wer aber nach 1–2 Jahren Post vom Finanzamt bekommt, braucht saubere Nachweise – genau dafür ist **DAC7 Guard** da.

---

## Features

- **DAC7 / PStTG Ampel pro Plattform:** Fortschrittsbalken für **30 Verkäufe** und **2.000 € Umsatz** getrennt für Kleinanzeigen, eBay, Vinted & Sonstige.
- **Kleinanzeigen-Besonderheit integriert:** Trennt sauber zwischen meldepflichtigen **„Sicher bezahlen“-Transaktionen** und nicht-meldepflichtigen Privatverkäufen (Barzahlung, PayPal privat, Überweisung).
- **Smart-Capture auf Kleinanzeigen:** Beim Klick auf *„Anzeige löschen“* oder *„Verkauft“* erscheint ein unaufdringliches Overlay (Shadow DOM) mit vorausgefülltem Titel & Preis.
- **Seiten-Scanner:** Auf Kleinanzeigen (*Meine Aufträge / Sicher bezahlen*), eBay (*Verkaufte Artikel*) und Vinted (*Bestellungen*) lassen sich sichtbare Verkäufe per Klick einlesen (mit Duplikat-Schutz).
- **§ 23 EStG Gewinn-Tracker:** Optionaler Einkaufspreis pro Artikel zeigt automatisch Gewinn/Verlust und die 1.000-€-Freigrenze.
- **Finanzamt-Nachweis-Export:**
  - **CSV Export** (UTF-8 BOM, Semikolon-getrennt – direkt für deutsches Excel / LibreOffice)
  - **PDF / Druckansicht** für die Steuerakte
  - **JSON Backup & Restore**
- **Maximale Privatsphäre:** Benötigt nur die `storage`-Berechtigung. Null externe API-Calls, null Analytics, null Build-Abhängigkeiten.

---

## Installation (Chrome, Brave, Edge, Arc)

Da DAC7 Guard ohne Build-Schritt auskommt, kannst du das Repository direkt laden:

1. Repository klonen oder als ZIP herunterladen:
   ```bash
   git clone https://github.com/altantosun/dac7-guard.git
   ```
2. In Chrome `chrome://extensions` öffnen.
3. Oben rechts den **Entwicklermodus** aktivieren.
4. Auf **„Entpackte Erweiterung laden“** klicken und den Ordner `dac7-guard` auswählen.
5. Fertig – das 🛡️-Icon erscheint in deiner Browserleiste.

---

## Tests & Entwicklung

Benötigt nur Node.js (ab v20, keine `npm install`-Pakete nötig):

```bash
# Unit-Tests ausführen (DAC7-Regeln, Preisparser, § 23 EStG, CSV/JSON-Export)
npm test

# Extension-Icons neu generieren
npm run icons
```

### Projektstruktur

```text
dac7-guard/
├── manifest.json                 # Chrome Extension Manifest V3
├── icons/                        # PNG Icons (16, 48, 128 px)
├── scripts/
│   └── generate-icons.js         # Zero-Dependency PNG-Generator
├── src/
│   ├── shared/
│   │   ├── rules.js              # DAC7 / PStTG & § 23 EStG Berechnungslogik
│   │   ├── storage.js            # chrome.storage.local Wrapper
│   │   └── export.js             # Excel-CSV & JSON Backup/Import
│   ├── background/
│   │   └── service-worker.js     # Badge-Updates & Message-Router
│   ├── content/
│   │   ├── overlay-widget.js     # Shadow-DOM Status-Pill & Capture-Modal
│   │   ├── kleinanzeigen.js      # Adapter für kleinanzeigen.de
│   │   ├── ebay.js               # Adapter für ebay.de
│   │   └── vinted.js             # Adapter für vinted.de
│   ├── popup/                    # Toolbar-Popup UI
│   └── dashboard/                # Vollständiges Dashboard, Print/PDF & Guide
└── tests/                        # Node Test Runner Suite
```

---

## Haftungsausschluss / Disclaimer

DAC7 Guard ist ein privates Open-Source-Hilfstool zur eigenen Übersicht und **stellt keine Rechts- oder Steuerberatung dar**. Alle Berechnungen erfolgen ohne Gewähr. Bei steuerlichen Fragen wende dich bitte an eine Steuerberaterin, einen Steuerberater oder dein zuständiges Finanzamt.

## Lizenz

[MIT License](./LICENSE)
