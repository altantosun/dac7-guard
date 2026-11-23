/**
 * Core DAC7 / PStTG & § 23 EStG calculation rules.
 * Pure, dependency-free functions (fully unit-tested).
 */

export const DAC7_MAX_TRANSACTIONS = 30;
export const DAC7_MAX_REVENUE_EUR = 2000;
export const ESTG_PROFIT_EXEMPTION_EUR = 1000; // § 23 Abs. 3 Satz 5 EStG (seit 2024)
export const DEFAULT_WARNING_RATIO = 0.8; // 80% -> 24 Verkäufe / 1.600 €

export const PLATFORMS = {
  kleinanzeigen: {
    id: 'kleinanzeigen',
    name: 'Kleinanzeigen',
    color: '#86b817',
    defaultReportable: false,
    hint: 'Bei Kleinanzeigen sind i. d. R. nur „Sicher bezahlen“ / „Direkt kaufen“-Transaktionen DAC7-meldepflichtig.'
  },
  ebay: {
    id: 'ebay',
    name: 'eBay',
    color: '#e53238',
    defaultReportable: true,
    hint: 'eBay wickelt Zahlungen über das eigene System ab – alle Verkäufe zählen zur DAC7-Grenze.'
  },
  vinted: {
    id: 'vinted',
    name: 'Vinted',
    color: '#007782',
    defaultReportable: true,
    hint: 'Verkäufe über das Vinted-System zählen zur DAC7-Grenze (30 Verkäufe oder > 2.000 €).'
  },
  willhaben: {
    id: 'willhaben',
    name: 'Willhaben',
    color: '#009fe3',
    defaultReportable: false,
    hint: 'Bei Willhaben (AT) zählen i. d. R. nur PayLivery-Transaktionen zur DPMG / DAC7-Meldegrenze.'
  },
  leboncoin: {
    id: 'leboncoin',
    name: 'Leboncoin',
    color: '#ff6e14',
    defaultReportable: false,
    hint: 'On Leboncoin (FR), online payments (Paiement sécurisé) count toward EU DAC7 reporting.'
  },
  marktplaats: {
    id: 'marktplaats',
    name: 'Marktplaats',
    color: '#f59e0b',
    defaultReportable: false,
    hint: 'On Marktplaats (NL) & 2dehands (BE), platform payment requests count toward EU DAC7.'
  },
  wallapop: {
    id: 'wallapop',
    name: 'Wallapop',
    color: '#13c1ac',
    defaultReportable: true,
    hint: 'Wallapop Shipping transactions count toward the EU DAC7 reporting limit.'
  },
  subito: {
    id: 'subito',
    name: 'Subito.it',
    color: '#f9423a',
    defaultReportable: false,
    hint: 'On Subito.it (IT), TuttoSubito transactions count toward the EU DAC7 reporting limit.'
  },
  etsy: {
    id: 'etsy',
    name: 'Etsy',
    color: '#f1641e',
    defaultReportable: true,
    hint: 'All Etsy orders are processed via the platform and count toward EU DAC7 limits.'
  },
  other: {
    id: 'other',
    name: 'Sonstige',
    color: '#6366f1',
    defaultReportable: true,
    hint: 'Weitere Plattformen (z. B. momox, rebuy, Vestiaire Collective, Depop, OLX).'
  }
};

export const PAYMENT_METHODS = {
  platform: { id: 'platform', label: 'Plattform-System / Sicher bezahlen', reportable: true },
  cash: { id: 'cash', label: 'Barzahlung bei Abholung', reportable: false },
  paypal_friends: { id: 'paypal_friends', label: 'PayPal (privat)', reportable: false },
  bank_transfer: { id: 'bank_transfer', label: 'Banküberweisung', reportable: false }
};

/**
 * Parses EU price strings like "1.250,50 € VB", "1 250,50 €", "45 €", "19.99 EUR", "VB", "Zu verschenken", "Gratuit", "Free".
 * Returns a non-negative number (rounded to 2 decimals) or null if no numeric price exists.
 */
