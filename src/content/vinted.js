/**
 * Vinted.de Orders Content Script Adapter.
 */

(function () {
  if (!window.__DAC7_GUARD_WIDGET__) return;

  function scanVintedOrders() {
    const results = [];
    const seen = new Set();

    const cards = document.querySelectorAll(
      '[data-testid*="order"], .web_ui__Cell__cell, a[href*="/inbox/"]'
    );

    cards.forEach((card) => {
      const text = (card.textContent || '').replace(/\s+/g, ' ').trim();
      // Multi-language EU Vinted completed/sold order keywords (DE, EN, FR, ES, PT, IT, NL, PL)
      if (!/abgeschlossen|verkauft|geliefert|bezahlt|completed|sold|delivered|vendu|livr[eé]|termin[eé]|vendido|entregado|completado|venduto|consegnato|completato|verkocht|bezorgd|voltooid|sprzedan|dostarczon|zako[nń]czon/i.test(text)) {
        return;
      }

      const titleEl = card.querySelector('h3, h4, .web_ui__Text__title, [data-testid*="title"]');
      const title = titleEl ? titleEl.textContent.trim() : text.slice(0, 80);
      const sellPrice = window.__DAC7_GUARD_WIDGET__.parsePrice(text);
      const href = card.getAttribute('href') || card.querySelector('a')?.getAttribute('href') || '';
      const orderId = (href.match(/\/(\d{6,14})/) || [])[1] || null;

      if (!title || sellPrice === '') return;
      const key = orderId || `${title}_${sellPrice}`;
      if (seen.has(key)) return;
      seen.add(key);

      results.push({
        platform: 'vinted',
        title,
        sellPrice: Number(sellPrice) || 0,
        paymentMethod: 'platform',
        reportable: true,
        isEverydayItem: true,
        heldUnderOneYear: false,
        externalId: orderId,
        note: 'Automatisch von Vinted erfasst'
      });
    });

    return results;
  }

  const widget = window.__DAC7_GUARD_WIDGET__.createWidget({
    platform: 'vinted',
    platformName: 'Vinted',
    defaultPaymentMethod: 'platform',
    onScanPage: scanVintedOrders
  });

  widget.refresh();
})();
