import axios from 'axios';
import { GoogleGenAI } from '@google/genai';
import { db } from '../database/database';
import { Response } from 'express';

// Built-in verified OpenRouter and popular AI models
export const POPULAR_MODELS = [
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini (OpenAI)',
    provider: 'OpenAI',
    description: 'Fast, highly intelligent model for lightweight tasks and everyday conversations.',
    context_length: 128000,
    pricing: { prompt: '$0.00000015', completion: '$0.0000006' },
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o (OpenAI)',
    provider: 'OpenAI',
    description: 'Flagship versatile multimodal model by OpenAI.',
    context_length: 128000,
    pricing: { prompt: '$0.0000025', completion: '$0.00001' },
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet (Anthropic)',
    provider: 'Anthropic',
    description: 'Superior reasoning, coding, and creative writing abilities.',
    context_length: 200000,
    pricing: { prompt: '$0.000003', completion: '$0.000015' },
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek V3 (DeepSeek)',
    provider: 'DeepSeek',
    description: 'Powerful, economical open-weights frontier model.',
    context_length: 64000,
    pricing: { prompt: '$0.00000014', completion: '$0.00000028' },
  },
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1 Reasoning (DeepSeek)',
    provider: 'DeepSeek',
    description: 'Advanced reasoning model with chain-of-thought logic.',
    context_length: 64000,
    pricing: { prompt: '$0.00000055', completion: '$0.00000219' },
  },
  {
    id: 'google/gemini-2.0-flash-001',
    name: 'Gemini 2.0 Flash (Google)',
    provider: 'Google',
    description: 'Ultra fast response times with multimodal inputs and web agility.',
    context_length: 1000000,
    pricing: { prompt: '$0.0000001', completion: '$0.0000004' },
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B Instruct (Meta)',
    provider: 'Meta',
    description: 'Open-weight powerhouse with industry-leading performance.',
    context_length: 128000,
    pricing: { prompt: '$0.00000012', completion: '$0.0000003' },
  },
  {
    id: 'mistralai/mistral-large-2411',
    name: 'Mistral Large (Mistral AI)',
    provider: 'Mistral AI',
    description: 'Top-tier reasoning, multilingual capabilities, and coding.',
    context_length: 128000,
    pricing: { prompt: '$0.000002', completion: '$0.000006' },
  },
  {
    id: 'mayzaa-chatgpt',
    name: 'Mayzaa ChatGPT Endpoint',
    provider: 'Mayzaa AI',
    description: 'Direct AI chat endpoint hosted by Mayzaa API (https://api.mayzaa.my.id).',
    context_length: 16000,
    pricing: { prompt: 'Free', completion: 'Free' },
  },
  {
    id: 'xkiro-default',
    name: 'Xkiro AI Gateway',
    provider: 'Xkiro.com',
    description: 'High-speed OpenAI-compatible AI endpoints by Xkiro (https://api.xkiro.com).',
    context_length: 128000,
    pricing: { prompt: 'Variable', completion: 'Variable' },
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Google Gemini 3.7 Flash',
    provider: 'Google AI Studio',
    description: 'Next-generation hybrid reasoning model with high speed and precision.',
    context_length: 1000000,
    pricing: { prompt: 'Included', completion: 'Included' },
  },
];

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

