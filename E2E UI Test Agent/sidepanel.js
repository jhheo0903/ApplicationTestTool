// sidepanel.js
'use strict';

let currentProvider = 'claude';
let loadedScenarios = [];    // 불러온 시나리오 목록
let selectedScenario = null; // 현재 선택된 시나리오

// 시나리오 인덱스 → 'pass' | 'fail' 결과 보존 (파일 재로드 전까지 유지)
const scenarioResults = new Map();

// ─── 초기화 ──────────────────────────────────────────

(async function init() {
  applyI18n();
  renderProviderTabs();
  await loadConfig();
  await updateTabInfo();

  // ── 실행 버튼 ──
  document.getElementById('runBtn').addEventListener('click', startAgent);
  document.getElementById('clearBtn').addEventListener('click', clearLog);

  // ── 설정 저장 ──
  document.getElementById('saveBtn').addEventListener('click', saveProviderConfig);

  // ── 파일 불러오기 ──
  document.getElementById('loadBtn').addEventListener('click', () => {
    document.getElementById('jsonFileInput').click();
  });
  document.getElementById('jsonFileInput').addEventListener('change', loadScenarios);

  // ── 설정 오버레이 ──
  document.getElementById('settingsBtn').addEventListener('click', toggleSettings);
  document.addEventListener('click', (e) => {
    const overlay = document.getElementById('settingsOverlay');
    const btn = document.getElementById('settingsBtn');
    if (overlay && btn && !overlay.contains(e.target) && !btn.contains(e.target)) {
      closeSettings();
    }
  });

  // ── 탭 전환 ──
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // ── Ctrl+Enter 실행 ──
  document.getElementById('scenarioInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) startAgent();
  });

  // ── 브라우저 탭 변경 감지 ──
  chrome.tabs.onActivated.addListener(updateTabInfo);
  chrome.tabs.onUpdated.addListener((id, info) => {
    if (info.status === 'complete') updateTabInfo();
  });
})();

// ─── splitter (시나리오 목록 ↕ 실행 도크) ───────────

(function initSplitter() {
  const DOCK_MIN = 160;  // run-dock 최솟값 — textarea 1줄 + 버튼 여유
  const DOCK_MAX = 340;  // run-dock 최댓값 — 리스트가 너무 좁아지지 않도록
  const STORAGE_KEY = 'splitDockHeight';

  const handle = document.getElementById('splitHandle');
  const dock   = document.getElementById('runDock');

  function clamp(val) {
    return Math.min(Math.max(val, DOCK_MIN), DOCK_MAX);
  }

  // 저장된 높이 복원
  const saved = Number.parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
  if (saved >= DOCK_MIN) dock.style.height = `${clamp(saved)}px`;

  let dragging = false;
  let startY   = 0;
  let startH   = 0;

  handle.addEventListener('mousedown', (e) => {
    dragging = true;
    startY   = e.clientY;
    startH   = dock.offsetHeight;
    handle.classList.add('dragging');
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const delta = startY - e.clientY;
    dock.style.height = `${clamp(startH + delta)}px`;
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    localStorage.setItem(STORAGE_KEY, String(dock.offsetHeight));
  });
})();

// ─── i18n DOM 적용 ───────────────────────────────────

function applyI18n() {
  const { t } = globalThis.i18n;

  // data-i18n: textContent 교체
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (typeof t[key] === 'string') el.textContent = t[key];
  });

  // data-i18n-placeholder: placeholder 교체
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (typeof t[key] === 'string') el.placeholder = t[key];
  });

  // data-i18n-html: innerHTML 교체 (줄바꿈 포함 텍스트용)
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.dataset.i18nHtml;
    if (typeof t[key] === 'string') el.innerHTML = t[key].replaceAll('\n', '<br>');
  });

  // settingsBtn title
  document.getElementById('settingsBtn').title = t.settingsTitle;
}

// ─── 설정 오버레이 ───────────────────────────────────

function toggleSettings() {
  const overlay = document.getElementById('settingsOverlay');
  const btn = document.getElementById('settingsBtn');
  const isOpen = overlay.classList.toggle('open');
  btn.classList.toggle('active', isOpen);
}

function closeSettings() {
  document.getElementById('settingsOverlay').classList.remove('open');
  document.getElementById('settingsBtn').classList.remove('active');
}

