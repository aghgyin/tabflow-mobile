'use strict';

// ── State ─────────────────────────────────────────────────────────────────────
const STORE_KEY = 'tabflow_mobile_v1';
let collections = [];
let _activeColId = null;
let _searchQuery = '';
let _catGroups = []; // groups from current categorize sheet
const _openSheets = new Set();

// ── Storage ───────────────────────────────────────────────────────────────────
function loadCollections() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); }
  catch { return []; }
}
function persist() {
  localStorage.setItem(STORE_KEY, JSON.stringify(collections));
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function formatDate(ts) {
  return new Date(ts).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
}
function esc(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function getTabs(col) {
  if (col.windows && col.windows.length) return col.windows.flatMap(w => w.tabs || []);
  return col.tabs || [];
}
function favHtml(url) {
  if (!url) return '<div class="tab-fav-ph"></div>';
  return `<img class="tab-fav" src="${esc(url)}" width="20" height="20"
    onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'tab-fav-ph'}))">`;
}

// ── Collection ops ────────────────────────────────────────────────────────────
function createCollection(name, tabs = []) {
  const col = {
    id: genId(),
    name: (name || '').trim() || '未命名集合',
    createdAt: Date.now(),
    windows: [{ id: genId(), tabs }],
  };
  collections.unshift(col);
  persist();
  return col;
}
function addTabTo(colId, tab) {
  const col = collections.find(c => c.id === colId);
  if (!col) return false;
  if (getTabs(col).some(t => t.url === tab.url)) return false;
  if (!col.windows || !col.windows.length) col.windows = [{ id: genId(), tabs: [] }];
  col.windows[0].tabs.push(tab);
  persist();
  return true;
}
function removeTabFrom(colId, url) {
  const col = collections.find(c => c.id === colId);
  if (!col) return;
  if (col.windows) {
    col.windows = col.windows
      .map(w => ({ ...w, tabs: (w.tabs || []).filter(t => t.url !== url) }))
      .filter(w => w.tabs.length > 0);
  }
  persist();
}
function removeTabsFrom(colId, urlSet) {
  const col = collections.find(c => c.id === colId);
  if (!col) return;
  if (col.windows) {
    col.windows = col.windows
      .map(w => ({ ...w, tabs: (w.tabs || []).filter(t => !urlSet.has(t.url)) }))
      .filter(w => w.tabs.length > 0);
  }
  persist();
}
function renameCol(id, name) {
  const col = collections.find(c => c.id === id);
  if (col && name && name.trim()) { col.name = name.trim(); persist(); }
}
function deleteCol(id) {
  collections = collections.filter(c => c.id !== id);
  persist();
}

// ── Keyword categorization (same algorithm as desktop) ────────────────────────
const _STOP_EN = new Set([
  'a','an','the','and','or','is','are','was','were','for','to','of','in','on','at','by',
  'with','from','as','i','you','he','she','we','they','it','its','this','that','have','has',
  'be','do','not','no','all','any','more','about','how','what','when','where','why','who',
  'which','up','out','if','so','but','just','also','new','get','use','can','will','may',
  'one','two','vs','via','my','your','our','their','his','her','s','re','ve','ll','t',
  'page','home','tab','view','app','site','web','www','http','com','net','org',
]);
const _STOP_ZH = new Set([
  '的','了','是','在','有','也','都','和','與','或','但','可','就','不','很','最','第','個',
  '本','為','以','對','將','從','到','被','把','這','那','他','她','它','你','我','們','著',
  '過','才','又','更','已','及','中','上','下','一','二','三','什','么','好','大','小',
  '說','看','想','來','去','做','知','時','年','月','日','會','讓','因','所','而',
]);

function _tokenize(title) {
  const keys = new Set();
  for (const w of (title.match(/[A-Za-z][A-Za-z0-9+#.-]{1,}/g) || [])) {
    const lw = w.toLowerCase();
    if (!_STOP_EN.has(lw) && lw.length >= 2) keys.add(lw);
  }
  for (const chunk of (title.match(/[一-鿿㐀-䶿]+/g) || [])) {
    if (chunk.length >= 2 && chunk.length <= 6 && ![...chunk].every(c => _STOP_ZH.has(c))) {
      keys.add(chunk);
    }
    for (let i = 0; i <= chunk.length - 2; i++) {
      const bi = chunk.slice(i, i + 2);
      if (!_STOP_ZH.has(bi[0]) && !_STOP_ZH.has(bi[1])) keys.add(bi);
    }
  }
  return [...keys];
}

function categorize(tabs) {
  if (tabs.length < 2) return [{ name: '全部', tabs }];

  const tabKwSets = tabs.map(t => new Set(_tokenize(t.title || t.url || '')));

  const freq = {};
  const displayForm = {};
  tabs.forEach((tab, i) => {
    tabKwSets[i].forEach(k => {
      freq[k] = (freq[k] || 0) + 1;
      if (!displayForm[k]) displayForm[k] = k;
    });
    for (const w of ((tab.title || '').match(/[A-Za-z][A-Za-z0-9+#.-]{1,}/g) || [])) {
      const lw = w.toLowerCase();
      if (freq[lw] && w[0] >= 'A' && w[0] <= 'Z' && w !== w.toUpperCase()) {
        displayForm[lw] = w;
      }
    }
  });

  // Exclude keywords appearing in ALL tabs; require at least 2
  const candidates = Object.entries(freq)
    .filter(([_, c]) => c >= 2 && c < tabs.length)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);

  if (!candidates.length) return [{ name: '全部', tabs }];

  // Single-assignment: each tab → highest-frequency matching keyword
  const groupMap = {};
  const other = [];
  for (let i = 0; i < tabs.length; i++) {
    const best = candidates.find(([kw]) => tabKwSets[i].has(kw));
    if (!best) { other.push(tabs[i]); continue; }
    const key = best[0];
    (groupMap[key] = groupMap[key] || []).push(tabs[i]);
  }

  const groups = Object.entries(groupMap)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 12)
    .map(([kw, ts]) => ({ name: displayForm[kw] || kw, tabs: ts }));

  if (other.length) groups.push({ name: '其他', tabs: other });
  return groups.length ? groups : [{ name: '全部', tabs }];
}

// ── YouTube dedup ─────────────────────────────────────────────────────────────
function getYouTubeVideoId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) return u.searchParams.get('v') || null;
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0] || null;
  } catch {}
  return null;
}

function applyDedup(colId) {
  const col = collections.find(c => c.id === colId);
  if (!col) return 0;
  const allTabs = getTabs(col);
  const before = allTabs.length;
  const urlsToRemove = new Set();

  // YouTube: same video ID → keep URL without list= param (cleaner), or first seen
  const ytByVid = {};
  allTabs.forEach(t => {
    const vid = getYouTubeVideoId(t.url);
    if (vid) (ytByVid[vid] = ytByVid[vid] || []).push(t);
  });
  Object.values(ytByVid).filter(ts => ts.length > 1).forEach(ts => {
    ts.sort((a, b) => {
      const aList = a.url.includes('list=');
      const bList = b.url.includes('list=');
      if (aList !== bList) return aList ? 1 : -1;
      return a.url.length - b.url.length;
    });
    ts.slice(1).forEach(t => urlsToRemove.add(t.url));
  });

  // Exact URL dedup for remaining
  const seen = new Set();
  allTabs.forEach(t => {
    if (urlsToRemove.has(t.url)) return;
    if (seen.has(t.url)) { urlsToRemove.add(t.url); return; }
    seen.add(t.url);
  });

  if (!urlsToRemove.size) return 0;
  if (col.windows) {
    col.windows = col.windows
      .map(w => ({ ...w, tabs: (w.tabs || []).filter(t => !urlsToRemove.has(t.url)) }))
      .filter(w => w.tabs.length > 0);
  }
  persist();
  return before - getTabs(col).length;
}

// ── Share / Import ────────────────────────────────────────────────────────────
function encodeCol(col) {
  const data = {
    name: col.name,
    tabs: getTabs(col).map(t => ({ title: t.title, url: t.url, favicon: t.favicon || '' })),
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
}
function decodeShareUrl(raw) {
  try {
    const hash = raw.includes('#') ? raw.split('#').pop() : raw.trim();
    return JSON.parse(decodeURIComponent(escape(atob(hash))));
  } catch { return null; }
}
async function shareCol(col) {
  const encoded = encodeCol(col);
  const base = location.href.replace(/\/mobile\/.*$/, '/share/index.html');
  const url = `${base}#${encoded}`;
  if (navigator.share) {
    try { await navigator.share({ title: col.name, url }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  await copyText(url);
}
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('已複製到剪貼板！');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try { document.execCommand('copy'); showToast('已複製到剪貼板！'); }
    catch { showToast('複製失敗，請手動複製'); }
    document.body.removeChild(ta);
  }
}

// ── Sheets ────────────────────────────────────────────────────────────────────
function openSheet(id) {
  _openSheets.add(id);
  document.getElementById('overlay').classList.add('visible');
  document.getElementById(id).classList.add('open');
}
function closeSheet(id) {
  _openSheets.delete(id);
  document.getElementById(id).classList.remove('open');
  if (_openSheets.size === 0) document.getElementById('overlay').classList.remove('visible');
}
function closeAllSheets() {
  _openSheets.forEach(id => document.getElementById(id)?.classList.remove('open'));
  _openSheets.clear();
  document.getElementById('overlay').classList.remove('visible');
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg, ms = 2500) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('visible'), ms);
}

// ── Render ────────────────────────────────────────────────────────────────────
function filtered() {
  if (!_searchQuery) return collections;
  const q = _searchQuery.toLowerCase();
  return collections.filter(c =>
    c.name.toLowerCase().includes(q) ||
    getTabs(c).some(t => (t.title + t.url).toLowerCase().includes(q))
  );
}

function render() {
  const list = document.getElementById('collections-list');
  const empty = document.getElementById('empty-state');
  const cols = filtered();
  if (!cols.length) { list.innerHTML = ''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  list.innerHTML = cols.map(renderCard).join('');
}

function renderCard(col) {
  const tabs = getTabs(col);
  return `
  <div class="col-card" id="col-${col.id}">
    <div class="col-head" data-col-id="${col.id}">
      <div class="col-info">
        <div class="col-name">${esc(col.name)}</div>
        <div class="col-meta">${tabs.length} 個連結・${formatDate(col.createdAt)}</div>
      </div>
      <button class="btn-col-menu" data-menu-col="${col.id}" aria-label="更多選項">⋯</button>
      <svg class="chevron" width="20" height="20" viewBox="0 0 14 14" fill="none">
        <path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <div class="col-tabs">
      ${tabs.length
        ? tabs.map(t => `
          <div class="tab-row" data-open-url="${esc(t.url)}">
            ${favHtml(t.favicon)}
            <div class="tab-info">
              <div class="tab-title">${esc(t.title || t.url)}</div>
              <div class="tab-url">${esc(t.url)}</div>
            </div>
            <button class="btn-del-tab" data-del-col="${col.id}" data-del-url="${esc(t.url)}"
                    aria-label="從集合移除">×</button>
          </div>`).join('')
        : '<div class="tabs-empty">空集合</div>'}
    </div>
  </div>`;
}

// ── Main event delegation ─────────────────────────────────────────────────────
function bindEvents() {
  const list = document.getElementById('collections-list');

  list.addEventListener('click', e => {
    const delBtn = e.target.closest('[data-del-col]');
    if (delBtn) {
      e.preventDefault(); e.stopPropagation();
      removeTabFrom(delBtn.dataset.delCol, delBtn.dataset.delUrl);
      render();
      return;
    }

    const menuBtn = e.target.closest('[data-menu-col]');
    if (menuBtn) {
      e.stopPropagation();
      _activeColId = menuBtn.dataset.menuCol;
      const col = collections.find(c => c.id === _activeColId);
      document.getElementById('sheet-actions-title').textContent = col?.name || '';
      openSheet('sheet-actions');
      return;
    }

    const row = e.target.closest('[data-open-url]');
    if (row && !e.target.closest('button')) {
      const url = row.dataset.openUrl;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    const head = e.target.closest('.col-head');
    if (head && head.dataset.colId) {
      document.getElementById(`col-${head.dataset.colId}`)?.classList.toggle('expanded');
    }
  });
}

// ── Action sheet ──────────────────────────────────────────────────────────────
function bindActionSheet() {
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      const col = collections.find(c => c.id === _activeColId);

      switch (action) {
        case 'add-url':
          closeSheet('sheet-actions');
          openAddSheet({ preselect: _activeColId });
          break;
        case 'share':
          closeSheet('sheet-actions');
          if (col) await shareCol(col);
          break;
        case 'categorize':
          closeSheet('sheet-actions');
          if (col) showCategorize(col);
          break;
        case 'dedup':
          closeSheet('sheet-actions');
          setTimeout(() => {
            const removed = applyDedup(_activeColId);
            render();
            showToast(removed > 0 ? `已移除 ${removed} 個重複連結` : '沒有重複連結');
          }, 320);
          break;
        case 'rename':
          closeSheet('sheet-actions');
          setTimeout(() => {
            const name = prompt('集合名稱：', col?.name || '');
            if (name !== null) { renameCol(_activeColId, name); render(); }
          }, 320);
          break;
        case 'delete':
          closeSheet('sheet-actions');
          setTimeout(() => {
            if (confirm(`確定刪除「${col?.name}」？`)) {
              deleteCol(_activeColId);
              render();
              showToast('已刪除集合');
            }
          }, 320);
          break;
      }
    });
  });
}