export function parseGermanPrice(input) {
  if (typeof input === 'number' && Number.isFinite(input) && input >= 0) {
    return Math.round(input * 100) / 100;
  }
  if (typeof input !== 'string') return null;

  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^(zu verschenken|gratuit|free|gratis)$/i.test(trimmed) || /zu verschenken/i.test(trimmed)) {
    return 0;
  }

  // Normalize non-breaking / narrow spaces used as thousand separators (FR/PL/SE: "1 250,50 €")
  const normalized = trimmed.replace(/(\d)[\u00a0\u202f ]+(?=\d{3}(?:[^\d]|$))/g, '$1');

  // Match English (1,250.50 / 1,200), European (1.250,50 / 1.200 / 12,50), or plain decimals (19.99)
  const match = normalized.match(
    /(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d{1,3}(?:\.\d{3})+,\d{1,2}|\d+,\d{1,2}|\d{1,3}(?:\.\d{3})+|\d+(?:\.\d{1,2})?)/
  );
  if (!match) return null;

  let token = match[1];
  if (/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(token)) {
    // English format: 1,250.50 -> 1250.50, 1,200 -> 1200
    token = token.replace(/,/g, '');
  } else if (token.includes(',')) {
    // European format: 1.234,56 -> 1234.56
    token = token.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(token)) {
    // Thousand dots without decimals: 1.200 -> 1200
    token = token.replace(/\./g, '');
  }

  const value = Number.parseFloat(token);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100) / 100;
}

/**
 * Determines whether a sale counts toward DAC7 / PStTG platform reporting.
 */
export function isSaleReportable(sale) {
  if (typeof sale.reportable === 'boolean') return sale.reportable;
  const method = PAYMENT_METHODS[sale.paymentMethod];
  if (method) return method.reportable;
  const platform = PLATFORMS[sale.platform];
  return platform ? platform.defaultReportable : true;
}

/**
 * Filters sales for a given calendar year (YYYY).
 */
export function filterSalesByYear(sales, year) {
  const targetYear = Number(year);
  return (sales || []).filter((sale) => {
    if (!sale || !sale.date) return false;
    const saleYear = Number(String(sale.date).slice(0, 4));
    return saleYear === targetYear;
  });
}

export function clampWarningRatio(ratio) {
  const num = Number(ratio);
  if (!Number.isFinite(num)) return DEFAULT_WARNING_RATIO;
  return Math.min(0.99, Math.max(0.5, num));
}

/**
 * Calculates DAC7 / PStTG statistics for a specific platform and calendar year.
 */
export function calculatePlatformStats(sales, year, platformId, warningRatio = DEFAULT_WARNING_RATIO) {
  const safeWarnRatio = clampWarningRatio(warningRatio);
  const yearSales = filterSalesByYear(sales, year).filter((s) => s.platform === platformId);

  let reportableCount = 0;
  let reportableRevenue = 0;
  let nonReportableCount = 0;
  let nonReportableRevenue = 0;

  for (const sale of yearSales) {
    const price = Number(sale.sellPrice) || 0;
    if (isSaleReportable(sale)) {
      reportableCount += 1;
      reportableRevenue += price;
    } else {
      nonReportableCount += 1;
      nonReportableRevenue += price;
    }
  }

  reportableRevenue = Math.round(reportableRevenue * 100) / 100;
  nonReportableRevenue = Math.round(nonReportableRevenue * 100) / 100;

  const txRatio = reportableCount / DAC7_MAX_TRANSACTIONS;
  const revenueRatio = reportableRevenue / DAC7_MAX_REVENUE_EUR;
  const maxRatio = Math.max(txRatio, revenueRatio);

  let status = 'ok';
  // PStTG § 4 Abs. 5 Satz 4 Nr. 1: >= 30 Transaktionen ODER > 2.000 € Vergütung
  if (reportableCount >= DAC7_MAX_TRANSACTIONS || reportableRevenue > DAC7_MAX_REVENUE_EUR) {
    status = 'exceeded';
  } else if (maxRatio >= safeWarnRatio) {
    status = 'warning';
  }

  return {
    platform: platformId,
    year: Number(year),
    reportableCount,
    reportableRevenue,
    nonReportableCount,
    nonReportableRevenue,
    totalCount: reportableCount + nonReportableCount,
    totalRevenue: Math.round((reportableRevenue + nonReportableRevenue) * 100) / 100,
    txProgressPct: Math.min(100, Math.round(txRatio * 100)),
    revenueProgressPct: Math.min(100, Math.round(revenueRatio * 100)),
    remainingTx: Math.max(0, DAC7_MAX_TRANSACTIONS - reportableCount),
    remainingRevenue: Math.max(0, Math.round((DAC7_MAX_REVENUE_EUR - reportableRevenue) * 100) / 100),
    status
  };
}