// Recursively and thoroughly extract clean text from any API response structure
export function extractCleanText(input: any): string {
  if (input === null || input === undefined) return '';

  if (typeof input === 'string') {
    const trimmed = input.trim();
    // Check if string is wrapped JSON
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        const extracted = extractCleanText(parsed);
        if (extracted && extracted !== trimmed) return extracted;
      } catch {
        // Not valid JSON, continue
      }
    }
    return trimmed;
  }

  if (typeof input === 'number' || typeof input === 'boolean') {
    return String(input);
  }

  if (Array.isArray(input)) {
    if (input.length === 0) return '';
    for (const item of input) {
      const text = extractCleanText(item);
      if (text) return text;
    }
    return input.map(extractCleanText).filter(Boolean).join('\n');
  }

  if (typeof input === 'object') {
    // 1. Direct standard AI response keys
    const directKeys = [
      'result',
      'response',
      'message',
      'text',
      'answer',
      'reply',
      'content',
      'output',
      'msg',
      'bot',
      'ai',
      'res',
    ];

    for (const key of directKeys) {
      if (input[key] !== undefined && input[key] !== null) {
        const val = extractCleanText(input[key]);
        if (val && typeof val === 'string' && val.trim().length > 0) {
          return val.trim();
        }
      }
    }

    // 2. OpenAI / OpenRouter choices structure
    if (Array.isArray(input.choices) && input.choices.length > 0) {
      const firstChoice = input.choices[0];
      if (firstChoice.message && firstChoice.message.content) {
        return extractCleanText(firstChoice.message.content);
      }
      if (firstChoice.text) {
        return extractCleanText(firstChoice.text);
      }
      if (firstChoice.delta && firstChoice.delta.content) {
        return extractCleanText(firstChoice.delta.content);
      }
    }

    // 3. Nested `data` object
    if (input.data !== undefined && input.data !== null) {
      const extractedData = extractCleanText(input.data);
      if (extractedData) return extractedData;
    }

    // 4. Look for the longest string value among keys (skipping metadata keys)
    const ignoredKeys = new Set(['status', 'creator', 'code', 'url', 'timestamp', 'model', 'provider', 'id', 'object', 'created', 'success']);
    let bestText = '';
    for (const [k, v] of Object.entries(input)) {
      if (ignoredKeys.has(k.toLowerCase())) continue;
      const candidate = extractCleanText(v);
      if (candidate.length > bestText.length) {
        bestText = candidate;
      }
    }
    if (bestText) return bestText;

    return '';
  }

  return String(input);
}

// Call Mayzaa API ChatGPT endpoint
export async function callMayzaaApi(messages: Array<{ role: string; content: string }>, systemPrompt?: string): Promise<string> {
  const config = db.getConfig();
  const endpointUrl = config.customApiUrl || 'https://api.mayzaa.my.id/api/ai/chat-gpt?text=';

  // Extract last user message or prompt text
  const lastUserMessage = messages.filter((m) => m.role === 'user').pop()?.content || messages[messages.length - 1]?.content || '';
  const promptText = lastUserMessage.trim();

  if (!promptText) {
    return 'Silakan ketik pertanyaan atau pesan Anda.';
  }

  try {
    const targetUrl = endpointUrl.includes('?text=')
      ? `${endpointUrl}${encodeURIComponent(promptText)}`
      : `${endpointUrl}?text=${encodeURIComponent(promptText)}`;

    const response = await axios.get(targetUrl, {
      timeout: 30000,
      headers: {
        'User-Agent': 'LYNXIEE-MARKET-AI/1.0',
        Accept: 'application/json, text/plain, */*',
      },
    });

    const cleanText = extractCleanText(response.data);
    if (cleanText && cleanText.trim().length > 0) {
      return cleanText.trim();
    }

    return typeof response.data === 'string' ? response.data : 'Tidak ada respon teks yang diterima.';
  } catch (err: any) {
    console.error('Mayzaa API request error:', err?.message || err);
    throw new Error(err?.response?.data?.message || err?.message || 'Failed to fetch response from Mayzaa AI endpoint (https://api.mayzaa.my.id/api/ai/chat-gpt).');
  }
}

