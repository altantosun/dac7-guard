/**
 * Local-only persistence layer backed by chrome.storage.local.
 * Zero network calls, 100% privacy-first.
 */

import { DEFAULT_WARNING_RATIO, PAYMENT_METHODS, PLATFORMS, clampWarningRatio, getTodayIso } from './rules.js';

const STORAGE_KEY_SALES = 'dac7_guard_sales_v1';
const STORAGE_KEY_SETTINGS = 'dac7_guard_settings_v1';

export const DEFAULT_SETTINGS = {
  warningRatio: DEFAULT_WARNING_RATIO,
  showFloatingPill: true,
  captureDeletePrompt: true,
  language: 'auto'
};

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `sale_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function sanitizeHttpUrl(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim().slice(0, 500);
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

export function normalizeSale(rawInput) {
  const input = rawInput && typeof rawInput === 'object' ? rawInput : {};
  const platform = PLATFORMS[input.platform] ? input.platform : 'kleinanzeigen';
  const paymentMethod = PAYMENT_METHODS[input.paymentMethod]
    ? input.paymentMethod
    : platform === 'kleinanzeigen'
      ? 'cash'
      : 'platform';

  const reportable =
    typeof input.reportable === 'boolean'
      ? input.reportable
      : PAYMENT_METHODS[paymentMethod].reportable;

  const parsedSell = Number(input.sellPrice);
  const sellPrice =
    Number.isFinite(parsedSell) && parsedSell >= 0
      ? Math.round(parsedSell * 100) / 100
      : 0;

  const rawBuy = input.buyPrice;
  const parsedBuy = Number(rawBuy);
  const buyPrice =
    rawBuy === '' || rawBuy === null || rawBuy === undefined || !Number.isFinite(parsedBuy) || parsedBuy < 0
      ? null
      : Math.round(parsedBuy * 100) / 100;

  return {
    id: input.id ? String(input.id).slice(0, 100) : generateId(),
    externalId: input.externalId ? String(input.externalId).trim().slice(0, 100) : null,
    platform,
    title: String(input.title || 'Unbenannter Artikel').trim().slice(0, 180) || 'Unbenannter Artikel',
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(input.date || '')) ? String(input.date) : getTodayIso(),
    sellPrice,
    buyPrice,
    paymentMethod,
    reportable,
    isEverydayItem: input.isEverydayItem !== false,
    heldUnderOneYear: Boolean(input.heldUnderOneYear),
    note: String(input.note || '').trim().slice(0, 500),
    url: sanitizeHttpUrl(input.url),
    createdAt: input.createdAt ? String(input.createdAt).slice(0, 40) : new Date().toISOString()
  };
}

export async function getSales() {
  const result = await chrome.storage.local.get(STORAGE_KEY_SALES);
  const list = result[STORAGE_KEY_SALES];
  return Array.isArray(list) ? list : [];
}

export async function saveSales(sales) {
  await chrome.storage.local.set({ [STORAGE_KEY_SALES]: sales });
  return sales;
}

export async function addSale(input) {
  const sales = await getSales();
  const normalized = normalizeSale(input);

  // Prevent duplicates when scanning platform pages by externalId
  if (normalized.externalId) {
    const existing = sales.find(
      (s) => s.platform === normalized.platform && s.externalId === normalized.externalId
    );
    if (existing) {
      return { added: false, duplicate: true, sale: existing, sales };
    }
  }

  sales.unshift(normalized);
  await saveSales(sales);
  return { added: true, duplicate: false, sale: normalized, sales };
}

export async function addSalesBatch(items) {
  const sales = await getSales();
  const existingExt = new Set(
    sales.filter((s) => s.externalId).map((s) => `${s.platform}:${s.externalId}`)
  );

  let added = 0;
  let duplicates = 0;

  for (const item of items || []) {
    const normalized = normalizeSale(item);
    if (normalized.externalId && existingExt.has(`${normalized.platform}:${normalized.externalId}`)) {
      duplicates += 1;
      continue;
    }
    sales.unshift(normalized);
    if (normalized.externalId) {
      existingExt.add(`${normalized.platform}:${normalized.externalId}`);
    }
    added += 1;
  }

  if (added > 0) {
    await saveSales(sales);
  }
  return { added, duplicates, sales };
}

export async function updateSale(id, patch) {
  const sales = await getSales();
  const idx = sales.findIndex((s) => s.id === id);
  if (idx === -1) return null;

  const updated = normalizeSale({ ...sales[idx], ...patch, id });
  sales[idx] = updated;
  await saveSales(sales);
  return updated;
}

export async function deleteSale(id) {
  const sales = await getSales();
  const filtered = sales.filter((s) => s.id !== id);
  await saveSales(filtered);
  return filtered;
}

export async function mergeImportedSales(importedList) {
  const existing = await getSales();
  const existingIds = new Set(existing.map((s) => s.id));
  const existingExt = new Set(
    existing.filter((s) => s.externalId).map((s) => `${s.platform}:${s.externalId}`)
  );

  let addedCount = 0;
  const merged = [...existing];

  for (const raw of importedList || []) {
    if (!raw || typeof raw !== 'object') continue;
    const norm = normalizeSale(raw);
    if (existingIds.has(norm.id)) continue;
    if (norm.externalId && existingExt.has(`${norm.platform}:${norm.externalId}`)) continue;

    merged.push(norm);
    existingIds.add(norm.id);
    if (norm.externalId) existingExt.add(`${norm.platform}:${norm.externalId}`);
    addedCount += 1;
  }

  merged.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  await saveSales(merged);
  return { addedCount, totalCount: merged.length };
}

export async function clearAllSales() {
  await saveSales([]);
}

function sanitizeLanguage(lang) {
  return lang === 'de' || lang === 'en' || lang === 'auto' ? lang : 'auto';
}

export async function getSettings() {
  const result = await chrome.storage.local.get(STORAGE_KEY_SETTINGS);
  const raw = { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEY_SETTINGS] || {}) };
  return {
    ...raw,
    warningRatio: clampWarningRatio(raw.warningRatio),
    showFloatingPill: raw.showFloatingPill !== false,
    captureDeletePrompt: raw.captureDeletePrompt !== false,
    language: sanitizeLanguage(raw.language)
  };
}

export async function saveSettings(patch) {
  const current = await getSettings();
  const merged = { ...current, ...(patch && typeof patch === 'object' ? patch : {}) };
  const updated = {
    ...merged,
    warningRatio: clampWarningRatio(merged.warningRatio),
    showFloatingPill: merged.showFloatingPill !== false,
    captureDeletePrompt: merged.captureDeletePrompt !== false,
    language: sanitizeLanguage(merged.language)
  };
  await chrome.storage.local.set({ [STORAGE_KEY_SETTINGS]: updated });
  return updated;
}