// ── Add URL sheet ─────────────────────────────────────────────────────────────
function buildColPicker(preselect) {
  const picker = document.getElementById('col-picker');
  picker.innerHTML = collections.map(c => `
    <button class="col-chip${c.id === preselect ? ' active' : ''}" data-col-id="${c.id}">${esc(c.name)}</button>
  `).join('') + `<button class="col-chip" data-col-id="__new__">＋ 新集合</button>`;

  if (!preselect && collections.length) {
    picker.querySelector('.col-chip')?.classList.add('active');
  } else if (!preselect && !collections.length) {
    picker.querySelector('[data-col-id="__new__"]')?.classList.add('active');
    document.getElementById('inp-new-col-row').classList.remove('hidden');
  }

  picker.querySelectorAll('.col-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      picker.querySelectorAll('.col-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const newRow = document.getElementById('inp-new-col-row');
      if (chip.dataset.colId === '__new__') {
        newRow.classList.remove('hidden');
        setTimeout(() => document.getElementById('inp-new-col').focus(), 50);
      } else {
        newRow.classList.add('hidden');
      }
    });
  });
}

function openAddSheet(opts = {}) {
  document.getElementById('inp-url').value = opts.url || '';
  document.getElementById('inp-title').value = opts.title || '';
  document.getElementById('inp-new-col').value = '';
  document.getElementById('inp-new-col-row').classList.add('hidden');
  buildColPicker(opts.preselect || null);
  openSheet('sheet-add');
  setTimeout(() => {
    if (!opts.url) document.getElementById('inp-url').focus();
  }, 350);
}