// Call OpenRouter API (Streaming or Non-streaming)
async function callOpenRouterApi(
  messages: Array<{ role: string; content: string }>,
  res: Response | null,
  stream: boolean
): Promise<string> {
  const config = db.getConfig();
  const apiKey = config.openRouterApiKey;
  if (!apiKey) {
    throw new Error('OpenRouter API Key is not configured. Please add your key in the /openr Admin Panel.');
  }

  const model = config.activeModel || 'openai/gpt-4o-mini';
  const systemPrompt = config.systemPrompt;
  const { temperature, maxTokens, topP } = config.aiSettings;

  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
      content: m.content,
    })),
  ];

  if (stream && res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model,
          messages: formattedMessages,
          temperature,
          max_tokens: maxTokens,
          top_p: topP,
          stream: true,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://lynxiee.market',
            'X-Title': 'LYNXIEE MARKET AI',
            'Content-Type': 'application/json',
          },
          responseType: 'stream',
          timeout: 60000,
        }
      );

      let fullText = '';
      response.data.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.replace(/^data:\s*/, '');
            if (dataStr === '[DONE]') {
              res.write('data: [DONE]\n\n');
              continue;
            }
            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta?.content || '';
              if (delta) {
                fullText += delta;
                res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
              }
            } catch {
              // Non-JSON line or partial chunk
            }
          }
        }
      });

      return new Promise((resolve, reject) => {
        response.data.on('end', () => {
          res.end();
          resolve(fullText);
        });
        response.data.on('error', (err: any) => {
          res.write(`data: ${JSON.stringify({ error: err.message || 'Streaming error' })}\n\n`);
          res.end();
          reject(err);
        });
      });
    } catch (error: any) {
      const errorMsg = error?.response?.data?.error?.message || error?.message || 'OpenRouter API request failed.';
      res.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`);
      res.end();
      throw new Error(errorMsg);
    }
  } else {
    // Non-streaming
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model,
        messages: formattedMessages,
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        stream: false,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://lynxiee.market',
          'X-Title': 'LYNXIEE MARKET AI',
          'Content-Type': 'application/json',
        },
        timeout: 45000,
      }
    );

    const reply = response.data?.choices?.[0]?.message?.content;
    if (!reply) {
      throw new Error('Received empty response from OpenRouter.');
    }
    return reply;
  }
}

// Call Google Gemini API (fallback or selected provider)
async function callGeminiApi(
  messages: Array<{ role: string; content: string }>,
  res: Response | null,
  stream: boolean
): Promise<string> {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error('Gemini API key is not available in environment.');
  }

  const config = db.getConfig();
  const systemPrompt = config.systemPrompt;

  const lastUserMessage = messages.filter((m) => m.role === 'user').pop()?.content || '';
  const contents = messages.slice(-10).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  if (stream && res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const chat = ai.chats.create({
        model: 'gemini-3.7-flash',
        config: {
          systemInstruction: systemPrompt,
          temperature: config.aiSettings.temperature,
          topP: config.aiSettings.topP,
        },
      });

      const responseStream = await chat.sendMessageStream({ message: lastUserMessage });
      let fullText = '';

      for await (const chunk of responseStream) {
        const text = (chunk as any).text || '';
        if (text) {
          fullText += text;
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }

      res.write('data: [DONE]\n\n');
      res.end();
      return fullText;
    } catch (err: any) {
      const errorMsg = err?.message || 'Gemini API streaming failure.';
      res.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`);
      res.end();
      throw err;
    }
  } else {
    const chat = ai.chats.create({
      model: 'gemini-3.7-flash',
      config: {
        systemInstruction: systemPrompt,
        temperature: config.aiSettings.temperature,
        topP: config.aiSettings.topP,
      },
    });

    const response = await chat.sendMessage({ message: lastUserMessage });
    const text = response.text || '';
    return text;
  }
}

