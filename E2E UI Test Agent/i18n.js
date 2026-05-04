// i18n.js - 한국어/영어 다국어 지원 (브라우저 언어 기준, 기본값 영어)
'use strict';

const MESSAGES = {
  ko: {
    // 헤더
    settingsTitle:        'AI 모델 설정',
    // 설정 오버레이
    settingsLabel:        'AI Model',
    btnSave:              '저장',
    saveOk:               '✓ 저장 완료',
    // 탭
    tabScenario:          '시나리오',
    tabLog:               '실행 로그',
    // 시나리오 탭
    pathPlaceholder:      '파일 선택 후 경로가 표시됩니다',
    btnLoad:              '불러오기',
    scenarioEmptyTitle:   '불러오기로 JSON 파일을 선택하세요',
    scenarioEmptyDesc:    '시나리오 목록이 여기에 표시됩니다',
    btnRun:               '▶ 실행',
    // 시나리오 선택 없음
    noScenario:           '선택된 시나리오가 없습니다',
    // 실행 도크
    scenarioPlaceholder:  '시나리오를 선택하거나 직접 입력하세요 (Ctrl+Enter 실행)',
    btnAgentRun:          '▶ 에이전트 실행',
    btnRunning:           '실행 중...',
    // 로그 탭
    logLabel:             '실행 로그',
    btnClear:             '지우기',
    logEmptyDesc:         '에이전트를 실행하면\n여기에 로그가 표시됩니다',
    // 로드 상태
    loadOk:               (n) => `✓ ${n}개 로드됨`,
    loadErrParse:         (msg) => `JSON 파싱 오류: ${msg}`,
    loadErrRead:          '파일 읽기 실패',
    loadErrEmpty:         '시나리오가 없습니다 (빈 배열)',
    parseFail:            (msg) => `파싱 실패: ${msg}`,
    fileReadFail:         '파일을 읽을 수 없습니다',
    // 에러/경고 메시지
    warnNoScenario:       '⚠ 시나리오를 선택하거나 직접 입력해주세요',
    errProviders:         '❌ providers.js 로드 실패. 익스텐션을 새로고침해주세요.',
    errApiKeyClaude:      '❌ ⚙ 설정에서 API 키를 입력하고 저장해주세요',
    errApiKeyAzure:       '❌ Azure: API Key, Endpoint, Deployment 모두 필요합니다',
    errApiKeyOpenAI:      '❌ ⚙ 설정에서 OpenAI API 키를 입력하고 저장해주세요',
    errNoTab:             '❌ 활성 탭을 찾을 수 없습니다. 익스텐션 아이콘을 다시 클릭해주세요.',
    errDomFail:           (msg) => `❌ DOM 읽기 실패: ${msg}`,
    errDomResp:           '❌ DOM 응답 오류',
    errAI:                (label, msg) => `❌ AI 오류 (${label}): ${msg}`,
    errFatal:             (msg) => `❌ 치명적 오류: ${msg}`,
    errInjectFail:        (msg) => `content.js 주입 실패: ${msg}`,
    errContentNoResp:     'content.js가 응답하지 않습니다. 페이지를 새로고침 후 시도해주세요.',
    warnDuplicate:        '⚠ 동일 액션 반복 감지 → 강제 종료',
    warnClickFail:        (err) => `⚠ 클릭 실패: ${err}`,
    warnFillFail:         (err) => `⚠ 입력 실패: ${err}`,
    warnActionErr:        (msg) => `⚠ 액션 오류: ${msg}`,
    // 로그 정보
    infoStart:            (info, label, tabId) => `🚀 ${info}${label} · 탭: ${tabId}`,
    infoUrlChange:        (prev, next) => `🔀 URL 변경: ${prev} → ${next}`,
    infoNavigate:         (url) => `🌐 이동: ${url}`,
    infoWait:             (ms) => `⏳ ${ms}ms 대기...`,
    infoThinking:         (step) => `STEP ${step} — AI 분석 중...`,
    // 결과 카드
    resultPass:           '✓ PASS',
    resultFail:           '✗ FAIL',
    resultDuplicate:      '동일 액션 반복. 시나리오를 더 구체적으로 작성해주세요.',
    resultMeta:           (steps, elapsed, label) => `${steps} steps · ${elapsed}s · ${label}`,
    resultMetaNoLabel:    (steps, elapsed) => `${steps} steps · ${elapsed}s`,
  },

  en: {
    // Header
    settingsTitle:        'AI Model Settings',
    // Settings overlay
    settingsLabel:        'AI Model',
    btnSave:              'Save',
    saveOk:               '✓ Saved',
    // Tabs
    tabScenario:          'Scenarios',
    tabLog:               'Run Log',
    // Scenario tab
    pathPlaceholder:      'Select a file to show the path',
    btnLoad:              'Load',
    scenarioEmptyTitle:   'Select a JSON file via Load',
    scenarioEmptyDesc:    'Scenario list will appear here',
    btnRun:               '▶ Run',
    // No scenario selected
    noScenario:           'No scenario selected',
    // Run dock
    scenarioPlaceholder:  'Select a scenario or type one (Ctrl+Enter to run)',
    btnAgentRun:          '▶ Run Agent',
    btnRunning:           'Running...',
    // Log tab
    logLabel:             'Run Log',
    btnClear:             'Clear',
    logEmptyDesc:         'Run the agent to\nsee logs here',
    // Load status
    loadOk:               (n) => `✓ ${n} loaded`,
    loadErrParse:         (msg) => `JSON parse error: ${msg}`,
    loadErrRead:          'Failed to read file',
    loadErrEmpty:         'No scenarios found (empty array)',
    parseFail:            (msg) => `Parse failed: ${msg}`,
    fileReadFail:         'Cannot read the file',
    // Error/warning messages
    warnNoScenario:       '⚠ Please select or enter a scenario',
    errProviders:         '❌ Failed to load providers.js. Please reload the extension.',
    errApiKeyClaude:      '❌ ⚙ Please enter and save your API key in Settings',
    errApiKeyAzure:       '❌ Azure: API Key, Endpoint, and Deployment are all required',
    errApiKeyOpenAI:      '❌ ⚙ Please enter and save your OpenAI API key in Settings',
    errNoTab:             '❌ No active tab found. Please click the extension icon again.',
    errDomFail:           (msg) => `❌ DOM read failed: ${msg}`,
    errDomResp:           '❌ DOM response error',
    errAI:                (label, msg) => `❌ AI error (${label}): ${msg}`,
    errFatal:             (msg) => `❌ Fatal error: ${msg}`,
    errInjectFail:        (msg) => `content.js injection failed: ${msg}`,
    errContentNoResp:     'content.js is not responding. Please refresh the page and try again.',
    warnDuplicate:        '⚠ Duplicate action detected → Force stopped',
    warnClickFail:        (err) => `⚠ Click failed: ${err}`,
    warnFillFail:         (err) => `⚠ Fill failed: ${err}`,
    warnActionErr:        (msg) => `⚠ Action error: ${msg}`,
    // Log info
    infoStart:            (info, label, tabId) => `🚀 ${info}${label} · tab: ${tabId}`,
    infoUrlChange:        (prev, next) => `🔀 URL changed: ${prev} → ${next}`,
    infoNavigate:         (url) => `🌐 Navigate: ${url}`,
    infoWait:             (ms) => `⏳ Waiting ${ms}ms...`,
    infoThinking:         (step) => `STEP ${step} — AI analyzing...`,
    // Result card
    resultPass:           '✓ PASS',
    resultFail:           '✗ FAIL',
    resultDuplicate:      'Duplicate action detected. Please write a more specific scenario.',
    resultMeta:           (steps, elapsed, label) => `${steps} steps · ${elapsed}s · ${label}`,
    resultMetaNoLabel:    (steps, elapsed) => `${steps} steps · ${elapsed}s`,
  },
};

// 브라우저 언어가 한국어면 'ko', 그 외 모두 'en'
const lang = navigator.language?.startsWith('ko') ? 'ko' : 'en';
const t = MESSAGES[lang];

globalThis.i18n = { t, lang };