async function confirmAdd() {
  const url = document.getElementById('inp-url').value.trim();
  if (!url) { showToast('請輸入網址'); return; }
  try { new URL(url); } catch { showToast('網址格式不正確'); return; }

  const title = document.getElementById('inp-title').value.trim() || url;
  const activeChip = document.querySelector('#col-picker .col-chip.active');
  const colId = activeChip?.dataset.colId;
  const newColName = document.getElementById('inp-new-col').value.trim();
  const tab = { title, url, favicon: '' };

  if (!colId || colId === '__new__') {
    createCollection(newColName || '未命名集合', [tab]);
    closeSheet('sheet-add');
    render();
    showToast('已儲存！');
  } else {
    const added = addTabTo(colId, tab);
    closeSheet('sheet-add');
    render();
    showToast(added ? '已儲存！' : '此連結已在集合中');
  }
}

// ── Import sheet ──────────────────────────────────────────────────────────────
function openImportSheet() {
  document.getElementById('inp-import-url').value = '';
  openSheet('sheet-import');
  setTimeout(() => document.getElementById('inp-import-url').focus(), 350);
}
function confirmImport() {
  const raw = document.getElementById('inp-import-url').value.trim();
  if (!raw) { showToast('請貼上分享連結'); return; }
  const data = decodeShareUrl(raw);
  if (!data || !Array.isArray(data.tabs)) { showToast('連結格式不正確'); return; }
  const tabs = data.tabs.map(t => ({ title: t.title || t.url, url: t.url, favicon: t.favicon || '' }));
  createCollection(data.name || '匯入集合', tabs);
  closeSheet('sheet-import');
  render();
  showToast(`已匯入「${data.name}」（${tabs.length} 個連結）`);
}

