import {
  DAC7_MAX_REVENUE_EUR,
  DAC7_MAX_TRANSACTIONS,
  ESTG_PROFIT_EXEMPTION_EUR,
  PAYMENT_METHODS,
  PLATFORMS,
  calculatePlatformStats,
  calculateTaxSummary,
  filterSalesByYear,
  formatEur,
  getTodayIso,
  isSaleReportable
} from '../shared/rules.js';
import {
  addSale,
  clearAllSales,
  deleteSale,
  getSales,
  getSettings,
  mergeImportedSales,
  saveSettings,
  updateSale
} from '../shared/storage.js';
import {
  buildCsv,
  buildJsonBackup,
  parseJsonBackup,
  triggerDownload
} from '../shared/export.js';
import { applyI18n, detectLocale, t } from '../shared/i18n.js';

const state = {
  sales: [],
  settings: null,
  year: new Date().getFullYear(),
  platformFilter: 'all',
  search: '',
  editingId: null
};

const els = {
  yearSelect: document.getElementById('yearSelect'),
  printYear: document.getElementById('printYear'),
  printDate: document.getElementById('printDate'),
  platformCards: document.getElementById('platformCards'),
  totalRev: document.getElementById('totalRev'),
  totalCount: document.getElementById('totalCount'),
  netProfit: document.getElementById('netProfit'),
  costCoverage: document.getElementById('costCoverage'),
  shortTermProfit: document.getElementById('shortTermProfit'),
  estgBar: document.getElementById('estgBar'),
  searchInput: document.getElementById('searchInput'),
  platformFilter: document.getElementById('platformFilter'),
  salesBody: document.getElementById('salesBody'),
  addNewBtn: document.getElementById('addNewBtn'),
  addForm: document.getElementById('addForm'),
  cancelFormBtn: document.getElementById('cancelFormBtn'),
  csvBtn: document.getElementById('csvBtn'),
  printBtn: document.getElementById('printBtn'),
  warnThresholdInput: document.getElementById('warnThresholdInput'),
  langSelect: document.getElementById('langSelect'),
  showPillCheck: document.getElementById('showPillCheck'),
  captureDeleteCheck: document.getElementById('captureDeleteCheck'),
  jsonExportBtn: document.getElementById('jsonExportBtn'),
  jsonImportInput: document.getElementById('jsonImportInput'),
  clearAllBtn: document.getElementById('clearAllBtn'),
  settingsMsg: document.getElementById('settingsMsg')
};

function populateYears() {
  const current = new Date().getFullYear();
  const years = new Set([current, current - 1, current - 2]);
  for (const s of state.sales) {
    const y = Number(String(s.date || '').slice(0, 4));
    if (y >= 2023 && y <= current + 1) years.add(y);
  }
  const sorted = [...years].sort((a, b) => b - a);
  els.yearSelect.innerHTML = sorted
    .map((y) => `<option value="${y}" ${y === state.year ? 'selected' : ''}>${y}</option>`)
    .join('');
}

function statusLabel(status, lang) {
  if (status === 'exceeded') return t('exceeded', lang);
  if (status === 'warning') return t('warnShort', lang);
  return t('okShort', lang);
}

function populatePlatformSelects(lang = 'de') {
  const prevFilter = els.platformFilter.value || 'all';
  const optionsHtml = Object.values(PLATFORMS)
    .map((p) => `<option value="${p.id}">${p.name}</option>`)
    .join('');

  els.platformFilter.innerHTML = `<option value="all">${t('allPlatforms', lang)}</option>${optionsHtml}`;
  els.platformFilter.value = prevFilter;
  const addPlatformSelect = els.addForm.querySelector('select[name="platform"]');
  if (addPlatformSelect && addPlatformSelect.options.length !== Object.keys(PLATFORMS).length) {
    addPlatformSelect.innerHTML = optionsHtml;
  }
}