// ─── 탭 전환 ─────────────────────────────────────────

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `pane${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
  });
  // 로그 탭에서는 splitter 숨김 (run-dock도 숨김)
  document.getElementById('mainSplit').classList.toggle('log-active', tab === 'log');
  document.getElementById('runDock').style.display = tab === 'log' ? 'none' : '';
}

// ─── 시나리오 JSON 불러오기 (로컬 파일) ─────────────

function loadScenarios(e) {
  const { t } = window.i18n;
  const file = e.target.files?.[0];
  if (!file) return;

  document.getElementById('jsonPathInput').value = file.name;
  setLoadStatus('', '');

  const reader = new FileReader();

  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);

      const list = Array.isArray(data) ? data : data.scenarios || [];
      if (list.length === 0) throw new Error(t.loadErrEmpty);

      loadedScenarios = list;
      renderScenarioList();
      setLoadStatus(t.loadOk(list.length), 'ok');

    } catch (err) {
      setLoadStatus(t.loadErrParse(err.message), 'err');
      renderScenarioListEmpty(t.parseFail(err.message));
    }
  };

  reader.onerror = () => {
    setLoadStatus(t.loadErrRead, 'err');
    renderScenarioListEmpty(t.fileReadFail);
  };

  reader.readAsText(file, 'UTF-8');

  e.target.value = '';
}

function setLoadStatus(msg, type) {
  const el = document.getElementById('loadStatus');
  el.textContent = msg;
  el.className = `load-msg ${type}`;
}

// ─── 시나리오 목록 렌더링 ────────────────────────────

function renderScenarioList() {
  const { t } = globalThis.i18n;
  const container = document.getElementById('scenarioList');
  container.innerHTML = '';

  document.getElementById('scenarioCount').textContent = loadedScenarios.length;

  loadedScenarios.forEach((sc, idx) => {
    const item = document.createElement('div');
    item.dataset.idx = idx;

    const result = scenarioResults.get(idx);
    item.className = result ? `scenario-item sc-done-${result}` : 'scenario-item';

    const id = sc.id || `SC-${String(idx + 1).padStart(3, '0')}`;
    const title = sc.title || sc.name || `scenario ${idx + 1}`;
    const desc = sc.description || sc.scenario || '';
    let badge = '';
    if (result === 'pass')      badge = '<span class="sc-result-badge sc-result-pass">✓</span>';
    else if (result === 'fail') badge = '<span class="sc-result-badge sc-result-fail">✗</span>';

    item.innerHTML = `
      <span class="sc-id">${id}</span>
      <div class="sc-info">
        <div class="sc-title">${title}${badge}</div>
        <div class="sc-desc">${desc.slice(0, 60)}${desc.length > 60 ? '...' : ''}</div>
      </div>
      <button class="sc-run" data-idx="${idx}">${t.btnRun}</button>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('sc-run')) return;
      selectScenario(idx);
    });

    item.querySelector('.sc-run').addEventListener('click', (e) => {
      e.stopPropagation();
      forceSelectScenario(idx);
      startAgent();
    });

    container.appendChild(item);
  });
}

// ─── 시나리오 결과 마킹 ──────────────────────────────

// 실행 완료 후 해당 시나리오 아이템에 pass/fail 시각 표시
function markScenarioResult(pass) {
  const idx = loadedScenarios.indexOf(selectedScenario);
  if (idx === -1) return;

  const result = pass ? 'pass' : 'fail';
  scenarioResults.set(idx, result);

  const item = document.querySelector(`.scenario-item[data-idx="${idx}"]`);
  if (!item) return;

  item.classList.remove('sc-done-pass', 'sc-done-fail');
  item.classList.add(`sc-done-${result}`);

  const titleEl = item.querySelector('.sc-title');
  if (titleEl) {
    // 기존 배지 제거 후 재삽입
    titleEl.querySelectorAll('.sc-result-badge').forEach(el => el.remove());
    const badge = document.createElement('span');
    badge.className = `sc-result-badge sc-result-${result}`;
    badge.textContent = pass ? '✓' : '✗';
    titleEl.appendChild(badge);
  }
}

function renderScenarioListEmpty(msg) {
  document.getElementById('scenarioList').innerHTML =
    `<div class="scenario-empty">${msg}</div>`;
}

document.getElementById('scenarioList').addEventListener('click', (e) => {
  if (!e.target.closest('.scenario-item')) {
    deselectScenario();
  }
});

// ─── 시나리오 선택 ───────────────────────────────────

