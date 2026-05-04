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
  return data.content?.[0]?.text || '';
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
  return data.choices?.[0]?.message?.content || '';
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
  return data.choices?.[0]?.message?.content || '';
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
  return data.message?.content || '';
}

// ─── 통합 호출 ───────────────────────────────────────

async function callAI(provider, config, prompt) {
  let rawText = '';

  switch (provider) {
    case 'claude':       rawText = await callClaude(config, prompt);      break;
    case 'azure_openai': rawText = await callAzureOpenAI(config, prompt); break;
    case 'openai':       rawText = await callOpenAI(config, prompt);      break;
    case 'ollama':       rawText = await callOllama(config, prompt);      break;
    default: throw new Error(`Unknown provider: ${provider}`);
  }

  // JSON 파싱 (마크다운 펜스 제거 후 시도)
  const cleaned = rawText.replace(/```json\n?|\n?```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // JSON 블록만 추출해서 재시도
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    throw new Error(`JSON parse failed (${provider}): ${cleaned.slice(0, 150)}`);
  }
}

window.AIProviders = { PROVIDERS, callAI };