function renderPlatformCards(lang) {
  const warnRatio = state.settings?.warningRatio ?? 0.8;
  els.platformCards.innerHTML = '';

  const yearSales = filterSalesByYear(state.sales, state.year);
  const activePlatformIds = new Set(['kleinanzeigen', 'ebay', 'vinted']);
  for (const s of yearSales) {
    if (PLATFORMS[s.platform]) activePlatformIds.add(s.platform);
  }

  for (const p of Object.values(PLATFORMS)) {
    if (!activePlatformIds.has(p.id)) continue;
    const stats = calculatePlatformStats(state.sales, state.year, p.id, warnRatio);
    const card = document.createElement('article');
    card.className = 'card';
    const subText =
      stats.nonReportableCount > 0
        ? lang === 'en'
          ? `+ ${stats.nonReportableCount} private (${formatEur(stats.nonReportableRevenue)})`
          : `+ ${stats.nonReportableCount} privat (${formatEur(stats.nonReportableRevenue)})`
        : lang === 'en'
          ? `${stats.remainingTx} sales / ${formatEur(stats.remainingRevenue)} remaining`
          : `Noch ${stats.remainingTx} Verkäufe / ${formatEur(stats.remainingRevenue)} Luft`;

    card.innerHTML = `
      <div class="p-head">
        <h3>${p.name}</h3>
        <span class="badge ${stats.status}">${statusLabel(stats.status, lang)}</span>
      </div>
      <div>
        <div class="metric-row">
          <span>${t('salesDac7', lang)}</span>
          <strong>${stats.reportableCount} / ${DAC7_MAX_TRANSACTIONS}</strong>
        </div>
        <div class="bar">
          <div class="bar-fill ${stats.reportableCount >= DAC7_MAX_TRANSACTIONS ? 'exceeded' : stats.txProgressPct >= warnRatio * 100 ? 'warning' : ''}" style="width:${stats.txProgressPct}%"></div>
        </div>
      </div>
      <div>
        <div class="metric-row">
          <span>${t('revenueDac7', lang)}</span>
          <strong>${formatEur(stats.reportableRevenue)} / ${formatEur(DAC7_MAX_REVENUE_EUR)}</strong>
        </div>
        <div class="bar">
          <div class="bar-fill ${stats.reportableRevenue > DAC7_MAX_REVENUE_EUR ? 'exceeded' : stats.revenueProgressPct >= warnRatio * 100 ? 'warning' : ''}" style="width:${stats.revenueProgressPct}%"></div>
        </div>
      </div>
      <div class="sub">${subText}</div>
    `;
    els.platformCards.appendChild(card);
  }
}

function renderTaxSummary(lang) {
  const warnRatio = state.settings?.warningRatio ?? 0.8;
  const tax = calculateTaxSummary(state.sales, state.year, warnRatio);

  els.totalRev.textContent = formatEur(tax.totalRevenue);
  els.totalCount.textContent =
    lang === 'en'
      ? `${tax.totalSalesCount} sales in ${state.year}`
      : `${tax.totalSalesCount} Verkäufe im Jahr ${state.year}`;
  els.netProfit.textContent = `${tax.netProfitLoss > 0 ? '+' : ''}${formatEur(tax.netProfitLoss)}`;
  els.costCoverage.textContent =
    lang === 'en'
      ? `${tax.itemsWithCost} of ${tax.totalSalesCount} items with purchase price`
      : `${tax.itemsWithCost} von ${tax.totalSalesCount} Artikeln mit Einkaufspreis`;
  els.shortTermProfit.textContent = `${formatEur(tax.taxableShortTermProfit)} / ${formatEur(ESTG_PROFIT_EXEMPTION_EUR)}`;
  els.estgBar.style.width = `${tax.profitProgressPct}%`;
  els.estgBar.className = `bar-fill ${tax.status === 'ok' ? '' : tax.status}`;
}

