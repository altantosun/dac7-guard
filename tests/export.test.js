import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCsv, buildJsonBackup, parseJsonBackup } from '../src/shared/export.js';

test('buildCsv outputs UTF-8 BOM, semicolon columns, and German comma decimals', () => {
  const sales = [
    {
      date: '2026-05-10',
      platform: 'kleinanzeigen',
      title: 'Kaffeemaschine; "wie neu"',
      sellPrice: 120.5,
      buyPrice: 250,
      paymentMethod: 'cash',
      reportable: false,
      isEverydayItem: true,
      heldUnderOneYear: false,
      note: 'Privatbesitz',
      externalId: '2819283712'
    }
  ];

  const csv = buildCsv(sales, 2026);
  assert.ok(csv.startsWith('\uFEFFDatum;Plattform;Artikel;'));
  assert.ok(csv.includes('"Kaffeemaschine; ""wie neu"""'));
  assert.ok(csv.includes('120,50;250,00;-129,50'));
  assert.ok(csv.includes(';Nein;Ja;Nein;Privatbesitz;2819283712'));
});

test('buildCsv neutralizes Excel formula injection in text fields but keeps negative numbers intact', () => {
  const sales = [
    {
      date: '2026-06-01',
      platform: 'kleinanzeigen',
      title: '=CMD|"/C calc"!A0',
      sellPrice: 10,
      buyPrice: 50,
      paymentMethod: 'cash',
      reportable: false,
      note: ' +SUM(A1:A2)'
    }
  ];

  const csv = buildCsv(sales, 2026);
  assert.ok(csv.includes(`"'=CMD|""/C calc""!A0"`));
  assert.ok(csv.includes("' +SUM(A1:A2)"));
  assert.ok(csv.includes(';10,00;50,00;-40,00;'));
});

test('buildJsonBackup and parseJsonBackup round-trip cleanly', () => {
  const json = buildJsonBackup(
    [{ id: '1', title: 'Test', sellPrice: 50, date: '2026-01-01', platform: 'ebay' }],
    { warningRatio: 0.85 }
  );
  const parsed = parseJsonBackup(json);
  assert.equal(parsed.sales.length, 1);
  assert.equal(parsed.sales[0].title, 'Test');
  assert.equal(parsed.settings.warningRatio, 0.85);
});

test('parseJsonBackup rejects invalid payloads', () => {
  assert.throws(() => parseJsonBackup('{not-json'), /Ungültige JSON-Datei/);
  assert.throws(() => parseJsonBackup('{"foo":1}'), /Verkaufsliste/);
});
