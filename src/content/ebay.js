/**
 * eBay.de Seller Hub / Sold Orders Content Script Adapter.
 */

(function () {
  if (!window.__DAC7_GUARD_WIDGET__) return;

  function scanEbayOrders() {
    const results = [];
    const seen = new Set();

    const rows = document.querySelectorAll(
      'tr[data-order-id], .order-info, .sh-ord-row, [data-testid="order-row"], .m-order-card'
    );

    rows.forEach((row) => {
      const orderId =
        row.getAttribute('data-order-id') ||
        (row.textContent.match(/\b\d{2}-\d{5}-\d{5}\b/) || [])[0] ||
        null;

      const titleEl = row.querySelector('a[href*="/itm/"], .item-title, [data-testid="item-title"]');
      const priceEl = row.querySelector('.price, .total-price, [data-testid="order-total"], td.total');

      const title = titleEl ? titleEl.textContent.trim().replace(/\s+/g, ' ') : '';
      const sellPrice = priceEl
        ? window.__DAC7_GUARD_WIDGET__.parsePrice(priceEl.textContent)
        : '';

      if (!title) return;
      const key = orderId || `${title}_${sellPrice}`;
      if (seen.has(key)) return;
      seen.add(key);

      results.push({
        platform: 'ebay',
        title,
        sellPrice: Number(sellPrice) || 0,
        paymentMethod: 'platform',
        reportable: true,
        isEverydayItem: true,
        heldUnderOneYear: false,
        externalId: orderId,
        note: 'Automatisch von eBay-Verkaufsübersicht erfasst'
      });
    });

    return results;
  }

  const widget = window.__DAC7_GUARD_WIDGET__.createWidget({
    platform: 'ebay',
    platformName: 'eBay',
    defaultPaymentMethod: 'platform',
    onScanPage: scanEbayOrders
  });

  widget.refresh();
})();