function forceSelectScenario(idx) {
  const sc = loadedScenarios[idx];
  if (!sc) return;
  selectedScenario = sc;

  document.querySelectorAll('.scenario-item').forEach(el => {
    el.classList.toggle('selected', parseInt(el.dataset.idx) === idx);
  });

  const scenarioText = sc.scenario || sc.description || sc.steps || '';
  document.getElementById('scenarioInput').value = scenarioText;

  const id = sc.id || `SC-${String(idx + 1).padStart(3, '0')}`;
  const title = sc.title || sc.name || scenarioText.slice(0, 30);
  document.getElementById('runSelected').innerHTML = `
    <span class="run-selected-badge">${id}</span>
    <span class="run-selected-title">${title}</span>
  `;
}

function selectScenario(idx) {
  const sc = loadedScenarios[idx];
  if (!sc) return;

  const alreadySelected = selectedScenario === sc;
  if (alreadySelected) {
    deselectScenario();
    return;
  }

  selectedScenario = sc;

  document.querySelectorAll('.scenario-item').forEach(el => {
    el.classList.toggle('selected', Number.parseInt(el.dataset.idx) === idx);
  });

  const scenarioText = sc.scenario || sc.description || sc.steps || '';
  document.getElementById('scenarioInput').value = scenarioText;

  const id = sc.id || `SC-${String(idx + 1).padStart(3, '0')}`;
  const title = sc.title || sc.name || scenarioText.slice(0, 30);
  document.getElementById('runSelected').innerHTML = `
    <span class="run-selected-badge">${id}</span>
    <span class="run-selected-title">${title}</span>
  `;
}

// ─── 선택 해제 ───────────────────────────────────────

function deselectScenario() {
  const { t } = globalThis.i18n;
  selectedScenario = null;
  document.querySelectorAll('.scenario-item').forEach(el => {
    el.classList.remove('selected');
  });
  document.getElementById('scenarioInput').value = '';
  document.getElementById('runSelected').innerHTML =
    `<span class="run-selected-empty">${t.noScenario}</span>`;
}

// ─── 탭 ID 가져오기 ──────────────────────────────────

async function getActiveTabId() {
  try {
    const { activeTabId } = await chrome.storage.session.get('activeTabId');
    if (activeTabId) {
      const tab = await chrome.tabs.get(activeTabId).catch(() => null);
      if (tab && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        return activeTabId;
      }
    }
  } catch {
    // session storage unavailable — fall through to tab query
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab && !tab.url?.startsWith('chrome://')) return tab.id;
  } catch {
    // query failed — try fallback
  }

  try {
    const tabs = await chrome.tabs.query({ active: true });
    const tab = tabs.find(t => t.url && !t.url.startsWith('chrome://'));
    return tab?.id || null;
  } catch {
    return null;
  }
}

// ─── 탭 통신 ─────────────────────────────────────────

async function pingTab(tabId) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    return res?.alive === true;
  } catch { return false; }
}

async function sendToTab(tabId, message) {
  const alive = await pingTab(tabId);
  if (!alive) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      await sleep(500);
    } catch (e) {
      const { t } = globalThis.i18n;
      throw new Error(t.errInjectFail(e.message));
    }
    if (!await pingTab(tabId)) {
      const { t } = globalThis.i18n;
      throw new Error(t.errContentNoResp);
    }
  }
  return await chrome.tabs.sendMessage(tabId, message);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function waitForTabLoad(tabId) {
  return new Promise(resolve => {
    const fn = (id, info) => {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(fn);
        setTimeout(resolve, 1000);
      }
    };
    chrome.tabs.onUpdated.addListener(fn);
    setTimeout(() => { chrome.tabs.onUpdated.removeListener(fn); resolve(); }, 10000);
  });
}