// Call Xkiro.com API (Streaming or Non-streaming)
export async function callXkiroApi(
  messages: Array<{ role: string; content: string }>,
  res: Response | null,
  stream: boolean
): Promise<string> {
  const config = db.getConfig();
  const apiKey = config.xkiroApiKey;
  const baseUrl = config.xkiroBaseUrl || 'https://api.xkiro.com/v1';
  const targetUrl = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const model = config.xkiroModel || config.activeModel || 'openai/gpt-4o-mini';
  const systemPrompt = config.systemPrompt;
  const { temperature, maxTokens, topP } = config.aiSettings;

  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
      content: m.content,
    })),
  ];

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'LYNXIEE-MARKET-AI/1.0',
    'X-Title': 'LYNXIEE MARKET AI',
  };

  if (apiKey && apiKey.trim().length > 0) {
    headers['Authorization'] = `Bearer ${apiKey.trim()}`;
  }

  if (stream && res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const response = await axios.post(
        targetUrl,
        {
          model,
          messages: formattedMessages,
          temperature,
          max_tokens: maxTokens,
          top_p: topP,
          stream: true,
        },
        {
          headers,
          responseType: 'stream',
          timeout: 60000,
        }
      );

      let fullText = '';
      response.data.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.replace(/^data:\s*/, '');
            if (dataStr === '[DONE]') {
              res.write('data: [DONE]\n\n');
              continue;
            }
            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta?.content || '';
              if (delta) {
                fullText += delta;
                res.write(`data: ${JSON.stringify({ text: delta, provider: 'xkiro', model })}\n\n`);
              }
            } catch {
              // Raw delta string fallback
              if (dataStr && !dataStr.startsWith('{')) {
                fullText += dataStr;
                res.write(`data: ${JSON.stringify({ text: dataStr, provider: 'xkiro', model })}\n\n`);
              }
            }
          }
        }
      });

      return new Promise((resolve, reject) => {
        response.data.on('end', () => {
          res.end();
          resolve(fullText);
        });
        response.data.on('error', (err: any) => {
          res.write(`data: ${JSON.stringify({ error: err.message || 'Xkiro streaming error' })}\n\n`);
          res.end();
          reject(err);
        });
      });
    } catch (error: any) {
      const errorMsg = error?.response?.data?.error?.message || error?.message || 'Xkiro.com API request failed.';
      res.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`);
      res.end();
      throw new Error(errorMsg);
    }
  } else {
    // Non-streaming
    const response = await axios.post(
      targetUrl,
      {
        model,
        messages: formattedMessages,
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        stream: false,
      },
      {
        headers,
        timeout: 45000,
      }
    );

    const cleanText = extractCleanText(response.data);
    if (!cleanText) {
      throw new Error('Received empty response from Xkiro.com.');
    }
    return cleanText;
  }
}

// Master Dispatcher for Chat Requests
export async function executeChat(
  messages: Array<{ role: string; content: string }>,
  res: Response,
  stream: boolean = false
): Promise<void> {
  const startTime = Date.now();
  const config = db.getConfig();
  let provider = config.activeProvider;
  let model = config.activeModel;
  const promptSnippet = messages[messages.length - 1]?.content || '';

  // Auto-fallback validation
  if (provider === 'openrouter' && !config.openRouterApiKey) {
    provider = 'mayzaa';
  } else if (provider === 'xkiro' && !config.xkiroApiKey && !config.xkiroBaseUrl) {
    provider = 'mayzaa';
  }

  let finalResponse = '';
  let status = 200;
  let errorMsg = '';

  try {
    if (provider === 'openrouter' && config.openRouterApiKey) {
      model = config.activeModel || 'openai/gpt-4o-mini';
      finalResponse = await callOpenRouterApi(messages, stream ? res : null, stream);
    } else if (provider === 'xkiro') {
      model = config.xkiroModel || config.activeModel || 'openai/gpt-4o-mini';
      finalResponse = await callXkiroApi(messages, stream ? res : null, stream);
    } else if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
      model = 'gemini-3.7-flash';
      finalResponse = await callGeminiApi(messages, stream ? res : null, stream);
    } else {
      // Default / Mayzaa API (Free direct ChatGPT endpoint)
      provider = 'mayzaa';
      model = 'mayzaa-chatgpt';
      finalResponse = await callMayzaaApi(messages, config.systemPrompt);

      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Fast chunked streaming for Mayzaa response
        const words = finalResponse.split(' ');
        for (let i = 0; i < words.length; i++) {
          const chunk = (i === 0 ? '' : ' ') + words[i];
          res.write(`data: ${JSON.stringify({ text: chunk, provider: 'mayzaa', model })}\n\n`);
          if (i % 3 === 0) {
            await new Promise((r) => setTimeout(r, 20));
          }
        }
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        res.json({
          response: finalResponse,
          provider: 'mayzaa',
          model: 'mayzaa-chatgpt',
          timestamp: Date.now(),
        });
      }
    }
  } catch (err: any) {
    status = 500;
    errorMsg = err?.message || 'AI service error';

    // Fallback: If primary failed and Gemini API key is available, try Gemini
    if (provider !== 'gemini' && process.env.GEMINI_API_KEY && !res.headersSent) {
      try {
        console.log(`Primary provider (${provider}) failed, falling back to Gemini...`);
        finalResponse = await callGeminiApi(messages, stream ? res : null, stream);
        status = 200;
        provider = 'gemini';
        model = 'gemini-3.7-flash';
        errorMsg = '';
      } catch (fallbackErr: any) {
        errorMsg = `Primary (${provider}) and Fallback failed: ${fallbackErr?.message || errorMsg}`;
      }
    }

    if (status !== 200 && !res.headersSent) {
      res.status(500).json({
        error: errorMsg || 'Unable to connect to AI provider. Please check configuration at /openr.',
        provider,
        model,
      });
    }
  } finally {
    const latencyMs = Date.now() - startTime;
    db.logRequest({
      provider,
      model,
      promptSnippet,
      status,
      latencyMs,
      error: errorMsg || undefined,
    });
  }
}

// Fetch dynamic models list from OpenRouter API if API key is provided
export async function fetchOpenRouterModels(apiKey?: string): Promise<any[]> {
  const currentKey = apiKey || db.getConfig().openRouterApiKey;
  if (!currentKey) {
    return POPULAR_MODELS;
  }

  try {
    const response = await axios.get('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${currentKey}`,
        'HTTP-Referer': 'https://lynxiee.market',
        'X-Title': 'LYNXIEE MARKET AI',
      },
      timeout: 15000,
    });

    const data = response.data?.data;
    if (Array.isArray(data) && data.length > 0) {
      const mapped = data.map((m: any) => {
        let providerName = 'OpenRouter';
        if (m.id.includes('/')) {
          providerName = m.id.split('/')[0].toUpperCase();
        }
        return {
          id: m.id,
          name: m.name || m.id,
          description: m.description || '',
          context_length: m.context_length || 32000,
          pricing: m.pricing || { prompt: 0, completion: 0 },
          provider: providerName,
          architecture: m.architecture,
        };
      });

      // Also ensure Mayzaa and Gemini are included in list
      return [
        {
          id: 'mayzaa-chatgpt',
          name: 'Mayzaa ChatGPT (Free Endpoint)',
          provider: 'Mayzaa AI',
          description: 'Direct AI chat endpoint (https://api.mayzaa.my.id).',
          context_length: 16000,
          pricing: { prompt: 'Free', completion: 'Free' },
        },
        ...mapped,
      ];
    }
  } catch (err: any) {
    console.error('Failed to fetch dynamic models from OpenRouter:', err?.message || err);
  }

  return POPULAR_MODELS;
}