// ── Categorize sheet ──────────────────────────────────────────────────────────
function showCategorize(col) {
  _catGroups = categorize(getTabs(col));
  document.getElementById('sheet-cat-col-id').value = col.id;
  const otherCols = collections.filter(c => c.id !== col.id);

  const noGroups = _catGroups.length === 1 && _catGroups[0].name === '全部';
  document.getElementById('sheet-cat-body').innerHTML = noGroups
    ? `<div style="padding:20px 16px;text-align:center;color:var(--muted);font-size:14px">標題中沒有找到共同關鍵字</div>`
    : _catGroups.map((g, gi) => `
      <div class="cat-group">
        <div class="cat-group-name" style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
          <span>${esc(g.name)} <span class="cat-cnt">${g.tabs.length}</span></span>
          <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
            <button class="btn-save-group" data-save-group="${gi}"
              style="font-size:12px;padding:5px 12px;background:var(--blue);color:#fff;
                     border:none;border-radius:8px;cursor:pointer;white-space:nowrap">
              存為集合
            </button>
            ${otherCols.length ? `
              <select data-save-to-gi="${gi}"
                style="font-size:12px;padding:5px 8px;border:1px solid var(--border);
                       border-radius:8px;background:#fff;color:var(--text);max-width:110px">
                <option value="">存至集合…</option>
                ${otherCols.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}
              </select>
            ` : ''}
          </div>
        </div>
        ${g.tabs.map(t => `
          <div class="tab-row" data-open-url="${esc(t.url)}" style="padding-left:16px">
            ${favHtml(t.favicon)}
            <div class="tab-info">
              <div class="tab-title">${esc(t.title || t.url)}</div>
            </div>
          </div>`).join('')}
      </div>`).join('');

  openSheet('sheet-categorize');
}