// 클릭 후 탭 DOM이 안정될 때까지 대기
// - 탭 status가 complete로 바뀌면 즉시 완료 (전체 페이지 로드)
// - SPA 라우팅처럼 status 변화가 없으면 stableMs 동안 변화 없을 때 완료
// - maxMs 초과 시 강제 완료
async function waitForDomStable(tabId, { stableMs = 600, maxMs = 8000 } = {}) {
  const deadline = Date.now() + maxMs;

  // 탭 status 변화 감지 (전통적인 페이지 이동)
  const tabLoadPromise = new Promise(resolve => {
    const fn = (id, info) => {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(fn);
        resolve('tab-load');
      }
    };
    chrome.tabs.onUpdated.addListener(fn);
    // maxMs 후 자동 정리
    setTimeout(() => { chrome.tabs.onUpdated.removeListener(fn); resolve('timeout'); }, maxMs);
  });

  // DOM 안정화 감지: content.js에 주기적으로 DOM 요소 수를 폴링해 변화가 없으면 안정됐다고 판단
  const stablePromise = (async () => {
    let prevCount = -1;
    let stableStart = 0;

    while (Date.now() < deadline) {
      await sleep(200);
      try {
        const resp = await chrome.tabs.sendMessage(tabId, { type: 'PING' }).catch(() => null);
        if (!resp?.alive) continue;

        const domResp = await chrome.tabs.sendMessage(tabId, { type: 'INJECT_IDS' }).catch(() => null);
        const count = domResp?.count ?? -1;

        if (count !== prevCount) {
          prevCount = count;
          stableStart = Date.now();
        } else if (Date.now() - stableStart >= stableMs) {
          return 'stable';
        }
      } catch { break; }
    }
    return 'timeout';
  })();

  // 둘 중 먼저 완료되는 쪽 사용
  const reason = await Promise.race([tabLoadPromise, stablePromise]);

  // tab-load 완료면 추가 렌더링 여유시간
  if (reason === 'tab-load') await sleep(800);
  else await sleep(300);
}

// ─── 제공자 UI ───────────────────────────────────────

function renderProviderTabs() {
  const { PROVIDERS } = globalThis.AIProviders;
  const container = document.getElementById('providerTabs');
  container.innerHTML = '';

  Object.entries(PROVIDERS).forEach(([key, def]) => {
    const btn = document.createElement('button');
    btn.className = `provider-tab ${key === currentProvider ? 'active' : ''}`;
    btn.textContent = def.label;
    btn.dataset.provider = key;
    btn.addEventListener('click', () => selectProvider(key));
    container.appendChild(btn);
  });

  renderProviderFields();
}

function selectProvider(key) {
  currentProvider = key;
  document.querySelectorAll('.provider-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.provider === key);
  });
  renderProviderFields();
  loadFieldValues();
}

function renderProviderFields() {
  const { PROVIDERS } = globalThis.AIProviders;
  const def = PROVIDERS[currentProvider];
  const container = document.getElementById('providerFields');
  container.innerHTML = '';

  def.fields.forEach(field => {
    const row = document.createElement('div');
    row.className = 'field-row';

    const label = document.createElement('span');
    label.className = 'field-label';
    label.textContent = field.label;

    let input;
    if (field.type === 'select') {
      input = document.createElement('select');
      input.className = 'field-select';
      field.options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt.value; o.textContent = opt.label;
        input.appendChild(o);
      });
    } else {
      input = document.createElement('input');
      input.type = field.type;
      input.className = 'field-input';
      input.placeholder = field.placeholder || '';
    }

    input.dataset.fieldKey = field.key;
    row.appendChild(label);
    row.appendChild(input);
    container.appendChild(row);
  });
}

// ─── 설정 저장/로드 ──────────────────────────────────

async function loadConfig() {
  const result = await chrome.storage.local.get(['selectedProvider', 'providerConfigs']);
  if (result.selectedProvider) currentProvider = result.selectedProvider;
  renderProviderTabs();
  loadFieldValues(result.providerConfigs);
}

function loadFieldValues(configs) {
  if (!configs) {
    chrome.storage.local.get('providerConfigs').then(r => loadFieldValues(r.providerConfigs));
    return;
  }
  const config = configs?.[currentProvider] || {};
  document.querySelectorAll('[data-field-key]').forEach(el => {
    const val = config[el.dataset.fieldKey];
    if (val !== undefined) el.value = val;
  });
}

async function saveProviderConfig() {
  const { t } = globalThis.i18n;
  const result = await chrome.storage.local.get('providerConfigs');
  const all = result.providerConfigs || {};
  const config = {};
  document.querySelectorAll('[data-field-key]').forEach(el => {
    config[el.dataset.fieldKey] = el.value.trim();
  });
  all[currentProvider] = config;
  await chrome.storage.local.set({ providerConfigs: all, selectedProvider: currentProvider });

  const status = document.getElementById('saveStatus');
  status.textContent = t.saveOk;
  status.className = 'save-status ok';
  setTimeout(() => { status.textContent = ''; }, 2000);
}

function getCurrentConfig() {
  const config = {};
  document.querySelectorAll('[data-field-key]').forEach(el => {
    config[el.dataset.fieldKey] = el.value.trim();
  });
  return config;
}

