/**
 * Shadow-DOM floating status pill & quick-capture modal for marketplace content scripts.
 * Completely isolated from host page CSS.
 */

(function () {
  if (window.__DAC7_GUARD_WIDGET__) return;

  function parsePrice(text) {
    if (typeof text === 'number' && Number.isFinite(text)) return text;
    if (!text) return '';
    const str = String(text).trim();
    if (/^(zu verschenken|gratuit|free|gratis)$/i.test(str) || /zu verschenken/i.test(str)) return 0;
    const normalized = str.replace(/(\d)[\u00a0\u202f ]+(?=\d{3}(?:[^\d]|$))/g, '$1');
    const match = normalized.match(/(\d{1,3}(?:\.\d{3})+,\d{1,2}|\d+,\d{1,2}|\d{1,3}(?:\.\d{3})+|\d+(?:\.\d{1,2})?)/);
    if (!match) return '';
    let token = match[1];
    if (token.includes(',')) token = token.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(token)) token = token.replace(/\./g, '');
    const val = Number.parseFloat(token);
    return Number.isFinite(val) ? Math.round(val * 100) / 100 : '';
  }

  function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function formatEur(val) {
    const n = Number(val) || 0;
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: n % 1 === 0 ? 0 : 2
    }).format(n);
  }

  function sendMessage(msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(response || { ok: false });
          }
        });
      } catch (err) {
        resolve({ ok: false, error: String(err) });
      }
    });
  }

  const STYLES = `
    :host {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0f172a;
    }
    .pill {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 2147483640;
      display: flex;
      align-items: center;
      gap: 10px;
      background: #0f172a;
      color: #f8fafc;
      padding: 8px 12px;
      border-radius: 999px;
      box-shadow: 0 10px 28px rgba(15, 23, 42, 0.28);
      font-size: 12px;
      line-height: 1.2;
      border: 1px solid rgba(255,255,255,0.12);
    }
    .dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      flex-shrink: 0;
      background: #22c55e;
    }
    .dot.warning { background: #f59e0b; }
    .dot.exceeded { background: #ef4444; }
    .pill-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      cursor: pointer;
    }
    .pill-title {
      font-weight: 600;
      font-size: 11px;
      color: #94a3b8;
      letter-spacing: 0.02em;
    }
    .pill-metrics {
      font-weight: 600;
      font-size: 12px;
      color: #ffffff;
    }
    .pill-btn {
      border: none;
      background: #22c55e;
      color: #052e16;
      font-weight: 700;
      font-size: 11px;
      padding: 6px 10px;
      border-radius: 999px;
      cursor: pointer;
      white-space: nowrap;
    }
    .pill-btn:hover { background: #4ade80; }
    .pill-btn.secondary {
      background: rgba(255,255,255,0.12);
      color: #f8fafc;
    }
    .pill-btn.secondary:hover { background: rgba(255,255,255,0.2); }
    .pill-close {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 14px;
      padding: 0 2px;
      line-height: 1;
    }
    .pill-close:hover { color: #ffffff; }

    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 2147483645;
      background: rgba(15, 23, 42, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .modal {
      background: #ffffff;
      color: #0f172a;
      width: 100%;
      max-width: 420px;
      border-radius: 14px;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.35);
      overflow: hidden;
      font-size: 13px;
    }
    .modal-head {
      background: #0f172a;
      color: #ffffff;
      padding: 14px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .modal-head h3 {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
    }
    .modal-body {
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 11px;
    }
    .row-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
      font-weight: 600;
      color: #334155;
    }
    input[type="text"], input[type="number"], input[type="date"], select {
      box-sizing: border-box;
      width: 100%;
      padding: 8px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 13px;
      color: #0f172a;
      background: #f8fafc;
    }
    input:focus, select:focus {
      outline: 2px solid #22c55e;
      border-color: transparent;
      background: #ffffff;
    }
    .checkbox-row {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 8px;
      font-weight: 500;
      color: #334155;
      cursor: pointer;
    }
    .hint {
      font-size: 11px;
      color: #64748b;
      background: #f1f5f9;
      padding: 8px 10px;
      border-radius: 8px;
      line-height: 1.4;
    }
    .modal-foot {
      padding: 12px 18px 16px;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .btn {
      border: none;
      border-radius: 8px;
      padding: 9px 14px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-cancel {
      background: #e2e8f0;
      color: #334155;
    }
    .btn-save {
      background: #16a34a;
      color: #ffffff;
    }
    .btn-save:hover { background: #15803d; }

    .toast {
      position: fixed;
      right: 18px;
      bottom: 74px;
      z-index: 2147483646;
      background: #0f172a;
      color: #f8fafc;
      padding: 10px 14px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 600;
      box-shadow: 0 10px 24px rgba(15,23,42,0.28);
      border-left: 4px solid #22c55e;
    }
  `;

  function createWidget({
    platform,
    platformName,
    defaultPaymentMethod = 'platform',
    onScanPage = null,
    getDefaultPrefill = null
  }) {
    const host = document.createElement('div');
    host.id = 'dac7-guard-root';
    const shadow = host.attachShadow({ mode: 'open' });

    const styleEl = document.createElement('style');
    styleEl.textContent = STYLES;
    shadow.appendChild(styleEl);

    const container = document.createElement('div');
    shadow.appendChild(container);
    document.documentElement.appendChild(host);

    let currentStats = null;
    let pillDismissed = false;

    function showToast(text) {
      const existing = shadow.querySelector('.toast');
      if (existing) existing.remove();
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.textContent = text;
      shadow.appendChild(toast);
      setTimeout(() => toast.remove(), 3500);
    }

    function renderPill() {
      const existing = container.querySelector('.pill');
      if (existing) existing.remove();
      if (pillDismissed || !currentStats) return;

      const pill = document.createElement('div');
      pill.className = 'pill';

      const dot = document.createElement('span');
      dot.className = `dot ${currentStats.status}`;

      const info = document.createElement('div');
      info.className = 'pill-info';
      info.title = 'DAC7 Guard Dashboard öffnen';
      info.innerHTML = `
        <span class="pill-title">DAC7 Guard • ${platformName} (${currentStats.year})</span>
        <span class="pill-metrics">${currentStats.reportableCount}/30 Verkäufe • ${formatEur(currentStats.reportableRevenue)} / 2.000 €</span>
      `;
      info.addEventListener('click', () => {
        sendMessage({ type: 'DAC7_OPEN_DASHBOARD' });
      });

      const addBtn = document.createElement('button');
      addBtn.className = 'pill-btn';
      addBtn.textContent = '+ Verkauf';
      addBtn.addEventListener('click', () => {
        const prefill = typeof getDefaultPrefill === 'function' ? getDefaultPrefill() || {} : {};
        openCaptureModal(prefill);
      });

      pill.appendChild(dot);
      pill.appendChild(info);
      pill.appendChild(addBtn);

      if (typeof onScanPage === 'function') {
        const scanBtn = document.createElement('button');
        scanBtn.className = 'pill-btn secondary';
        scanBtn.textContent = 'Scannen';
        scanBtn.title = 'Sichtbare Verkäufe auf dieser Seite einlesen';
        scanBtn.addEventListener('click', async () => {
          const items = onScanPage();
          if (!items || items.length === 0) {
            showToast('Keine abgeschlossenen Verkäufe auf dieser Ansicht erkannt.');
            return;
          }
          const res = await sendMessage({
            type: 'DAC7_ADD_SALES_BATCH',
            platform,
            payload: items
          });
          if (res.ok) {
            currentStats = res.stats;
            renderPill();
            showToast(`${res.added} neu erfasst (${res.duplicates} bereits gespeichert).`);
          }
        });
        pill.appendChild(scanBtn);
      }

      const closeBtn = document.createElement('button');
      closeBtn.className = 'pill-close';
      closeBtn.textContent = '×';
      closeBtn.title = 'Für diese Sitzung ausblenden';
      closeBtn.addEventListener('click', () => {
        pillDismissed = true;
        pill.remove();
      });
      pill.appendChild(closeBtn);

      container.appendChild(pill);
    }

    function openCaptureModal(prefill = {}) {
      const existing = shadow.querySelector('.backdrop');
      if (existing) existing.remove();

      const backdrop = document.createElement('div');
      backdrop.className = 'backdrop';

      const initialPrice = prefill.sellPrice !== undefined ? parsePrice(prefill.sellPrice) : '';
      const initialPayment = prefill.paymentMethod || defaultPaymentMethod;
      const initialTitle = prefill.title || '';

      backdrop.innerHTML = `
        <div class="modal" role="dialog" aria-label="Verkauf in DAC7 Guard erfassen">
          <div class="modal-head">
            <h3 data-modal-title></h3>
            <button type="button" class="pill-close" data-close>×</button>
          </div>
          <form class="modal-body">
            <label>
              Artikelbezeichnung
              <input type="text" name="title" required placeholder="z. B. iPhone 13 128GB" />
            </label>
            <div class="row-2">
              <label>
                Verkaufspreis (€)
                <input type="number" name="sellPrice" step="0.01" min="0" required placeholder="0,00" />
              </label>
              <label>
                Einkaufspreis damals (€)
                <input type="number" name="buyPrice" step="0.01" min="0" placeholder="optional" />
              </label>
            </div>
            <div class="row-2">
              <label>
                Verkaufsdatum
                <input type="date" name="date" required />
              </label>
              <label>
                Zahlungsart
                <select name="paymentMethod">
                  <option value="platform">Sicher bezahlen / Plattform (DAC7)</option>
                  <option value="cash">Barzahlung (nicht gemeldet)</option>
                  <option value="paypal_friends">PayPal privat (nicht gemeldet)</option>
                  <option value="bank_transfer">Überweisung (nicht gemeldet)</option>
                </select>
              </label>
            </div>
            <label class="checkbox-row">
              <input type="checkbox" name="isEverydayItem" checked />
              Alltagsgegenstand / gebrauchter Hausrat (i. d. R. steuerfrei)
            </label>
            <label class="checkbox-row">
              <input type="checkbox" name="heldUnderOneYear" />
              Weniger als 1 Jahr besessen (§ 23 EStG Spekulationsfrist)
            </label>
            <label>
              Notiz (optional)
              <input type="text" name="note" placeholder="z. B. Privatbesitz, 2022 neu gekauft" />
            </label>
            <div class="hint">
              100 % lokal im Browser gespeichert. Bei Kleinanzeigen zählen i. d. R. nur „Sicher bezahlen“-Verkäufe zur 30-Verkäufe / 2.000-€-Meldegrenze.
            </div>
            <div class="modal-foot">
              <button type="button" class="btn btn-cancel" data-close>Abbrechen</button>
              <button type="submit" class="btn btn-save">Lokal speichern</button>
            </div>
          </form>
        </div>
      `;

      // Populate all dynamic/scraped fields safely via DOM properties (never via innerHTML)
      const validPayments = new Set(['platform', 'cash', 'paypal_friends', 'bank_transfer']);
      const safePayment = validPayments.has(initialPayment) ? initialPayment : defaultPaymentMethod;
      backdrop.querySelector('[data-modal-title]').textContent = `Verkauf erfassen (${platformName})`;
      const titleInput = backdrop.querySelector('input[name="title"]');
      const priceInput = backdrop.querySelector('input[name="sellPrice"]');
      titleInput.value = String(initialTitle);
      if (initialPrice !== '') {
        priceInput.value = String(initialPrice);
      }
      backdrop.querySelector('input[name="date"]').value =
        /^\d{4}-\d{2}-\d{2}$/.test(String(prefill.date || '')) ? String(prefill.date) : todayIso();
      backdrop.querySelector('select[name="paymentMethod"]').value = safePayment;

      const onKeyDown = (e) => {
        if (e.key === 'Escape') close();
      };
      const close = () => {
        document.removeEventListener('keydown', onKeyDown);
        backdrop.remove();
      };
      document.addEventListener('keydown', onKeyDown);
      backdrop.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', close));
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) close();
      });

      const form = backdrop.querySelector('form');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const paymentMethod = String(fd.get('paymentMethod'));
        const payload = {
          platform,
          title: String(fd.get('title')).trim(),
          sellPrice: Number.parseFloat(String(fd.get('sellPrice'))) || 0,
          buyPrice: fd.get('buyPrice') ? Number.parseFloat(String(fd.get('buyPrice'))) : null,
          date: String(fd.get('date')) || todayIso(),
          paymentMethod,
          reportable: paymentMethod === 'platform',
          isEverydayItem: fd.get('isEverydayItem') === 'on',
          heldUnderOneYear: fd.get('heldUnderOneYear') === 'on',
          note: String(fd.get('note') || '').trim(),
          externalId: prefill.externalId || null,
          url: prefill.url || window.location.href
        };

        const res = await sendMessage({ type: 'DAC7_ADD_SALE', payload });
        if (res.ok) {
          currentStats = res.stats;
          renderPill();
          close();
          showToast(
            res.duplicate
              ? 'Dieser Verkauf war bereits gespeichert.'
              : `Gespeichert! (${currentStats.reportableCount}/30 • ${formatEur(currentStats.reportableRevenue)})`
          );
        } else {
          showToast('Fehler beim Speichern – bitte Seite neu laden.');
        }
      });

      shadow.appendChild(backdrop);
      if (titleInput.value) priceInput.focus();
      else titleInput.focus();
    }

    async function refresh() {
      const res = await sendMessage({
        type: 'DAC7_GET_SUMMARY',
        platform,
        year: new Date().getFullYear()
      });
      if (res.ok) {
        currentStats = res.stats;
        if (res.settings && res.settings.showFloatingPill !== false) {
          renderPill();
        } else {
          const existing = container.querySelector('.pill');
          if (existing) existing.remove();
        }
        return res;
      }
      return null;
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(() => {
        try {
          refresh();
        } catch {
          // Ignore if extension context was invalidated after reload
        }
      });
    }

    return {
      refresh,
      openCaptureModal,
      showToast,
      parsePrice
    };
  }

  window.__DAC7_GUARD_WIDGET__ = { createWidget, parsePrice };
})();
