import test from 'node:test';
import assert from 'node:assert/strict';

import { clampWarningRatio } from '../src/shared/rules.js';
import {
  addSale,
  addSalesBatch,
  clearAllSales,
  deleteSale,
  getSales,
  getSettings,
  mergeImportedSales,
  normalizeSale,
  saveSettings,
  updateSale
} from '../src/shared/storage.js';

function installMockChromeStorage() {
  const store = new Map();
  globalThis.chrome = {
    storage: {
      local: {
        async get(key) {
          return { [key]: store.get(key) };
        },
        async set(obj) {
          for (const [k, v] of Object.entries(obj)) {
            store.set(k, structuredClone(v));
          }
        }
      }
    }
  };
  return store;
}

test('normalizeSale handles null, malformed prices, invalid platform, and dangerous URLs safely', () => {
  const fromNull = normalizeSale(null);
  assert.equal(fromNull.platform, 'kleinanzeigen');
  assert.equal(fromNull.sellPrice, 0);
  assert.equal(fromNull.buyPrice, null);
  assert.equal(fromNull.url, null);
  assert.equal(fromNull.title, 'Unbenannter Artikel');

  const hostile = normalizeSale({
    platform: 'evil_site',
    title: '   ',
    sellPrice: Infinity,
    buyPrice: -50,
    date: 'not-a-date',
    url: 'javascript:alert(1)'
  });

  assert.equal(hostile.platform, 'kleinanzeigen');
  assert.equal(hostile.title, 'Unbenannter Artikel');
  assert.equal(hostile.sellPrice, 0);
  assert.equal(hostile.buyPrice, null);
  assert.match(hostile.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(hostile.url, null);
});

test('normalizeSale preserves valid https URLs and buyPrice = 0', () => {
  const valid = normalizeSale({
    platform: 'ebay',
    title: 'Sammlermünze',
    sellPrice: 120,
    buyPrice: 0,
    url: 'https://www.ebay.de/itm/123456'
  });

  assert.equal(valid.platform, 'ebay');
  assert.equal(valid.buyPrice, 0);
  assert.equal(valid.reportable, true);
  assert.equal(valid.url, 'https://www.ebay.de/itm/123456');
});

test('clampWarningRatio clamps invalid and out-of-range ratios to [0.5, 0.99]', () => {
  assert.equal(clampWarningRatio(NaN), 0.8);
  assert.equal(clampWarningRatio(0), 0.5);
  assert.equal(clampWarningRatio(5), 0.99);
  assert.equal(clampWarningRatio(0.85), 0.85);
});

test('full CRUD lifecycle, deduplication, batch insert, import merge, and settings', async () => {
  installMockChromeStorage();

  // Add + deduplicate by externalId
  const r1 = await addSale({
    platform: 'kleinanzeigen',
    title: 'Fahrrad',
    sellPrice: 250,
    externalId: 'ad-1001',
    date: '2026-03-10'
  });
  assert.equal(r1.added, true);
  assert.equal(r1.duplicate, false);

  const rDup = await addSale({
    platform: 'kleinanzeigen',
    title: 'Fahrrad Duplikat',
    sellPrice: 250,
    externalId: 'ad-1001',
    date: '2026-03-10'
  });
  assert.equal(rDup.added, false);
  assert.equal(rDup.duplicate, true);

  // Batch insert with mixed new & duplicate items
  const batch = await addSalesBatch([
    { platform: 'kleinanzeigen', title: 'Fahrrad', sellPrice: 250, externalId: 'ad-1001' },
    { platform: 'ebay', title: 'Kamera', sellPrice: 400, externalId: 'ord-1' },
    { platform: 'ebay', title: 'Kamera 2', sellPrice: 400, externalId: 'ord-1' }
  ]);
  assert.equal(batch.added, 1);
  assert.equal(batch.duplicates, 2);

  // Update sale
  const updated = await updateSale(r1.sale.id, { sellPrice: 220, buyPrice: 500, note: 'Nachverhandelt' });
  assert.equal(updated.sellPrice, 220);
  assert.equal(updated.buyPrice, 500);
  assert.equal(updated.note, 'Nachverhandelt');

  // Merge imported sales (skips null, skips existing id/externalId, adds new)
  const merged = await mergeImportedSales([
    null,
    'invalid',
    { id: r1.sale.id, title: 'Ignored dup by id', sellPrice: 99 },
    { platform: 'ebay', externalId: 'ord-1', title: 'Ignored dup by ext', sellPrice: 99 },
    { platform: 'vinted', title: 'Jacke', sellPrice: 35, date: '2026-05-01' }
  ]);
  assert.equal(merged.addedCount, 1);
  assert.equal(merged.totalCount, 3);

  // Delete & clear
  await deleteSale(r1.sale.id);
  assert.equal((await getSales()).length, 2);
  await clearAllSales();
  assert.equal((await getSales()).length, 0);

  // Settings clamping
  const s = await saveSettings({ warningRatio: 0.1, showFloatingPill: false });
  assert.equal(s.warningRatio, 0.5);
  assert.equal(s.showFloatingPill, false);
  assert.equal((await getSettings()).warningRatio, 0.5);
});