function renderTable(lang) {
  let list = filterSalesByYear(state.sales, state.year);
  if (state.platformFilter !== 'all') {
    list = list.filter((s) => s.platform === state.platformFilter);
  }
  if (state.search) {
    const q = state.search.toLowerCase();
    list = list.filter(
      (s) =>
        (s.title || '').toLowerCase().includes(q) ||
        (s.note || '').toLowerCase().includes(q)
    );
  }

  list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  els.salesBody.innerHTML = '';

  if (list.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="8" style="text-align:center;color:#64748b;padding:24px;">${t('noSalesYet', lang)}</td>`;
    els.salesBody.appendChild(tr);
    return;
  }

  for (const sale of list) {
    const tr = document.createElement('tr');
    const hasBuy = sale.buyPrice !== null && sale.buyPrice !== undefined;
    const diff = hasBuy ? Number(sale.sellPrice) - Number(sale.buyPrice) : null;
    const reportable = isSaleReportable(sale);
    const pName = PLATFORMS[sale.platform]?.name || sale.platform;
    const pmName = PAYMENT_METHODS[sale.paymentMethod]?.label || sale.paymentMethod;

    tr.innerHTML = `
      <td style="white-space:nowrap;">${sale.date}</td>
      <td>${pName}</td>
      <td>
        <div class="title-cell"></div>
        <div class="note-line"></div>
      </td>
      <td class="num"><strong>${formatEur(sale.sellPrice)}</strong></td>
      <td class="num">${hasBuy ? formatEur(sale.buyPrice) : '–'}</td>
      <td class="num ${diff !== null ? (diff > 0 ? 'profit-pos' : 'profit-neg') : ''}">
        ${diff !== null ? `${diff > 0 ? '+' : ''}${formatEur(diff)}` : '–'}
      </td>
      <td>
        <span class="badge ${reportable ? 'warning' : 'ok'}">${reportable ? t('yes', lang) : t('no', lang)}</span>
      </td>
      <td class="no-print action-cell">
        <button class="edit-btn" title="Edit">✎</button>
        <button class="del-btn" title="Delete">×</button>
      </td>
    `;

    tr.querySelector('.title-cell').textContent = sale.title;
    const flags = [pmName];
    if (sale.isEverydayItem !== false) flags.push(lang === 'en' ? 'Household' : 'Hausrat');
    if (sale.heldUnderOneYear) flags.push(lang === 'en' ? '< 1 year' : '< 1 Jahr');
    if (sale.note) flags.push(sale.note);
    tr.querySelector('.note-line').textContent = flags.join(' • ');

    tr.querySelector('.edit-btn').addEventListener('click', () => {
      openEditForm(sale);
    });

    tr.querySelector('.del-btn').addEventListener('click', async () => {
      if (!window.confirm(`Verkauf „${sale.title}“ wirklich löschen?`)) return;
      if (state.editingId === sale.id) resetAddForm();
      state.sales = await deleteSale(sale.id);
      render();
    });

    els.salesBody.appendChild(tr);
  }
}

function render() {
  const lang = detectLocale(state.settings?.language || 'auto');
  applyI18n(document, lang);
  populatePlatformSelects(lang);
  els.printYear.textContent = String(state.year);
  els.printDate.textContent = new Date().toLocaleDateString(lang === 'en' ? 'en-GB' : 'de-DE');
  renderPlatformCards(lang);
  renderTaxSummary(lang);
  renderTable(lang);
}

function resetAddForm() {
  state.editingId = null;
  els.addForm.reset();
  els.addForm.querySelector('input[name="date"]').value = getTodayIso();
  els.addForm.querySelector('input[name="isEverydayItem"]').checked = true;
  const plat = els.addForm.querySelector('select[name="platform"]');
  const pm = els.addForm.querySelector('select[name="paymentMethod"]');
  if (plat && pm) {
    pm.value = plat.value === 'kleinanzeigen' ? 'cash' : 'platform';
  }
  const submitBtn = els.addForm.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Verkauf speichern';
  els.addForm.classList.add('hidden');
}

function openEditForm(sale) {
  state.editingId = sale.id;
  els.addForm.querySelector('select[name="platform"]').value = sale.platform;
  els.addForm.querySelector('input[name="title"]').value = sale.title || '';
  els.addForm.querySelector('input[name="date"]').value = sale.date || getTodayIso();
  els.addForm.querySelector('input[name="sellPrice"]').value = String(sale.sellPrice ?? '');
  els.addForm.querySelector('input[name="buyPrice"]').value =
    sale.buyPrice !== null && sale.buyPrice !== undefined ? String(sale.buyPrice) : '';
  els.addForm.querySelector('select[name="paymentMethod"]').value = sale.paymentMethod || 'platform';
  els.addForm.querySelector('input[name="note"]').value = sale.note || '';
  els.addForm.querySelector('input[name="isEverydayItem"]').checked = sale.isEverydayItem !== false;
  els.addForm.querySelector('input[name="heldUnderOneYear"]').checked = Boolean(sale.heldUnderOneYear);
  const submitBtn = els.addForm.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Änderungen speichern';
  els.addForm.classList.remove('hidden');
  els.addForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showMsg(text) {
  els.settingsMsg.textContent = text;
  setTimeout(() => {
    if (els.settingsMsg.textContent === text) els.settingsMsg.textContent = '';
  }, 4000);
}

async function init() {
  const [sales, settings] = await Promise.all([getSales(), getSettings()]);
  state.sales = sales;
  state.settings = settings;

  els.warnThresholdInput.value = String(Math.round((settings.warningRatio ?? 0.8) * 100));
  if (els.langSelect) els.langSelect.value = settings.language || 'auto';
  els.showPillCheck.checked = settings.showFloatingPill !== false;
  els.captureDeleteCheck.checked = settings.captureDeletePrompt !== false;

  populatePlatformSelects();
  const dateInput = els.addForm.querySelector('input[name="date"]');
  if (dateInput) dateInput.value = getTodayIso();
  const addPlatformSelect = els.addForm.querySelector('select[name="platform"]');
  const addPaymentSelect = els.addForm.querySelector('select[name="paymentMethod"]');
  if (addPlatformSelect && addPaymentSelect) {
    const syncPayment = () => {
      const meta = PLATFORMS[addPlatformSelect.value];
      addPaymentSelect.value = meta && meta.defaultReportable ? 'platform' : 'cash';
    };
    syncPayment();
    addPlatformSelect.addEventListener('change', syncPayment);
  }

  populateYears();
  render();

  els.yearSelect.addEventListener('change', () => {
    state.year = Number(els.yearSelect.value);
    render();
  });

  els.searchInput.addEventListener('input', () => {
    state.search = els.searchInput.value.trim();
    renderTable();
  });

  els.platformFilter.addEventListener('change', () => {
    state.platformFilter = els.platformFilter.value;
    renderTable();
  });

  els.addNewBtn.addEventListener('click', () => {
    if (state.editingId) {
      resetAddForm();
      els.addForm.classList.remove('hidden');
    } else {
      els.addForm.classList.toggle('hidden');
    }
  });

  els.cancelFormBtn.addEventListener('click', () => {
    resetAddForm();
  });

  els.addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(els.addForm);
    const paymentMethod = String(fd.get('paymentMethod'));
    const payload = {
      platform: String(fd.get('platform')),
      title: String(fd.get('title')).trim(),
      date: String(fd.get('date')) || getTodayIso(),
      sellPrice: Number.parseFloat(String(fd.get('sellPrice'))) || 0,
      buyPrice: fd.get('buyPrice') ? Number.parseFloat(String(fd.get('buyPrice'))) : null,
      paymentMethod,
      reportable: paymentMethod === 'platform',
      isEverydayItem: fd.get('isEverydayItem') === 'on',
      heldUnderOneYear: fd.get('heldUnderOneYear') === 'on',
      note: String(fd.get('note') || '').trim()
    };

    if (state.editingId) {
      await updateSale(state.editingId, payload);
      state.sales = await getSales();
    } else {
      const res = await addSale(payload);
      state.sales = res.sales;
    }

    resetAddForm();
    populateYears();
    render();
  });

  els.csvBtn.addEventListener('click', () => {
    const csv = buildCsv(state.sales, state.year);
    triggerDownload(csv, `dac7-guard-${state.year}.csv`, 'text/csv;charset=utf-8');
  });

  els.printBtn.addEventListener('click', () => window.print());

  // Settings listeners
  const persistSettings = async () => {
    const pct = Math.min(99, Math.max(50, Number(els.warnThresholdInput.value) || 80));
    state.settings = await saveSettings({
      warningRatio: pct / 100,
      language: els.langSelect ? els.langSelect.value : 'auto',
      showFloatingPill: els.showPillCheck.checked,
      captureDeletePrompt: els.captureDeleteCheck.checked
    });
    render();
    showMsg('Einstellungen gespeichert.');
  };

  els.warnThresholdInput.addEventListener('change', persistSettings);
  if (els.langSelect) els.langSelect.addEventListener('change', persistSettings);
  els.showPillCheck.addEventListener('change', persistSettings);
  els.captureDeleteCheck.addEventListener('change', persistSettings);

  els.jsonExportBtn.addEventListener('click', () => {
    const json = buildJsonBackup(state.sales, state.settings);
    triggerDownload(json, `dac7-guard-backup-${getTodayIso()}.json`, 'application/json');
    showMsg('JSON-Backup heruntergeladen.');
  });

  els.jsonImportInput.addEventListener('change', async () => {
    const file = els.jsonImportInput.files?.[0];
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Datei ist größer als 5 MB.');
      }
      const text = await file.text();
      const { sales } = parseJsonBackup(text);
      const { addedCount } = await mergeImportedSales(sales);
      state.sales = await getSales();
      populateYears();
      render();
      showMsg(`${addedCount} Verkäufe erfolgreich importiert.`);
    } catch (err) {
      showMsg(`Import fehlgeschlagen: ${err.message}`);
    } finally {
      els.jsonImportInput.value = '';
    }
  });

  els.clearAllBtn.addEventListener('click', async () => {
    if (!window.confirm('Wirklich alle gespeicherten Verkäufe unwiderruflich löschen?')) return;
    await clearAllSales();
    state.sales = [];
    render();
    showMsg('Alle lokalen Daten gelöscht.');
  });

  chrome.storage.onChanged.addListener(async () => {
    const [freshSales, freshSettings] = await Promise.all([getSales(), getSettings()]);
    state.sales = freshSales;
    state.settings = freshSettings;
    els.warnThresholdInput.value = String(Math.round((freshSettings.warningRatio ?? 0.8) * 100));
    if (els.langSelect) els.langSelect.value = freshSettings.language || 'auto';
    els.showPillCheck.checked = freshSettings.showFloatingPill !== false;
    els.captureDeleteCheck.checked = freshSettings.captureDeletePrompt !== false;
    populateYears();
    render();
  });
}

init();
