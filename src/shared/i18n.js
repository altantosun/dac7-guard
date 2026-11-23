/**
 * Lightweight zero-dependency i18n helper (DE + EN).
 * Defaults to browser language (German for de-*, English otherwise), overridable in settings.
 */

export const SUPPORTED_LANGS = ['de', 'en'];

export function detectLocale(preferred = 'auto') {
  if (preferred === 'de' || preferred === 'en') return preferred;
  const navLang =
    (typeof chrome !== 'undefined' && chrome.i18n && typeof chrome.i18n.getUILanguage === 'function'
      ? chrome.i18n.getUILanguage()
      : typeof navigator !== 'undefined'
        ? navigator.language
        : 'de') || 'de';
  return navLang.toLowerCase().startsWith('de') ? 'de' : 'en';
}

export const MESSAGES = {
  de: {
    subtitle: 'EU DAC7 & § 23 EStG Tracker',
    dashSubtitle: 'Privater Verkaufs-, EU-DAC7- & § 23 EStG-Tracker (100 % lokal)',
    underLimit: 'Unter Grenze',
    warning: 'Achtung (>80 %)',
    exceeded: 'Meldegrenze erreicht',
    okShort: 'OK',
    warnShort: 'Achtung',
    reportableSales: 'Meldepflichtige Verkäufe',
    reportableRevenue: 'Meldepflichtiger Umsatz',
    estgTitle: '§ 23 EStG Kurzfrist-Gewinn (alle Plattformen)',
    estgHint: 'Nur relevant bei Gewinn innerhalb von 12 Monaten für Nicht-Alltagsgegenstände.',
    quickAddBtn: '+ Verkauf schnell erfassen',
    cancel: 'Abbrechen',
    save: 'Speichern',
    saveSale: 'Verkauf speichern',
    saveChanges: 'Änderungen speichern',
    recentSales: 'Letzte Verkäufe',
    csvExport: 'CSV Export',
    pdfPrint: 'PDF / Drucken',
    footerPrivacy: '100 % lokal gespeichert • Keine Steuerberatung',
    dashGuide: 'Dashboard & Guide',
    noSalesYet: 'Noch keine Verkäufe für diese Auswahl erfasst.',
    allPlatforms: 'Alle Plattformen',
    settingsSaved: 'Einstellungen gespeichert.',
    languageLabel: 'Sprache / Language',
    totalRevLabel: 'Gesamtumsatz (alle Plattformen)',
    netProfitLabel: 'Saldo (VK − bekannter EK)',
    shortTermLabel: '§ 23 EStG Kurzfrist-Gewinn (< 1 Jahr)',
    recordedSales: 'Erfasste Verkäufe',
    settingsTitle: 'Einstellungen',
    warnThresholdLabel: 'Warnschwelle für Ampel & Badge (%)',
    showPillLabel: 'Status-Leiste (Floating Pill) auf Marktplätzen anzeigen',
    captureDeleteLabel: 'Beim Löschen einer Kleinanzeigen-Anzeige fragen, ob sie verkauft wurde',
    jsonBackupBtn: 'JSON Backup speichern',
    jsonImportBtn: 'JSON importieren',
    clearAllBtn: 'Alle Daten löschen',
    salesDac7: 'Verkäufe (DAC7)',
    revenueDac7: 'Umsatz (DAC7)',
    yes: 'Ja',
    no: 'Nein'
  },
  en: {
    subtitle: 'EU DAC7 & Private Resale Tracker',
    dashSubtitle: 'Private Sales & EU DAC7 Limit Tracker (100% local)',
    underLimit: 'Under limit',
    warning: 'Warning (>80%)',
    exceeded: 'Reporting limit reached',
    okShort: 'OK',
    warnShort: 'Warning',
    reportableSales: 'Reportable sales',
    reportableRevenue: 'Reportable revenue',
    estgTitle: 'Short-term taxable profit (all platforms)',
    estgHint: 'Applies to short-term (< 12 months) gains on non-everyday items (e.g. Germany § 23 EStG €1,000).',
    quickAddBtn: '+ Quick add sale',
    cancel: 'Cancel',
    save: 'Save',
    saveSale: 'Save sale',
    saveChanges: 'Save changes',
    recentSales: 'Recent sales',
    csvExport: 'CSV Export',
    pdfPrint: 'PDF / Print',
    footerPrivacy: '100% local storage • Not tax advice',
    dashGuide: 'Dashboard & Guide',
    noSalesYet: 'No sales recorded for this selection yet.',
    allPlatforms: 'All platforms',
    settingsSaved: 'Settings saved.',
    languageLabel: 'Language / Sprache',
    totalRevLabel: 'Total revenue (all platforms)',
    netProfitLabel: 'Net balance (sale − known cost)',
    shortTermLabel: 'Short-term taxable profit (< 1 year)',
    recordedSales: 'Recorded sales',
    settingsTitle: 'Settings',
    warnThresholdLabel: 'Warning threshold for traffic light & badge (%)',
    showPillLabel: 'Show floating status pill on supported marketplaces',
    captureDeleteLabel: 'Ask when deleting a Kleinanzeigen ad if it was sold',
    jsonBackupBtn: 'Save JSON backup',
    jsonImportBtn: 'Import JSON',
    clearAllBtn: 'Delete all data',
    salesDac7: 'Sales (DAC7)',
    revenueDac7: 'Revenue (DAC7)',
    yes: 'Yes',
    no: 'No'
  }
};

export function t(key, lang = 'de') {
  const dict = MESSAGES[lang] || MESSAGES.en;
  return dict[key] || MESSAGES.en[key] || key;
}

export function applyI18n(root, lang = 'de') {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key, lang);
  });
}