// ── Handle Web Share Target (Android share sheet) ─────────────────────────────
function handleShareTarget() {
  const p = new URLSearchParams(location.search);
  const url = p.get('url') || p.get('text') || '';
  const title = p.get('title') || '';
  if (!url) return;
  history.replaceState({}, '', location.pathname);
  setTimeout(() => openAddSheet({ url, title }), 400);
}

// ── PWA service worker ────────────────────────────────────────────────────────
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
  collections = loadCollections();
  render();
  bindEvents();
  bindActionSheet();
  registerSW();
  handleShareTarget();

  document.getElementById('fab').addEventListener('click', () => openAddSheet());
  document.getElementById('btn-import').addEventListener('click', openImportSheet);

  document.getElementById('btn-add-cancel').addEventListener('click', () => closeSheet('sheet-add'));
  document.getElementById('btn-add-confirm').addEventListener('click', confirmAdd);
  document.getElementById('inp-url').addEventListener('keydown', e => { if (e.key === 'Enter') confirmAdd(); });

  document.getElementById('btn-import-cancel').addEventListener('click', () => closeSheet('sheet-import'));
  document.getElementById('btn-import-confirm').addEventListener('click', confirmImport);

  // Categorize sheet — close button
  document.getElementById('btn-cat-close').addEventListener('click', () => closeSheet('sheet-categorize'));

  // Categorize sheet body: open URL tap + per-group save buttons
  document.getElementById('sheet-cat-body').addEventListener('click', e => {
    // Per-group save
    const saveBtn = e.target.closest('[data-save-group]');
    if (saveBtn) {
      const idx = parseInt(saveBtn.dataset.saveGroup);
      const g = _catGroups[idx];
      if (!g) return;
      const srcId = document.getElementById('sheet-cat-col-id').value;
      const src = collections.find(c => c.id === srcId);
      if (!src) return;
      createCollection(`${src.name} — ${g.name}`, g.tabs);
      removeTabsFrom(srcId, new Set(g.tabs.map(t => t.url)));
      closeSheet('sheet-categorize');
      render();
      showToast(`已儲存「${src.name} — ${g.name}」並從原集合移除`);
      return;
    }
    // Open URL tap
    const row = e.target.closest('[data-open-url]');
    if (row && !e.target.closest('button')) {
      window.open(row.dataset.openUrl, '_blank', 'noopener,noreferrer');
    }
  });

  // 存至集合 — 將該群組分頁加入指定現有集合
  document.getElementById('sheet-cat-body').addEventListener('change', e => {
    const sel = e.target.closest('[data-save-to-gi]');
    if (!sel || !sel.value) return;
    const gi = parseInt(sel.dataset.saveToGi);
    const g = _catGroups[gi];
    if (!g) return;
    const srcId = document.getElementById('sheet-cat-col-id').value;
    const src = collections.find(c => c.id === srcId);
    const dstCol = collections.find(c => c.id === sel.value);
    if (!src || !dstCol) return;
    let added = 0;
    for (const tab of g.tabs) { if (addTabTo(dstCol.id, tab)) added++; }
    removeTabsFrom(srcId, new Set(g.tabs.map(t => t.url)));
    closeSheet('sheet-categorize');
    render();
    showToast(`已將 ${added} 個連結加入「${dstCol.name}」`);
  });

  // "全部存為獨立集合" — save each group as separate collection, remove from source
  document.getElementById('btn-cat-save').addEventListener('click', () => {
    const srcId = document.getElementById('sheet-cat-col-id').value;
    const src = collections.find(c => c.id === srcId);
    if (!src) { closeSheet('sheet-categorize'); return; }

    const saveable = _catGroups.filter(g => g.name !== '全部' && g.name !== '其他');
    if (!saveable.length) { showToast('無法分類（沒有共同關鍵字）'); return; }

    for (const g of saveable) {
      createCollection(`${src.name} — ${g.name}`, g.tabs);
    }
    const urlsToRemove = new Set(saveable.flatMap(g => g.tabs.map(t => t.url)));
    removeTabsFrom(srcId, urlsToRemove);

    closeSheet('sheet-categorize');
    render();
    showToast(`已分別存為 ${saveable.length} 個獨立集合，並從原集合移除`);
  });

  document.getElementById('overlay').addEventListener('click', closeAllSheets);

  document.getElementById('inp-search').addEventListener('input', e => {
    _searchQuery = e.target.value;
    render();
  });
}

document.addEventListener('DOMContentLoaded', init);
