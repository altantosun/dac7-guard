import test from 'node:test';
import assert from 'node:assert/strict';

import { detectLocale, t } from '../src/shared/i18n.js';
import { PLATFORMS, calculatePlatformStats } from '../src/shared/rules.js';

test('i18n detectLocale respects explicit preference and falls back cleanly', () => {
  assert.equal(detectLocale('de'), 'de');
  assert.equal(detectLocale('en'), 'en');
  assert.ok(['de', 'en'].includes(detectLocale('auto')));
});

test('i18n t returns German and English labels', () => {
  assert.equal(t('underLimit', 'de'), 'Unter Grenze');
  assert.equal(t('underLimit', 'en'), 'Under limit');
  assert.equal(t('exceeded', 'en'), 'Reporting limit reached');
  assert.equal(t('unknown_key', 'en'), 'unknown_key');
});

test('EU platforms (Willhaben, Leboncoin, Marktplaats, Wallapop, Subito, Etsy) are registered and tracked independently', () => {
  for (const id of ['willhaben', 'leboncoin', 'marktplaats', 'wallapop', 'subito', 'etsy']) {
    assert.ok(PLATFORMS[id], `Platform ${id} must exist`);
  }

  const sales = [
    { platform: 'willhaben', date: '2026-06-01', sellPrice: 1700, paymentMethod: 'platform', reportable: true },
    { platform: 'leboncoin', date: '2026-06-02', sellPrice: 300, paymentMethod: 'cash', reportable: false },
    { platform: 'etsy', date: '2026-06-03', sellPrice: 2100, paymentMethod: 'platform', reportable: true }
  ];

  assert.equal(calculatePlatformStats(sales, 2026, 'willhaben').status, 'warning');
  assert.equal(calculatePlatformStats(sales, 2026, 'leboncoin').reportableCount, 0);
  assert.equal(calculatePlatformStats(sales, 2026, 'etsy').status, 'exceeded');
});
