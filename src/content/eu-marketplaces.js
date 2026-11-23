/**
 * Unified EU Marketplace Content Script Adapter.
 * Supports: Willhaben (AT), Leboncoin (FR), Marktplaats (NL), 2dehands/2ememain (BE),
 * Wallapop (ES/IT/PT), Subito.it (IT), and Etsy (EU).
 */

(function () {
  if (!window.__DAC7_GUARD_WIDGET__) return;

  const host = (window.location.hostname || '').toLowerCase();

  const ADAPTERS = [
    {
      match: /willhaben\.at$/,
      platform: 'willhaben',
      platformName: 'Willhaben',
      defaultPaymentMethod: 'cash',
      titleSelector: 'h1, [data-testid="ad-detail-header"]',
      priceSelector: '[data-testid="contact-box-price-box-price-value"], [data-testid*="price"]',
      idRegex: /[-/](\d{6,12})\/?$/
    },
    {
      match: /leboncoin\.fr$/,
      platform: 'leboncoin',
      platformName: 'Leboncoin',
      defaultPaymentMethod: 'cash',
      titleSelector: 'h1, [data-qa-id="adview_title"]',
      priceSelector: '[data-qa-id="adview_price"], [data-qa-id*="price"]',
      idRegex: /\/(\d{7,12})(?:\.htm|\/|$)/
    },
    {
      match: /(marktplaats\.nl|2dehands\.be|2ememain\.be)$/,
      platform: 'marktplaats',
      platformName: host.includes('marktplaats') ? 'Marktplaats' : '2dehands',
      defaultPaymentMethod: 'cash',
      titleSelector: 'h1.Listing-title, h1',
      priceSelector: '.Listing-price, [data-testid="price"]',
      idRegex: /\/([a-z]\d{7,12})-/i
    },
    {
      match: /wallapop\.com$/,
      platform: 'wallapop',
      platformName: 'Wallapop',
      defaultPaymentMethod: 'platform',
      titleSelector: 'h1, [class*="item-detail-title"]',
      priceSelector: '[class*="item-detail-price"], [class*="Price"]',
      idRegex: /-(\d{6,12})$/
    },
    {
      match: /subito\.it$/,
      platform: 'subito',
      platformName: 'Subito.it',
      defaultPaymentMethod: 'cash',
      titleSelector: 'h1',
      priceSelector: '[class*="price"], [class*="Price"]',
      idRegex: /-(\d{6,12})\.htm/
    },
    {
      match: /etsy\.com$/,
      platform: 'etsy',
      platformName: 'Etsy',
      defaultPaymentMethod: 'platform',
      titleSelector: 'h1',
      priceSelector: '[data-buy-box-region="price"], .wt-text-title-03',
      idRegex: /\/listing\/(\d{6,14})/
    }
  ];

  const cfg = ADAPTERS.find((a) => a.match.test(host));
  if (!cfg) return;

  function getPrefill() {
    const titleEl = document.querySelector(cfg.titleSelector);
    const priceEl = document.querySelector(cfg.priceSelector);
    const idMatch = window.location.pathname.match(cfg.idRegex);

    return {
      title: titleEl ? titleEl.textContent.replace(/\s+/g, ' ').trim().slice(0, 160) : '',
      sellPrice: priceEl ? window.__DAC7_GUARD_WIDGET__.parsePrice(priceEl.textContent) : '',
      externalId: idMatch ? idMatch[1] : null,
      paymentMethod: cfg.defaultPaymentMethod
    };
  }

  const widget = window.__DAC7_GUARD_WIDGET__.createWidget({
    platform: cfg.platform,
    platformName: cfg.platformName,
    defaultPaymentMethod: cfg.defaultPaymentMethod,
    getDefaultPrefill: getPrefill
  });

  widget.refresh();
})();
