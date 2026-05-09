// providers.js - AI 모델 제공자 추상화 레이어
'use strict';

const PROVIDERS = {
  claude: {
    label: 'Claude (Anthropic)',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-ant-...' },
      { key: 'model', label: 'Model', type: 'select',
        options: [
          { value: 'claude-sonnet-4-6',      label: 'Claude Sonnet 4.6' },
          { value: 'claude-opus-4-6',        label: 'Claude Opus 4.6'   },
          { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
        ]
      },
    ],
  },

  azure_openai: {
    label: 'Azure OpenAI',
    fields: [
      { key: 'apiKey',     label: 'API Key',         type: 'password', placeholder: 'Azure API Key' },
      { key: 'endpoint',   label: 'Endpoint',        type: 'text',     placeholder: 'https://your-resource.openai.azure.com' },
      { key: 'deployment', label: 'Deployment Name', type: 'text',     placeholder: 'gpt-4o' },
      { key: 'apiVersion', label: 'API Version',     type: 'text',     placeholder: '2024-02-01' },
    ],
  },

  openai: {
    label: 'OpenAI',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-...' },
      { key: 'model', label: 'Model', type: 'select',
        options: [
          { value: 'gpt-4o',      label: 'GPT-4o'      },
          { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
          { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
        ]
      },
    ],
  },

  ollama: {
    label: 'Ollama (Local)',
    fields: [
      { key: 'endpoint', label: 'Endpoint', type: 'text', placeholder: 'http://localhost:11434' },
      { key: 'model',    label: 'Model',    type: 'text', placeholder: 'llama3, mistral ...' },
    ],
  },

  github_copilot: {
    label: 'GitHub Copilot',
    hasOAuthFlow: true,
    fields: [],
  },
};

// ─── 제공자별 API 호출 ───────────────────────────────

async function callClaude(config, prompt) {
  if (!config.apiKey) throw new Error('Claude API key is missing');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.model || 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Claude API ${response.status}: ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return {
    text:  data.content?.[0]?.text || '',
    usage: { input: data.usage?.input_tokens || 0, output: data.usage?.output_tokens || 0 },
  };
}

async function callAzureOpenAI(config, prompt) {
  const { endpoint, deployment, apiKey, apiVersion = '2024-02-01' } = config;
  if (!endpoint || !deployment) throw new Error('Azure Endpoint and Deployment Name are required');

  const url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: 'You are a web browser test agent. Respond only in JSON format.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 500,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Azure OpenAI ${response.status}: ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return {
    text:  data.choices?.[0]?.message?.content || '',
    usage: { input: data.usage?.prompt_tokens || 0, output: data.usage?.completion_tokens || 0 },
  };
}