// Test OpenRouter API Key connection
export async function testOpenRouterConnection(apiKey: string): Promise<{ success: boolean; message: string; keyInfo?: any }> {
  if (!apiKey || apiKey.trim().length < 8) {
    return { success: false, message: 'Invalid API Key format. OpenRouter keys start with sk-or-v1-...' };
  }

  try {
    const response = await axios.get('https://openrouter.ai/api/v1/auth/key', {
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      timeout: 12000,
    });

    const data = response.data?.data;
    return {
      success: true,
      message: 'Connection successful! OpenRouter API key is active and verified.',
      keyInfo: {
        label: data?.label || 'Active Key',
        limit: data?.limit || 'Unlimited / Standard',
        usage: data?.usage || 0,
        is_free_tier: data?.is_free_tier || false,
      },
    };
  } catch (error: any) {
    // If /auth/key isn't supported, test with /models
    try {
      const modelRes = await axios.get('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${apiKey.trim()}` },
        timeout: 10000,
      });
      if (modelRes.data?.data) {
        return {
          success: true,
          message: 'Connection successful! OpenRouter authenticated successfully.',
        };
      }
    } catch (e: any) {
      // Fall through to error
    }

    const errDetails = error?.response?.data?.error?.message || error?.message || 'Unable to authenticate with OpenRouter.';
    return {
      success: false,
      message: `OpenRouter authentication failed: ${errDetails}`,
    };
  }
}

// Direct non-streaming OpenRouter execution for GET /api/openr and testing
export async function callOpenRouterDirect(
  prompt: string,
  modelId?: string,
  systemPrompt?: string
): Promise<{ text: string; model: string; latencyMs: number }> {
  const startTime = Date.now();
  const config = db.getConfig();
  const apiKey = config.openRouterApiKey;
  if (!apiKey) {
    throw new Error('OpenRouter API Key belum dikonfigurasi. Silakan simpan API Key Anda di /openr.');
  }

  const model = modelId?.trim() || config.activeModel || 'openai/gpt-4o-mini';
  const finalSystemPrompt = systemPrompt || config.systemPrompt;
  const { temperature, maxTokens, topP } = config.aiSettings;

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model,
        messages: [
          { role: 'system', content: finalSystemPrompt },
          { role: 'user', content: prompt.trim() },
        ],
        temperature: typeof temperature === 'number' ? temperature : 0.7,
        max_tokens: typeof maxTokens === 'number' ? maxTokens : 2048,
        top_p: typeof topP === 'number' ? topP : 0.9,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://lynxiee.market',
          'X-Title': 'LYNXIEE MARKET AI',
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    const cleanText = extractCleanText(response.data);
    const latencyMs = Date.now() - startTime;

    db.logRequest({
      provider: 'openrouter',
      model,
      promptSnippet: prompt,
      status: 200,
      latencyMs,
    });

    return {
      text: cleanText || 'Respon kosong dari OpenRouter.',
      model,
      latencyMs,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const errorMsg = err?.response?.data?.error?.message || err?.message || 'Gagal terhubung ke OpenRouter API.';
    db.logRequest({
      provider: 'openrouter',
      model,
      promptSnippet: prompt,
      status: 500,
      latencyMs,
      error: errorMsg,
    });
    throw new Error(errorMsg);
  }
}

