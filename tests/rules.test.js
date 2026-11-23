import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DAC7_MAX_REVENUE_EUR,
  DAC7_MAX_TRANSACTIONS,
  ESTG_PROFIT_EXEMPTION_EUR,
  calculatePlatformStats,
  calculateTaxSummary,
  computeOverallBadge,
  parseGermanPrice
} from '../src/shared/rules.js';

test('parseGermanPrice parses German formats, VB, and Zu verschenken', () => {
  assert.equal(parseGermanPrice('120 €'), 120);
  assert.equal(parseGermanPrice('1.250,50 € VB'), 1250.5);
  assert.equal(parseGermanPrice('45,99 EUR'), 45.99);
  assert.equal(parseGermanPrice('1.200 €'), 1200);
  assert.equal(parseGermanPrice('Zu verschenken'), 0);
  assert.equal(parseGermanPrice('VB'), null);
  assert.equal(parseGermanPrice(''), null);
});

test('calculatePlatformStats separates reportable and non-reportable Kleinanzeigen sales', () => {
  const sales = [
    { platform: 'kleinanzeigen', date: '2026-02-10', sellPrice: 500, paymentMethod: 'platform', reportable: true },
    { platform: 'kleinanzeigen', date: '2026-03-12', sellPrice: 1200, paymentMethod: 'cash', reportable: false },
    { platform: 'kleinanzeigen', date: '2025-12-01', sellPrice: 900, paymentMethod: 'platform', reportable: true }
  ];

  const stats = calculatePlatformStats(sales, 2026, 'kleinanzeigen');
  assert.equal(stats.reportableCount, 1);
  assert.equal(stats.reportableRevenue, 500);
  assert.equal(stats.nonReportableCount, 1);
  assert.equal(stats.nonReportableRevenue, 1200);
  assert.equal(stats.status, 'ok');
  assert.equal(stats.remainingTx, DAC7_MAX_TRANSACTIONS - 1);
  assert.equal(stats.remainingRevenue, DAC7_MAX_REVENUE_EUR - 500);
});

test('calculatePlatformStats triggers warning at 80% and exceeded at >= 30 sales or > 2000 EUR (PStTG)', () => {
  const warnSales = [
    { platform: 'ebay', date: '2026-01-15', sellPrice: 1600, paymentMethod: 'platform', reportable: true }
  ];
  assert.equal(calculatePlatformStats(warnSales, 2026, 'ebay').status, 'warning');

  // Exact 2.000,00 EUR is still exempt per PStTG § 4 Abs. 5 Satz 4 Nr. 1 ("nicht überstiegen hat")
  const exact2000 = [
    { platform: 'ebay', date: '2026-01-15', sellPrice: 2000, paymentMethod: 'platform', reportable: true }
  ];
  assert.equal(calculatePlatformStats(exact2000, 2026, 'ebay').status, 'warning');

  const exceededByRev = [
    { platform: 'ebay', date: '2026-01-15', sellPrice: 2000.01, paymentMethod: 'platform', reportable: true }
  ];
  assert.equal(calculatePlatformStats(exceededByRev, 2026, 'ebay').status, 'exceeded');

  const exceededByTx = Array.from({ length: 30 }, (_, i) => ({
    platform: 'vinted',
    date: '2026-04-01',
    sellPrice: 10 + (i % 3),
    paymentMethod: 'platform',
    reportable: true
  }));
  const vintedStats = calculatePlatformStats(exceededByTx, 2026, 'vinted');
  assert.equal(vintedStats.reportableCount, 30);
  assert.equal(vintedStats.status, 'exceeded');
});

test('calculateTaxSummary tracks § 23 EStG 1.000 EUR exemption and offsets short-term losses', () => {
  const sales = [
    // Everyday item sold at a loss -> not taxable
    { platform: 'kleinanzeigen', date: '2026-02-01', sellPrice: 300, buyPrice: 800, isEverydayItem: true, heldUnderOneYear: true },
    // Collectible held > 1 year with profit -> outside speculation period
    { platform: 'ebay', date: '2026-03-01', sellPrice: 1500, buyPrice: 500, isEverydayItem: false, heldUnderOneYear: false },
    // Collectible held < 1 year with +1.050 EUR profit
    { platform: 'ebay', date: '2026-04-01', sellPrice: 1450, buyPrice: 400, isEverydayItem: false, heldUnderOneYear: true },
    // Collectible held < 1 year with -200 EUR loss -> offsets gain to 850 EUR (warning >= 80%)
    { platform: 'ebay', date: '2026-05-01', sellPrice: 300, buyPrice: 500, isEverydayItem: false, heldUnderOneYear: true }
  ];

  const tax = calculateTaxSummary(sales, 2026);
  assert.equal(tax.taxableShortTermProfit, 850);
  assert.equal(tax.exemptionLimit, ESTG_PROFIT_EXEMPTION_EUR);
  assert.equal(tax.remainingExemption, 150);
  assert.equal(tax.status, 'warning');
});

test('computeOverallBadge picks worst platform status', () => {
  const sales = [
    { platform: 'kleinanzeigen', date: '2026-01-10', sellPrice: 200, reportable: true },
    { platform: 'ebay', date: '2026-02-10', sellPrice: 2100, reportable: true }
  ];
  const badge = computeOverallBadge(sales, 2026);
  assert.equal(badge.status, 'exceeded');
  assert.equal(badge.text, 'DAC7');
});
