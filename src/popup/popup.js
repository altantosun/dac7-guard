import {
  DAC7_MAX_REVENUE_EUR,
  DAC7_MAX_TRANSACTIONS,
  ESTG_PROFIT_EXEMPTION_EUR,
  PLATFORMS,
  calculatePlatformStats,
  calculateTaxSummary,
  filterSalesByYear,
  formatEur,
  getTodayIso,
  isSaleReportable
} from '../shared/rules.js';
import { addSale, deleteSale, getSales, getSettings } from '../shared/storage.js';
import { buildCsv, triggerDownload } from '../shared/export.js';
import { applyI18n, detectLocale, t } from '../shared/i18n.js';

const state = {
  sales: [],
  settings: null,
  year: new Date().getFullYear(),
  platform: 'kleinanzeigen'
};

const els = {
  yearSelect: document.getElementById('yearSelect'),
  platformTabs: document.getElementById('platformTabs'),
  platformTitle: document.getElementById('platformTitle'),
  platformSub: document.getElementById('platformSub'),
  statusBadge: document.getElementById('statusBadge'),
  txLabel: document.getElementById('txLabel'),
  txBar: document.getElementById('txBar'),
  revLabel: document.getElementById('revLabel'),
  revBar: document.getElementById('revBar'),
  nonReportableNote: document.getElementById('nonReportableNote'),
  estgLabel: document.getElementById('estgLabel'),
  estgBar: document.getElementById('estgBar'),
  toggleAddBtn: document.getElementById('toggleAddBtn'),
  quickAddForm: document.getElementById('quickAddForm'),
  cancelAddBtn: document.getElementById('cancelAddBtn'),
  recentList: document.getElementById('recentList'),
  csvExportBtn: document.getElementById('csvExportBtn'),
  openDashboardBtn: document.getElementById('openDashboardBtn'),
  footerDashBtn: document.getElementById('footerDashBtn')
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

function renderTabs() {
  els.platformTabs.innerHTML = '';
  for (const p of Object.values(PLATFORMS)) {
    const btn = document.createElement('button');
    btn.className = `tab ${p.id === state.platform ? 'active' : ''}`;
    btn.textContent = p.name;
    btn.addEventListener('click', () => {
      state.platform = p.id;
      const pmSelect = els.quickAddForm.querySelector('select[name="paymentMethod"]');
      if (pmSelect) {
        pmSelect.value = p.defaultReportable ? 'platform' : 'cash';
      }
      render();
    });
    els.platformTabs.appendChild(btn);
  }
}

function statusText(status, lang) {
  if (status === 'exceeded') return t('exceeded', lang);
  if (status === 'warning') return t('warning', lang);
  return t('underLimit', lang);
}

function render() {
  renderTabs();

  const lang = detectLocale(state.settings?.language || 'auto');
  applyI18n(document, lang);
  const warningRatio = state.settings?.warningRatio ?? 0.8;
  const platformMeta = PLATFORMS[state.platform];
  const stats = calculatePlatformStats(state.sales, state.year, state.platform, warningRatio);
  const tax = calculateTaxSummary(state.sales, state.year, warningRatio);

  els.platformTitle.textContent = platformMeta.name;
  els.platformSub.textContent = `${state.year} • EU DAC7 / PStTG`;
  els.statusBadge.textContent = statusText(stats.status, lang);
  els.statusBadge.className = `badge ${stats.status}`;
  els.toggleAddBtn.textContent = t('quickAddBtn', lang);

  els.txLabel.textContent = `${stats.reportableCount} / ${DAC7_MAX_TRANSACTIONS}`;
  els.txBar.style.width = `${stats.txProgressPct}%`;
  els.txBar.className = `bar-fill ${stats.reportableCount >= DAC7_MAX_TRANSACTIONS ? 'exceeded' : stats.txProgressPct >= warningRatio * 100 ? 'warning' : ''}`;

  els.revLabel.textContent = `${formatEur(stats.reportableRevenue)} / ${formatEur(DAC7_MAX_REVENUE_EUR)}`;
  els.revBar.style.width = `${stats.revenueProgressPct}%`;
  els.revBar.className = `bar-fill ${stats.reportableRevenue > DAC7_MAX_REVENUE_EUR ? 'exceeded' : stats.revenueProgressPct >= warningRatio * 100 ? 'warning' : ''}`;

  if (stats.nonReportableCount > 0) {
    els.nonReportableNote.textContent = `Zusätzlich ${stats.nonReportableCount} nicht-meldepflichtige Verkäufe (${formatEur(stats.nonReportableRevenue)} Bar/PayPal/Überweisung) erfasst.`;
  } else {
    els.nonReportableNote.textContent = platformMeta.hint;
  }

  els.estgLabel.textContent = `${formatEur(tax.taxableShortTermProfit)} / ${formatEur(ESTG_PROFIT_EXEMPTION_EUR)}`;
  els.estgBar.style.width = `${tax.profitProgressPct}%`;
  els.estgBar.className = `bar-fill ${tax.status === 'ok' ? '' : tax.status}`;

  // Recent sales list for selected year & platform
  const platformSales = filterSalesByYear(state.sales, state.year)
    .filter((s) => s.platform === state.platform)
    .slice(0, 6);

  els.recentList.innerHTML = '';
  if (platformSales.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = `Noch keine ${platformMeta.name}-Verkäufe für ${state.year} erfasst.`;
    els.recentList.appendChild(empty);
  } else {
    for (const sale of platformSales) {
      const li = document.createElement('li');
      li.className = 'recent-item';
      const repLabel = isSaleReportable(sale) ? 'DAC7' : 'Privat';
      li.innerHTML = `
        <div class="meta">
          <div class="title"></div>
          <div class="subline">${sale.date} • ${repLabel}</div>
        </div>
        <div class="right">
          <span class="price">${formatEur(sale.sellPrice)}</span>
          <button class="del-btn" title="Eintrag löschen">×</button>
        </div>
      `;
      li.querySelector('.title').textContent = sale.title;
      li.querySelector('.del-btn').addEventListener('click', async () => {
        state.sales = await deleteSale(sale.id);
        render();
      });
      els.recentList.appendChild(li);
    }
  }
}

async function init() {
  const [sales, settings] = await Promise.all([getSales(), getSettings()]);
  state.sales = sales;
  state.settings = settings;

  const dateInput = els.quickAddForm.querySelector('input[name="date"]');
  if (dateInput) dateInput.value = getTodayIso();
  const pmSelect = els.quickAddForm.querySelector('select[name="paymentMethod"]');
  if (pmSelect) pmSelect.value = state.platform === 'kleinanzeigen' ? 'cash' : 'platform';

  populateYears();
  render();

  els.yearSelect.addEventListener('change', () => {
    state.year = Number(els.yearSelect.value);
    render();
  });

  els.toggleAddBtn.addEventListener('click', () => {
    els.quickAddForm.classList.toggle('hidden');
    els.toggleAddBtn.classList.toggle('hidden');
    els.quickAddForm.querySelector('input[name="title"]')?.focus();
  });

  els.cancelAddBtn.addEventListener('click', () => {
    els.quickAddForm.classList.add('hidden');
    els.toggleAddBtn.classList.remove('hidden');
  });

  els.quickAddForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(els.quickAddForm);
    const paymentMethod = String(fd.get('paymentMethod'));
    const res = await addSale({
      platform: state.platform,
      title: String(fd.get('title')).trim(),
      sellPrice: Number.parseFloat(String(fd.get('sellPrice'))) || 0,
      buyPrice: fd.get('buyPrice') ? Number.parseFloat(String(fd.get('buyPrice'))) : null,
      date: String(fd.get('date')) || getTodayIso(),
      paymentMethod,
      reportable: paymentMethod === 'platform',
      isEverydayItem: fd.get('isEverydayItem') === 'on',
      heldUnderOneYear: fd.get('heldUnderOneYear') === 'on'
    });
    state.sales = res.sales;
    els.quickAddForm.reset();
    els.quickAddForm.querySelector('input[name="date"]').value = getTodayIso();
    els.quickAddForm.querySelector('input[name="isEverydayItem"]').checked = true;
    els.quickAddForm.querySelector('select[name="paymentMethod"]').value =
      state.platform === 'kleinanzeigen' ? 'cash' : 'platform';
    els.quickAddForm.classList.add('hidden');
    els.toggleAddBtn.classList.remove('hidden');
    populateYears();
    render();
  });

  els.csvExportBtn.addEventListener('click', () => {
    const csv = buildCsv(state.sales, state.year);
    triggerDownload(csv, `dac7-guard-${state.year}.csv`, 'text/csv;charset=utf-8');
  });

  const openDash = () => chrome.runtime.openOptionsPage();
  els.openDashboardBtn.addEventListener('click', openDash);
  els.footerDashBtn.addEventListener('click', openDash);

  chrome.storage.onChanged.addListener(async () => {
    const [freshSales, freshSettings] = await Promise.all([getSales(), getSettings()]);
    state.sales = freshSales;
    state.settings = freshSettings;
    populateYears();
    render();
  });
}

init();