async function callOpenAI(config, prompt) {
  if (!config.apiKey) throw new Error('OpenAI API key is missing');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model || 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a web browser test agent. Respond only in JSON format.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 500,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`OpenAI ${response.status}: ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return {
    text:  data.choices?.[0]?.message?.content || '',
    usage: { input: data.usage?.prompt_tokens || 0, output: data.usage?.completion_tokens || 0 },
  };
}

// ─── GitHub Copilot 인증 모듈 ────────────────────────

const GH_COPILOT_HEADERS = {
  'Editor-Version': 'vscode/1.95.3',
  'Editor-Plugin-Version': 'copilot-chat/0.22.4',
  'Copilot-Integration-Id': 'vscode-chat',
  'User-Agent': 'GitHubCopilotChat/0.22.4',
};

// copilot_internal 엔드포인트 접근 가능한 공개 Client ID (GitHub CLI)
const GH_DEVICE_CLIENT_ID = '178c6fc778ccc68e1d6a';

const GithubCopilotAPI = {
  async startDeviceFlow() {
    const resp = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ client_id: GH_DEVICE_CLIENT_ID, scope: 'copilot' }),
    });
    if (!resp.ok) throw new Error(`Device flow 시작 실패: ${resp.status}`);
    return resp.json();
    // → { device_code, user_code, verification_uri, expires_in, interval }
  },

  async checkDeviceToken(deviceCode) {
    const resp = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        client_id: GH_DEVICE_CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });
    return resp.json();
    // → { access_token } 또는 { error: 'authorization_pending' | 'slow_down' | ... }
  },

  async getUsername(accessToken) {
    const resp = await fetch('https://api.github.com/user', {
      headers: { 'Authorization': `token ${accessToken}`, 'Accept': 'application/json' },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.login;
  },

  async getCopilotSessionToken(accessToken) {
    // Authorization: token 형식과 Bearer 형식 모두 시도
    const COMMON = {
      'Accept': 'application/json',
      'User-Agent': 'GitHubCopilotChat/0.22.4',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    for (const authVal of [`token ${accessToken}`, `Bearer ${accessToken}`]) {
      const resp = await fetch('https://api.github.com/copilot_internal/v2/token', {
        headers: { ...COMMON, 'Authorization': authVal },
      });
      if (resp.ok) {
        const data = await resp.json();
        return { token: data.token, expiresAt: new Date(data.expires_at).getTime() };
      }
      // 404/401 이외 오류(403 등)는 즉시 실패
      if (resp.status !== 404 && resp.status !== 401) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(`Copilot 토큰 ${resp.status}: ${err.message || resp.statusText}`);
      }
    }
    // 404 → Copilot 내부 API 접근 불가 (구독 없음 또는 OAuth 앱 제한)
    return null;
  },

  async fetchModels(sessionToken, accessToken) {
    const isChatModel = m => {
      if (!m.id && !m.name) return false;
      if (m.model_picker_enabled === false) return false;
      if (m.policy?.state === 'disabled') return false;
      const t = (m.task || m.type || m.capabilities?.type || '').toLowerCase();
      return !t.includes('embed');
    };
    const toOption = m => ({
      value: m.id || m.name,
      label: m.display_name || m.friendly_name || m.name || m.id,
    });
    // 라벨 기준 중복 제거
    const dedup = list => {
      const seen = new Set();
      return list.filter(m => {
        const key = m.label.toLowerCase().trim();
        const isNew = !seen.has(key);
        if (isNew) seen.add(key);
        return isNew;
      });
    };
    const tryFetch = async (url, headers) => {
      const resp = await fetch(url, { headers });
      if (!resp.ok) { console.warn('[fetchModels]', url, resp.status); return null; }
      const data = await resp.json();
      const raw = Array.isArray(data) ? data : (data.data || data.models || []);
      return dedup(raw.filter(isChatModel).map(toOption))
        .sort((a, b) => a.label.localeCompare(b.label));
    };

    // 1) Copilot session token으로 모델 조회
    if (sessionToken) {
      const list = await tryFetch('https://api.githubcopilot.com/models',
        { ...GH_COPILOT_HEADERS, 'Authorization': `Bearer ${sessionToken}`, 'Content-Type': 'application/json' });
      if (list?.length) return list;
    }

    // 2) OAuth 토큰으로 Copilot API 직접 시도 (세션 교환 없이)
    if (accessToken) {
      const list = await tryFetch('https://api.githubcopilot.com/models',
        { ...GH_COPILOT_HEADERS, 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' });
      if (list?.length) return list;
    }

    // 3) GitHub Models inference API 폴백
    if (accessToken) {
      const list = await tryFetch('https://models.inference.ai.azure.com/models',
        { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' });
      if (list?.length) return list;
    }

    // 4) 최종 폴백 목록
    return [
      { value: 'gpt-4o',       label: 'GPT-4o'       },
      { value: 'gpt-4o-mini',  label: 'GPT-4o mini'  },
      { value: 'o3-mini',      label: 'o3-mini'       },
    ];
  },

  async ensureSessionToken(auth) {
    if (auth.sessionToken && Date.now() < auth.sessionExpiry - 120_000) {
      return auth.sessionToken;
    }
    const result = await this.getCopilotSessionToken(auth.accessToken);
    if (!result) return null; // GitHub Models API 폴백 사용
    auth.sessionToken = result.token;
    auth.sessionExpiry = result.expiresAt;
    await chrome.storage.local.set({ githubCopilotAuth: auth });
    return result.token;
  },
};

async function callGitHubCopilot(config, prompt) {
  const { githubCopilotAuth: auth } = await chrome.storage.local.get('githubCopilotAuth');
  if (!auth?.accessToken) throw new Error('GitHub Copilot: 로그인이 필요합니다. 설정에서 로그인해주세요.');

  const sessionToken = await GithubCopilotAPI.ensureSessionToken(auth);

  const reqBody = JSON.stringify({
    model: config.model || 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are a web browser test agent. Respond only in JSON format.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 500,
    temperature: 0.1,
    response_format: { type: 'json_object' },
  });

  const oaiResult = data => ({
    text:  data.choices?.[0]?.message?.content || '',
    usage: { input: data.usage?.prompt_tokens || 0, output: data.usage?.completion_tokens || 0 },
  });

  // 1) Copilot 세션 토큰으로 시도
  if (sessionToken) {
    const r = await fetch('https://api.githubcopilot.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}`, ...GH_COPILOT_HEADERS },
      body: reqBody,
    });
    if (r.ok) return oaiResult(await r.json());
    const err = await r.json().catch(() => ({}));
    throw new Error(`GitHub Copilot ${r.status}: ${err.error?.message || r.statusText}`);
  }

  // 2) OAuth 토큰으로 Copilot API 직접 시도
  {
    const r = await fetch('https://api.githubcopilot.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.accessToken}`, ...GH_COPILOT_HEADERS },
      body: reqBody,
    });
    if (r.ok) return oaiResult(await r.json());
    // 인증 오류만 폴백; 그 외 오류는 즉시 throw
    if (r.status !== 401 && r.status !== 403) {
      const err = await r.json().catch(() => ({}));
      throw new Error(`GitHub Copilot ${r.status}: ${err.error?.message || r.statusText}`);
    }
  }

  // 3) GitHub Models API 폴백
  const r = await fetch('https://models.inference.ai.azure.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.accessToken}` },
    body: reqBody,
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(`GitHub Models ${r.status}: ${err.error?.message || r.statusText}`);
  }
  return oaiResult(await r.json());
}