/**
 * Calculates § 23 EStG (private Veräußerungsgeschäfte) profit summary across ALL platforms for a year.
 * Everyday household items held > 1 year or sold at a loss are normally tax-free.
 * Items with known buyPrice where heldUnderOneYear === true and (sellPrice - buyPrice) > 0 count toward the 1.000 € Freigrenze.
 */
export function calculateTaxSummary(sales, year, warningRatio = DEFAULT_WARNING_RATIO) {
  const safeWarnRatio = clampWarningRatio(warningRatio);
  const yearSales = filterSalesByYear(sales, year);

  let totalRevenue = 0;
  let totalKnownCost = 0;
  let netProfitLoss = 0;
  let shortTermNet = 0;
  let itemsWithCost = 0;

  for (const sale of yearSales) {
    const sell = Number(sale.sellPrice) || 0;
    totalRevenue += sell;

    if (sale.buyPrice !== null && sale.buyPrice !== undefined && sale.buyPrice !== '') {
      const buy = Number(sale.buyPrice);
      if (Number.isFinite(buy) && buy >= 0) {
        itemsWithCost += 1;
        totalKnownCost += buy;
        const diff = sell - buy;
        netProfitLoss += diff;

        // § 23 Abs. 3 EStG: Verluste aus privaten Veräußerungsgeschäften (< 1 Jahr, Nicht-Alltagsgegenstände)
        // können im selben Kalenderjahr mit Gewinnen verrechnet werden.
        if (sale.heldUnderOneYear && !sale.isEverydayItem) {
          shortTermNet += diff;
        }
      }
    }
  }

  const taxableShortTermProfit = Math.max(0, Math.round(shortTermNet * 100) / 100);
  totalRevenue = Math.round(totalRevenue * 100) / 100;
  totalKnownCost = Math.round(totalKnownCost * 100) / 100;
  netProfitLoss = Math.round(netProfitLoss * 100) / 100;

  const profitRatio = taxableShortTermProfit / ESTG_PROFIT_EXEMPTION_EUR;
  let status = 'ok';
  if (taxableShortTermProfit >= ESTG_PROFIT_EXEMPTION_EUR) {
    status = 'exceeded';
  } else if (profitRatio >= safeWarnRatio) {
    status = 'warning';
  }

  return {
    year: Number(year),
    totalSalesCount: yearSales.length,
    totalRevenue,
    totalKnownCost,
    netProfitLoss,
    taxableShortTermProfit,
    itemsWithCost,
    exemptionLimit: ESTG_PROFIT_EXEMPTION_EUR,
    profitProgressPct: Math.min(100, Math.round(profitRatio * 100)),
    remainingExemption: Math.max(0, Math.round((ESTG_PROFIT_EXEMPTION_EUR - taxableShortTermProfit) * 100) / 100),
    status
  };
}

/**
 * Formats EUR currency in German locale.
 */
export function formatEur(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(num);
}

/**
 * Returns today's date as YYYY-MM-DD in local time.
 */
export function getTodayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Computes the worst status across all platforms for the browser extension badge.
 */
export function computeOverallBadge(sales, year, warningRatio = DEFAULT_WARNING_RATIO) {
  const platformIds = Object.keys(PLATFORMS);
  let worstStatus = 'ok';
  let maxPct = 0;

  for (const pid of platformIds) {
    const stats = calculatePlatformStats(sales, year, pid, warningRatio);
    const pct = Math.max(stats.txProgressPct, stats.revenueProgressPct);
    if (pct > maxPct) maxPct = pct;
    if (stats.status === 'exceeded') {
      worstStatus = 'exceeded';
    } else if (stats.status === 'warning' && worstStatus !== 'exceeded') {
      worstStatus = 'warning';
    }
  }

  if (worstStatus === 'exceeded') {
    return { text: 'DAC7', color: '#dc2626', status: 'exceeded' };
  }
  if (worstStatus === 'warning') {
    return { text: `${maxPct}%`, color: '#d97706', status: 'warning' };
  }
  return { text: '', color: '#16a34a', status: 'ok' };
}
