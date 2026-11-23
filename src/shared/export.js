/**
 * Export & Backup helpers (German Excel-compatible CSV + JSON Backup/Restore).
 */

import { PAYMENT_METHODS, PLATFORMS, filterSalesByYear, isSaleReportable } from './rules.js';

function escapeCsvCell(value, { isNumeric = false } = {}) {
  let str = value === null || value === undefined ? '' : String(value);
  // Prevent CSV formula injection (DDE / Excel) on non-numeric text cells, even with leading spaces
  if (!isNumeric && /^\s*[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[;"\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatNumberDe(num) {
  if (num === null || num === undefined || !Number.isFinite(Number(num))) return '';
  const rounded = Math.round(Number(num) * 100) / 100;
  const safe = Object.is(rounded, -0) ? 0 : rounded;
  return safe.toFixed(2).replace('.', ',');
}

/**
 * Generates a UTF-8 BOM semicolon-separated CSV string optimized for German Excel & LibreOffice.
 */
export function buildCsv(sales, year = null) {
  const rows = year ? filterSalesByYear(sales, year) : [...(sales || [])];
  rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const headers = [
    'Datum',
    'Plattform',
    'Artikel',
    'Verkaufspreis (EUR)',
    'Einkaufspreis (EUR)',
    'Gewinn/Verlust (EUR)',
    'Zahlungsart',
    'DAC7-meldepflichtig',
    'Alltagsgegenstand/Hausrat',
    'Haltedauer < 1 Jahr',
    'Notiz',
    'Inserats-ID'
  ];

  const lines = [headers.map(escapeCsvCell).join(';')];

  for (const sale of rows) {
    const sell = Number(sale.sellPrice) || 0;
    const hasBuy = sale.buyPrice !== null && sale.buyPrice !== undefined && sale.buyPrice !== '';
    const buy = hasBuy ? Number(sale.buyPrice) : null;
    const diff = buy !== null ? sell - buy : null;

    const platformLabel = PLATFORMS[sale.platform]?.name || sale.platform || '';
    const paymentLabel = PAYMENT_METHODS[sale.paymentMethod]?.label || sale.paymentMethod || '';
    const reportable = isSaleReportable(sale) ? 'Ja' : 'Nein';

    const cols = [
      escapeCsvCell(sale.date || ''),
      escapeCsvCell(platformLabel),
      escapeCsvCell(sale.title || ''),
      escapeCsvCell(formatNumberDe(sell), { isNumeric: true }),
      escapeCsvCell(buy !== null ? formatNumberDe(buy) : '', { isNumeric: true }),
      escapeCsvCell(diff !== null ? formatNumberDe(diff) : '', { isNumeric: true }),
      escapeCsvCell(paymentLabel),
      escapeCsvCell(reportable),
      escapeCsvCell(sale.isEverydayItem !== false ? 'Ja' : 'Nein'),
      escapeCsvCell(sale.heldUnderOneYear ? 'Ja' : 'Nein'),
      escapeCsvCell(sale.note || ''),
      escapeCsvCell(sale.externalId || '')
    ];

    lines.push(cols.join(';'));
  }

  // UTF-8 BOM ensures Excel on Windows/macOS opens umlauts (ä, ö, ü, €) cleanly
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/**
 * Generates a versioned JSON backup string.
 */
export function buildJsonBackup(sales, settings = {}) {
  return JSON.stringify(
    {
      app: 'DAC7 Guard',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      settings,
      sales: sales || []
    },
    null,
    2
  );
}

/**
 * Parses and validates a JSON backup payload.
 */
export function parseJsonBackup(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('Ungültige JSON-Datei.');
  }

  if (Array.isArray(parsed)) {
    return { sales: parsed, settings: null };
  }
  if (parsed && Array.isArray(parsed.sales)) {
    return { sales: parsed.sales, settings: parsed.settings || null };
  }
  throw new Error('JSON enthält keine gültige Verkaufsliste ("sales").');
}

/**
 * Triggers a browser file download (used in popup/dashboard).
 */
export function triggerDownload(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