async function callOllama(config, prompt) {
  const endpoint = (config.endpoint || 'http://localhost:11434').replace(/\/$/, '');

  const response = await fetch(`${endpoint}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model || 'llama3',
      messages: [
        { role: 'system', content: 'You are a web browser test agent. You must respond only in JSON format.' },
        { role: 'user', content: prompt },
      ],
      stream: false,
      format: 'json',
    }),
  });

  if (!response.ok) throw new Error(`Ollama ${response.status}: connection failed (${endpoint})`);

  const data = await response.json();
  return {
    text:  data.message?.content || '',
    usage: { input: data.prompt_eval_count || 0, output: data.eval_count || 0 },
  };
}

// ─── 통합 호출 ───────────────────────────────────────

async function callAI(provider, config, prompt) {
  let raw;

  switch (provider) {
    case 'claude':          raw = await callClaude(config, prompt);         break;
    case 'azure_openai':    raw = await callAzureOpenAI(config, prompt);    break;
    case 'openai':          raw = await callOpenAI(config, prompt);         break;
    case 'ollama':          raw = await callOllama(config, prompt);         break;
    case 'github_copilot':  raw = await callGitHubCopilot(config, prompt);  break;
    default: throw new Error(`Unknown provider: ${provider}`);
  }

  // JSON 파싱 (마크다운 펜스 제거 후 시도)
  const cleaned = raw.text.replaceAll(/```json\n?|\n?```/g, '').trim();
  try {
    return { result: JSON.parse(cleaned), usage: raw.usage };
  } catch {
    // JSON 블록만 추출해서 재시도
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return { result: JSON.parse(match[0]), usage: raw.usage }; } catch {}
    }
    throw new Error(`JSON parse failed (${provider}): ${cleaned.slice(0, 150)}`);
  }
}

globalThis.AIProviders = { PROVIDERS, callAI, GithubCopilotAPI };