// ─── 탭 정보 ─────────────────────────────────────────

async function updateTabInfo() {
  try {
    const tabId = await getActiveTabId();
    if (tabId) {
      const tab = await chrome.tabs.get(tabId);
      const url = new URL(tab.url);
      document.getElementById('tabInfo').textContent = url.hostname;
    }
  } catch (e) {}
}

// ─── 로그 ────────────────────────────────────────────

let isFirstLog = true;

function clearLog() {
  const { t } = globalThis.i18n;
  document.getElementById('logBody').innerHTML = `
    <div class="log-empty">
      <div class="log-empty-icon">◈</div>
      <div>${t.logEmptyDesc.replaceAll('\n', '<br>')}</div>
    </div>`;
  document.getElementById('logCount').textContent = '0';
  isFirstLog = true;
}

function appendLog(html) {
  const body = document.getElementById('logBody');
  if (isFirstLog) { body.innerHTML = ''; isFirstLog = false; }
  const div = document.createElement('div');
  div.innerHTML = html;
  body.appendChild(div.firstChild || div);
  body.scrollTop = body.scrollHeight;

  const count = body.querySelectorAll('.log-step, .log-info, .log-error, .log-warn, .result-card').length;
  document.getElementById('logCount').textContent = count;
}

function showThinking(step) {
  const { t } = globalThis.i18n;
  removeThinking();
  const div = document.createElement('div');
  div.className = 'log-thinking'; div.id = 'thinkingNode';
  div.innerHTML = `<div class="dots"><span></span><span></span><span></span></div>
    <span class="thinking-txt">${t.infoThinking(step)}</span>`;
  const body = document.getElementById('logBody');
  if (isFirstLog) { body.innerHTML = ''; isFirstLog = false; }
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function removeThinking() { document.getElementById('thinkingNode')?.remove(); }

// ─── 에이전트 상태 ───────────────────────────────────

let isRunning = false;
let startTime = null;

function setRunning(running) {
  const { t } = globalThis.i18n;
  isRunning = running;
  const btn = document.getElementById('runBtn');
  const dot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  if (running) {
    btn.disabled = true;
    btn.innerHTML = `<div class="spinner"></div> ${t.btnRunning}`;
    dot.className = 'status-indicator running';
    statusText.textContent = 'running';
    document.body.classList.add('agent-running');
    switchTab('log');
    startTime = Date.now();
  } else {
    btn.disabled = false;
    btn.innerHTML = t.btnAgentRun;
    statusText.textContent = '';
    document.body.classList.remove('agent-running');
  }
}

// ─── 프롬프트 ────────────────────────────────────────

function buildPrompt(state, scenario, history) {
  const elemText = state.elements.length === 0
    ? '  (no interactable elements)'
    : state.elements.map(el => {
        let line = `  [${el.id}] <${el.tag}${el.type ? ':' + el.type : ''}>`;
        if (el.isTableRow)        line += ' [table-row-clickable]';
        if (el.isJsTreeToggle)    line += ' [tree-toggle-btn]';
        if (el.isJsTreeNode)      line += ' [tree-node-select]';
        if (el.isJqGridCheckbox)  line += ` [jqgrid-checkbox checked=${el.checked}]`;
        if (el.checked !== null && !el.isJqGridCheckbox) line += ` checked=${el.checked}`;
        if (el.ariaLabel)   line += ` aria="${el.ariaLabel}"`;
        if (el.placeholder) line += ` placeholder="${el.placeholder}"`;
        if (el.name)        line += ` name="${el.name}"`;
        if (el.value)       line += ` value="${el.value}"`;
        if (el.text && el.text !== el.value) line += ` "${el.text.slice(0, 80)}"`;
        if (el.href && !el.href.startsWith('#')) line += ` → ${el.href.slice(0, 50)}`;
        return line;
      }).join('\n');

  const histText = history.length === 0 ? '  none'
    : history.map((h, i) => {
        const a = h.action;
        let s;
        if      (a.type === 'click')    s = `click(${a.elementId})`;
        else if (a.type === 'fill')     s = `fill(${a.elementId},"${a.value}")`;
        else if (a.type === 'navigate') s = `navigate(${a.url})`;
        else if (a.type === 'wait')     s = `wait(${a.ms}ms)`;
        else                            s = 'done';

        // urlAfter: 해당 액션 실행 후 다음 스텝에서 읽힌 실제 URL
        let urlChange = '';
        if (h.urlAfter && h.urlAfter !== h.url) {
          urlChange = ` [url-changed→${h.urlAfter.slice(0, 60)}]`;
        }
        return `  ${i + 1}. ${s}${urlChange} — ${h.thinking.slice(0, 60)}`;
      }).join('\n');

  const fieldValuesText = state.fieldValues?.length
    ? state.fieldValues.join('\n')
    : '  (none detected)';

  return `You are a web browser test agent.
Analyze the current page and decide the next single action to achieve the test scenario.

[CURRENT PAGE]
URL: ${state.url}
Title: ${state.title}
Body: ${state.visibleText.slice(0, 600)}

[PAGE FIELD VALUES — label/key: "actual value" pairs extracted from the page]
${fieldValuesText}

[INTERACTABLE ELEMENTS (${state.elements.length})]
${elemText}

[TEST SCENARIO]
${scenario}

[PREVIOUS ACTIONS]
${histText}

[TABLE/GRID RULES]
- <tr> elements marked [table-row-clickable] are clickable data rows
- Row text is formatted as "col1 | col2 | col3"
- To click a specific row, use the tr ID that contains the matching text
- After search/filter triggers AJAX reload, use wait(2000) before re-reading DOM
- [jqgrid-checkbox checked=false/true] = checkbox in a jqGrid row; click it to select/deselect that row
- To check a jqGrid row checkbox: click the [jqgrid-checkbox] element whose row text matches the target row

[jsTree RULES]
- [tree-toggle-btn] = toggle button to expand/collapse a node → use click
- [tree-node-select] = node text click → selects the item
- Node text format: [treenode(-selected)-open/leaf/closed] nodeName
- To expand a node: click its [tree-toggle-btn] ID
- To select a node: click its [tree-node-select] ID
- To see children of a closed node: click [tree-toggle-btn] → wait(1000) → re-read DOM
- [toggle-leaf] nodes have no children and cannot be expanded

[VERIFICATION RULES — for scenarios that check/confirm a value]
- If the scenario asks to verify/confirm/check a value (e.g. "confirm email is X"):
  1. Find the expected value in the scenario text
  2. Find the actual value in [PAGE FIELD VALUES] or [Body]
  3. If actual matches expected → done(pass:true, reason:"Expected '<expected>' — actual value is '<actual>'")
  4. If actual does NOT match → done(pass:false, reason:"Expected '<expected>' — actual value is '<actual>'")
  5. If the value cannot be found on the page → done(pass:false, reason:"Could not find '<field name>' on the page")
- Always quote both expected and actual values in the reason so the mismatch is explicit

[COMPLETION RULES — MUST FOLLOW]
1. If the PREVIOUS ACTIONS history shows [url-changed→...] after a click/fill → the action already succeeded → done(pass:true) immediately, do NOT repeat the action
2. If URL changed and the new URL is relevant to the scenario goal → done(pass:true)
3. Search scenario: after filling + submitting search and results page appears → done(pass:true)
4. If a fill+click already caused a page change → done(pass:true)
5. If the same action repeats 2+ times → done(pass:false, reason:"duplicate action")
6. If the current URL contains the scenario keyword → done(pass:true)

Respond ONLY in the following JSON format (no markdown):
{
  "thinking": "Brief analysis of current state and reason for next action (1-2 sentences)",
  "action": {
    "type": "click | fill | navigate | wait | done",
    "elementId": "el-XXX (for click/fill)",
    "value": "input value (for fill)",
    "url": "URL (for navigate)",
    "ms": milliseconds (for wait),
    "pass": true/false (for done),
    "reason": "REQUIRED for done — for verification: always include both expected and actual value (e.g. Expected 'jhheo0903@example.com' — actual value is 'other@example.com')"
  }
}`;
}

// ─── 에이전트 시작 전 유효성 검사 ───────────────────

function validateAgentConfig(t, config) {
  if (!globalThis.AIProviders) {
    appendLog(`<div class="log-error">${t.errProviders}</div>`);
    return false;
  }
  if (currentProvider === 'claude' && !config.apiKey) {
    appendLog(`<div class="log-error">${t.errApiKeyClaude}</div>`);
    return false;
  }
  if (currentProvider === 'azure_openai' && (!config.apiKey || !config.endpoint || !config.deployment)) {
    appendLog(`<div class="log-error">${t.errApiKeyAzure}</div>`);
    return false;
  }
  if (currentProvider === 'openai' && !config.apiKey) {
    appendLog(`<div class="log-error">${t.errApiKeyOpenAI}</div>`);
    return false;
  }
  return true;
}

// ─── 액션 문자열 변환 ────────────────────────────────

function actionToString(a) {
  if (a.type === 'click')    return `click(${a.elementId})`;
  if (a.type === 'fill')     return `fill(${a.elementId},"${a.value}")`;
  if (a.type === 'navigate') return 'navigate(...)';
  if (a.type === 'wait')     return `wait(${a.ms}ms)`;
  return `done→${a.pass ? 'PASS' : 'FAIL'}`;
}

// ─── 결과 카드 출력 ──────────────────────────────────

function appendResultCard(t, pass, reason, step, providerLabel) {
  const cls = pass ? 'pass' : 'fail';
  const title = pass ? t.resultPass : t.resultFail;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const displayReason = reason || (pass ? 'Scenario completed.' : 'No reason provided.');
  appendLog(`
    <div class="result-card ${cls}">
      <div class="result-title ${cls}">${title}</div>
      <div class="result-reason ${cls}">${displayReason}</div>
      <div class="result-meta">${t.resultMeta(step, elapsed, providerLabel)}</div>
    </div>`);
  document.getElementById('statusDot').className = `status-indicator ${cls}`;
  markScenarioResult(pass);
}

// ─── 중복 액션 감지 ──────────────────────────────────

function detectDuplicate(t, history, a, step, providerLabel) {
  const repeatable = a.type !== 'done' && a.type !== 'wait' && a.type !== 'navigate';
  if (!repeatable) return false;

  const dupes = history.filter(h =>
    h.action.type === a.type &&
    h.action.elementId === a.elementId &&
    h.action.value === a.value
  );
  if (dupes.length < 2) return false;

  appendLog(`<div class="log-warn">${t.warnDuplicate}</div>`);
  appendResultCard(t, false, t.resultDuplicate, step, providerLabel);
  return true;
}

// ─── 단일 스텝 DOM 읽기 + AI 호출 ───────────────────

async function runStep(t, tabId, config, scenario, history, step, providerLabel) {
  showThinking(step);

  let domResp;
  try {
    domResp = await sendToTab(tabId, { type: 'GET_DOM' });
  } catch (e) {
    removeThinking();
    appendLog(`<div class="log-error">${t.errDomFail(e.message)}</div>`);
    return null;
  }

  if (!domResp?.success) {
    removeThinking();
    appendLog(`<div class="log-error">${t.errDomResp}</div>`);
    return null;
  }

  const state = domResp.data;
  await updateTabInfo();

  // 직전 액션 실행 후 URL이 바뀌었으면 urlAfter를 업데이트한다.
  // buildPrompt 호출 전에 반영해야 AI가 "이미 URL이 바뀌었다"는 것을 인식한다.
  if (history.length > 0 && history.at(-1).urlAfter === null) {
    history.at(-1).urlAfter = state.url;
  }

  const prevUrl = history.length > 0 ? history.at(-1).url : null;
  if (prevUrl && prevUrl !== state.url) {
    appendLog(`<div class="log-info">${t.infoUrlChange(prevUrl.slice(0, 50), state.url.slice(0, 50))}</div>`);
  }

  let parsed;
  try {
    const { callAI } = globalThis.AIProviders;
    parsed = await callAI(currentProvider, config, buildPrompt(state, scenario, history));
  } catch (e) {
    removeThinking();
    appendLog(`<div class="log-error">${t.errAI(providerLabel, e.message)}</div>`);
    return null;
  }

  removeThinking();
  return { state, parsed };
}

// ─── 단일 스텝 액션 실행 ─────────────────────────────

async function executeStep(t, tabId, a) {
  try {
    if (a.type === 'click') {
      await sendToTab(tabId, { type: 'HIGHLIGHT', elementId: a.elementId });
      await sleep(350);
      const r = await sendToTab(tabId, { type: 'EXECUTE', action: a });
      if (!r?.success) appendLog(`<div class="log-warn">${t.warnClickFail(r?.error)}</div>`);
      // 고정 sleep 대신 DOM 안정화까지 대기 — 페이지 로딩이 느린 경우 다음 스텝 오동작 방지
      await waitForDomStable(tabId);
    } else if (a.type === 'fill') {
      await sendToTab(tabId, { type: 'HIGHLIGHT', elementId: a.elementId });
      await sleep(250);
      const r = await sendToTab(tabId, { type: 'EXECUTE', action: a });
      if (!r?.success) appendLog(`<div class="log-warn">${t.warnFillFail(r?.error)}</div>`);
      await sleep(400);
    } else if (a.type === 'navigate') {
      appendLog(`<div class="log-info">${t.infoNavigate(a.url)}</div>`);
      await chrome.tabs.update(tabId, { url: a.url });
      await waitForTabLoad(tabId);
      await sleep(500);
    } else if (a.type === 'wait') {
      appendLog(`<div class="log-info">${t.infoWait(a.ms)}</div>`);
      await sleep(a.ms || 2000);
    }
  } catch (e) {
    appendLog(`<div class="log-warn">${t.warnActionErr(e.message)}</div>`);
    await sleep(500);
  }
}

// ─── 스텝 로그 카드 출력 ────────────────────────────

function appendStepLog(step, a, thinking, providerLabel) {
  // done 스텝은 reason이 핵심 정보이므로 기본 열림, 나머지는 기본 접힘
  const isDone = a.type === 'done';
  const reasonHtml = isDone && a.reason
    ? `<div class="log-step-reason">⚑ ${a.reason}</div>`
    : '';

  const card = document.createElement('div');
  card.className = isDone ? 'log-step' : 'log-step collapsed';
  card.innerHTML = `
    <div class="log-step-head" role="button" tabindex="0">
      <span class="badge-step">STEP ${step}</span>
      <span class="badge-action">${actionToString(a)}</span>
      <span class="badge-provider">${providerLabel}</span>
      <span class="badge-toggle">▾</span>
    </div>
    <div class="log-step-body">
      <div class="log-step-thinking">${thinking}</div>
      ${reasonHtml}
    </div>`;

  // inline onclick 대신 addEventListener 사용 (MV3 CSP 준수)
  card.querySelector('.log-step-head').addEventListener('click', () => {
    card.classList.toggle('collapsed');
  });

  const body = document.getElementById('logBody');
  if (isFirstLog) { body.innerHTML = ''; isFirstLog = false; }
  body.appendChild(card);
  body.scrollTop = body.scrollHeight;

  const count = body.querySelectorAll('.log-step, .log-info, .log-error, .log-warn, .result-card').length;
  document.getElementById('logCount').textContent = count;
}

// ─── 에이전트 루프 본체 ──────────────────────────────

async function runAgentLoop(t, tabId, config, scenario, providerLabel) {
  const history = [];
  const MAX_STEPS = 20;

  for (let step = 1; step <= MAX_STEPS; step++) {
    const result = await runStep(t, tabId, config, scenario, history, step, providerLabel);
    if (!result) break;

    const { state, parsed } = result;
    const a = parsed.action;

    appendStepLog(step, a, parsed.thinking, providerLabel);
    history.push({ step, thinking: parsed.thinking, action: a, url: state.url, urlAfter: null });

    if (detectDuplicate(t, history, a, step, providerLabel)) break;

    if (a.type === 'done') {
      appendResultCard(t, a.pass, a.reason, step, providerLabel);
      break;
    }

    await executeStep(t, tabId, a);
  }
}

// ─── 메인 에이전트 루프 ──────────────────────────────

async function startAgent() {
  if (isRunning) return;
  const { t } = globalThis.i18n;

  switchTab('log');

  const scenario = document.getElementById('scenarioInput').value.trim();
  if (!scenario) {
    appendLog(`<div class="log-warn">${t.warnNoScenario}</div>`);
    return;
  }

  const config = getCurrentConfig();
  if (!validateAgentConfig(t, config)) return;

  const { PROVIDERS } = globalThis.AIProviders;
  const providerLabel = PROVIDERS[currentProvider]?.label || currentProvider;

  const tabId = await getActiveTabId();
  if (!tabId) {
    appendLog(`<div class="log-error">${t.errNoTab}</div>`);
    return;
  }

  clearLog();
  setRunning(true);

  const headerInfo = selectedScenario?.id
    ? `${selectedScenario.id} · ${selectedScenario.title ?? ''} · `
    : '';
  appendLog(`<div class="log-info">${t.infoStart(headerInfo, providerLabel, tabId)}</div>`);

  try {
    await runAgentLoop(t, tabId, config, scenario, providerLabel);
  } catch (e) {
    removeThinking();
    appendLog(`<div class="log-error">${t.errFatal(e.message)}</div>`);
  }

  setRunning(false);
}