// Direct non-streaming Xkiro.com execution for GET /api/xkiro and testing
export async function callXkiroDirect(
  prompt: string,
  modelId?: string,
  systemPrompt?: string
): Promise<{ text: string; model: string; latencyMs: number }> {
  const startTime = Date.now();
  const config = db.getConfig();
  const apiKey = config.xkiroApiKey;
  const baseUrl = config.xkiroBaseUrl || 'https://api.xkiro.com/v1';
  const targetUrl = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const model = modelId?.trim() || config.xkiroModel || config.activeModel || 'openai/gpt-4o-mini';
  const finalSystemPrompt = systemPrompt || config.systemPrompt;
  const { temperature, maxTokens, topP } = config.aiSettings;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'LYNXIEE-MARKET-AI/1.0',
    'X-Title': 'LYNXIEE MARKET AI',
  };

  if (apiKey && apiKey.trim().length > 0) {
    headers['Authorization'] = `Bearer ${apiKey.trim()}`;
  }

  try {
    const response = await axios.post(
      targetUrl,
      {
        model,
        messages: [
          { role: 'system', content: finalSystemPrompt },
          { role: 'user', content: prompt.trim() },
        ],
        temperature: typeof temperature === 'number' ? temperature : 0.7,
        max_tokens: typeof maxTokens === 'number' ? maxTokens : 2048,
        top_p: typeof topP === 'number' ? topP : 0.9,
      },
      {
        headers,
        timeout: 45000,
      }
    );

    const cleanText = extractCleanText(response.data);
    const latencyMs = Date.now() - startTime;

    db.logRequest({
      provider: 'xkiro',
      model,
      promptSnippet: prompt,
      status: 200,
      latencyMs,
    });

    return {
      text: cleanText || 'Respon kosong dari Xkiro.com.',
      model,
      latencyMs,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const errorMsg = err?.response?.data?.error?.message || err?.message || 'Gagal terhubung ke Xkiro.com API.';
    db.logRequest({
      provider: 'xkiro',
      model,
      promptSnippet: prompt,
      status: 500,
      latencyMs,
      error: errorMsg,
    });
    throw new Error(errorMsg);
  }
}

// Test Xkiro.com API connection
export async function testXkiroConnection(
  apiKey?: string,
  baseUrl?: string
): Promise<{ success: boolean; message: string; data?: any }> {
  const config = db.getConfig();
  const keyToUse = apiKey !== undefined ? apiKey.trim() : config.xkiroApiKey;
  const urlToUse = baseUrl || config.xkiroBaseUrl || 'https://api.xkiro.com/v1';
  const targetUrl = urlToUse.endsWith('/chat/completions') ? urlToUse : `${urlToUse.replace(/\/$/, '')}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'LYNXIEE-MARKET-AI/1.0',
  };
  if (keyToUse) {
    headers['Authorization'] = `Bearer ${keyToUse}`;
  }

  try {
    const response = await axios.post(
      targetUrl,
      {
        model: config.xkiroModel || 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: 'Ping test. Reply with: OK' }],
        max_tokens: 10,
      },
      {
        headers,
        timeout: 12000,
      }
    );

    const clean = extractCleanText(response.data);
    return {
      success: true,
      message: `Koneksi ke Xkiro.com (${urlToUse}) berhasil diverifikasi! Respon: ${clean.slice(0, 50)}`,
      data: response.data,
    };
  } catch (error: any) {
    const errDetails = error?.response?.data?.error?.message || error?.message || 'Unable to connect to Xkiro.com.';
    return {
      success: false,
      message: `Xkiro.com connection test failed: ${errDetails}`,
    };
  }
}

// Test Mayzaa API connection
export async function testMayzaaConnection(apiUrl?: string): Promise<{ success: boolean; message: string; responseSnippet?: string }> {
  const config = db.getConfig();
  const endpoint = apiUrl || config.mayzaaApiUrl || 'https://api.mayzaa.my.id/api/ai/chat-gpt?text=';
  const target = endpoint.includes('?text=') ? `${endpoint}Halo` : `${endpoint}?text=Halo`;

  try {
    const res = await axios.get(target, { timeout: 12000 });
    const clean = extractCleanText(res.data);
    return {
      success: true,
      message: 'Koneksi ke Mayzaa API ChatGPT berhasil aktif dan merespon normal.',
      responseSnippet: clean.slice(0, 100),
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal terhubung ke Mayzaa API: ${err?.message || 'Timeout/Error'}`,
    };
  }
}
