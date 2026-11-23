/**
 * Manifest V3 Background Service Worker.
 * - Updates the toolbar badge whenever sales change
 * - Serves lightweight messages from content scripts (add sale, get platform summary, open dashboard)
 */

import { calculatePlatformStats, computeOverallBadge } from '../shared/rules.js';
import { addSale, addSalesBatch, getSales, getSettings } from '../shared/storage.js';

let writeQueue = Promise.resolve();

function enqueueWrite(fn) {
  const next = writeQueue.then(fn, fn);
  writeQueue = next.catch(() => {});
  return next;
}

async function refreshBadge() {
  try {
    const [sales, settings] = await Promise.all([getSales(), getSettings()]);
    const currentYear = new Date().getFullYear();
    const badge = computeOverallBadge(sales, currentYear, settings.warningRatio);

    await chrome.action.setBadgeText({ text: badge.text });
    await chrome.action.setBadgeBackgroundColor({ color: badge.color });
  } catch {
    // Ignore badge errors when extension context reloads
  }
}

chrome.runtime.onInstalled.addListener(() => {
  refreshBadge();
});

chrome.runtime.onStartup.addListener(() => {
  refreshBadge();
});

chrome.storage.onChanged.addListener(() => {
  refreshBadge();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.type) return false;

  if (message.type === 'DAC7_GET_SUMMARY') {
    (async () => {
      try {
        const [sales, settings] = await Promise.all([getSales(), getSettings()]);
        const year = message.year || new Date().getFullYear();
        const platform = message.platform || 'kleinanzeigen';
        const stats = calculatePlatformStats(sales, year, platform, settings.warningRatio);
        sendResponse({ ok: true, stats, settings });
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
    })();
    return true;
  }

  if (message.type === 'DAC7_ADD_SALE') {
    enqueueWrite(async () => {
      try {
        const res = await addSale(message.payload || {});
        await refreshBadge();
        const settings = await getSettings();
        const year = new Date().getFullYear();
        const stats = calculatePlatformStats(res.sales, year, res.sale.platform, settings.warningRatio);
        sendResponse({ ok: true, ...res, stats });
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
    });
    return true;
  }

  if (message.type === 'DAC7_ADD_SALES_BATCH') {
    enqueueWrite(async () => {
      try {
        const items = Array.isArray(message.payload) ? message.payload : [];
        const { added, duplicates, sales } = await addSalesBatch(items);
        await refreshBadge();
        const settings = await getSettings();
        const year = new Date().getFullYear();
        const stats = calculatePlatformStats(
          sales,
          year,
          message.platform || 'kleinanzeigen',
          settings.warningRatio
        );
        sendResponse({ ok: true, added, duplicates, stats });
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
    });
    return true;
  }

  if (message.type === 'DAC7_OPEN_DASHBOARD') {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return false;
  }

  return false;
});
