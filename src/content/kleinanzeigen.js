/**
 * Kleinanzeigen.de Content Script Adapter.
 * - Shows floating DAC7 status pill on "Meins" / "Aufträge" / "Sicher bezahlen" pages
 * - Intercepts "Löschen" / "Verkauft" clicks on user's ads to offer 1-click sale logging
 * - Provides a page scanner for "Sicher bezahlen" / completed orders
 */

(function () {
  if (!window.__DAC7_GUARD_WIDGET__) return;

  const path = window.location.pathname || '';
  const isSellerArea =
    path.includes('m-meine-anzeigen') ||
    path.includes('m-meine-auftraege') ||
    path.includes('m-bezahlfunktion') ||
    path.includes('m-nachrichten');

  const isAdPage = path.includes('/s-anzeige/');

  if (!isSellerArea && !isAdPage) return;

  function extractListingFromElement(el) {
    const card =
      el.closest('article, li, [data-adid], .aditem, .manageaditem, .cardbox') || document.body;

    const externalId =
      card.getAttribute('data-adid') ||
      card.dataset?.adid ||
      (window.location.pathname.match(/\/(\d{7,12})-/) || [])[1] ||
      null;

    const titleEl =
      card.querySelector('h1, h2 a, h2, .text-module-begin a, .aditem-main--middle--title, [data-testid="ad-title"]') ||
      document.querySelector('#viewad-title, h1');

    const priceEl =
      card.querySelector('.aditem-main--middle--price-shipping--price, .manageaditem-price, [data-testid="ad-price"], #viewad-price') ||
      document.querySelector('#viewad-price');

    const title = titleEl ? titleEl.textContent.trim().replace(/\s+/g, ' ') : '';
    const sellPrice = priceEl
      ? window.__DAC7_GUARD_WIDGET__.parsePrice(priceEl.textContent)
      : '';

    return {
      externalId,
      title,
      sellPrice,
      paymentMethod: path.includes('auftraege') || path.includes('bezahlfunktion') ? 'platform' : 'cash'
    };
  }

  function scanVisibleOrders() {
    const results = [];
    const seen = new Set();

    // Scan order/transaction cards on "Meine Aufträge" / "Sicher bezahlen" or "Meine Anzeigen"
    const cards = document.querySelectorAll(
      '[data-adid], article.aditem, .manageaditem, [data-testid*="order"], [class*="order-item"]'
    );

    cards.forEach((card) => {
      const text = (card.textContent || '').replace(/\s+/g, ' ');
      const isCompletedOrder =
        path.includes('auftraege') ||
        path.includes('bezahlfunktion') ||
        /verkauft|abgeschlossen|ausgezahlt|bezahlt/i.test(text);

      if (!isCompletedOrder) return;

      const info = extractListingFromElement(card);
      if (!info.title) return;

      const dedupeKey = info.externalId || `${info.title}_${info.sellPrice}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);

      results.push({
        platform: 'kleinanzeigen',
        title: info.title,
        sellPrice: Number(info.sellPrice) || 0,
        paymentMethod: 'platform',
        reportable: true,
        isEverydayItem: true,
        heldUnderOneYear: false,
        externalId: info.externalId,
        note: 'Automatisch von Kleinanzeigen-Seite erfasst'
      });
    });

    return results;
  }

  const widget = window.__DAC7_GUARD_WIDGET__.createWidget({
    platform: 'kleinanzeigen',
    platformName: 'Kleinanzeigen',
    defaultPaymentMethod: path.includes('auftraege') || path.includes('bezahlfunktion') ? 'platform' : 'cash',
    onScanPage: isSellerArea ? scanVisibleOrders : null
  });

  let captureDeleteEnabled = true;

  widget.refresh().then((res) => {
    if (res && res.settings) {
      captureDeleteEnabled = res.settings.captureDeletePrompt !== false;
    }
  });

  // Listen for clicks on "Anzeige löschen" / "Verkauft" buttons ONLY on "Meine Anzeigen"
  // (avoid false positives on "Nachrichten" where "Löschen" deletes a chat conversation)
  if (path.includes('m-meine-anzeigen')) {
    document.addEventListener(
      'click',
      (event) => {
        if (!captureDeleteEnabled) return;
        const target = event.target instanceof Element ? event.target.closest('button, a') : null;
        if (!target) return;

        const label = `${target.textContent || ''} ${target.getAttribute('aria-label') || ''} ${target.getAttribute('title') || ''}`.trim();
        const isExplicitAdAction = /(anzeige\s+l[öo]schen|als\s+verkauft|verkauft\s+markieren)/i.test(label);
        const isCardDelete =
          /^l[öo]schen$/i.test(label) &&
          Boolean(target.closest('[data-adid], .manageaditem, article.aditem'));

        if (!isExplicitAdAction && !isCardDelete) {
          return;
        }

        const prefill = extractListingFromElement(target);
        // Delay slightly so Kleinanzeigen's own action/modal is not blocked
        setTimeout(() => {
          widget.openCaptureModal(prefill);
        }, 250);
      },
      true
    );
  }
})();
