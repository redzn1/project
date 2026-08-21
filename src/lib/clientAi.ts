/**
 * Client-Side AI Response Engine & Stream Handler
 * Delivers direct live streaming output from real models (Backend / Mayzaa / OpenRouter)
 * Completely eliminates any mock boilerplate or hardcoded responses.
 */

export interface ChatPayloadMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ClientAiResponse {
  text: string;
  provider: string;
  model: string;
  latencyMs: number;
}

// Mayzaa AI direct endpoint for browser execution
const MAYZAA_ENDPOINT = 'https://api.mayzaa.my.id/api/ai/chat-gpt';

/**
 * Stream or Fetch live response from backend server /api/chat
 */
export async function streamBackendChat(
  messages: ChatPayloadMessage[],
  options?: {
    onChunk?: (text: string) => void;
    model?: string;
  }
): Promise<ClientAiResponse> {
  const startTime = Date.now();
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream, application/json',
    },
    body: JSON.stringify({
      messages,
      stream: true,
      model: options?.model,
    }),
  });

  if (!response.ok) {
    let errorMsg = `Server error HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson.error) errorMsg = errJson.error;
    } catch {}
    throw new Error(errorMsg);
  }

  // Check if content-type is SSE stream
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/event-stream') && response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let accumulatedText = '';
    let usedProvider = 'backend-ai';
    let usedModel = options?.model || 'LYNXIEE AI';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const rawData = line.slice(6).trim();
          if (rawData === '[DONE]') {
            continue;
          }
          try {
            const parsed = JSON.parse(rawData);
            if (parsed.text) {
              accumulatedText += parsed.text;
              if (options?.onChunk) {
                options.onChunk(accumulatedText);
              }
            }
            if (parsed.provider) usedProvider = parsed.provider;
            if (parsed.model) usedModel = parsed.model;
          } catch {
            // Raw text delta
            if (rawData) {
              accumulatedText += rawData;
              if (options?.onChunk) {
                options.onChunk(accumulatedText);
              }
            }
          }
        }
      }
    }

    if (accumulatedText.trim()) {
      return {
        text: accumulatedText.trim(),
        provider: usedProvider,
        model: usedModel,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  // Non-streaming JSON response fallback
  const data = await response.json();
  const text = data.text || data.result || data.response || data.message || '';
  if (!text) {
    throw new Error('No content returned from AI service.');
  }

  if (options?.onChunk) {
    options.onChunk(text);
  }

  return {
    text,
    provider: data.provider || 'backend-ai',
    model: data.model || 'LYNXIEE AI',
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Call public Mayzaa ChatGPT API directly
 */
export async function callMayzaaClientDirect(
  prompt: string,
  onChunk?: (text: string) => void
): Promise<string> {
  const url = `${MAYZAA_ENDPOINT}?text=${encodeURIComponent(prompt)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json, text/plain, */*',
    },
  });

  if (!response.ok) {
    throw new Error(`Mayzaa API returned HTTP ${response.status}`);
  }

  const raw = await response.text();
  if (!raw || !raw.trim()) {
    throw new Error('Empty response received from Mayzaa API.');
  }

  let finalOutput = raw.trim();
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.result === 'string') finalOutput = parsed.result;
    else if (typeof parsed.response === 'string') finalOutput = parsed.response;
    else if (typeof parsed.message === 'string') finalOutput = parsed.message;
    else if (parsed.data && typeof parsed.data.result === 'string') finalOutput = parsed.data.result;
  } catch {
    // raw plain text
  }

  if (onChunk) {
    onChunk(finalOutput);
  }

  return finalOutput;
}

/**
 * Direct OpenRouter API call from client with streaming
 */
export async function callOpenRouterClientDirect(
  messages: ChatPayloadMessage[],
  apiKey: string,
  model: string = 'openai/gpt-4o-mini',
  onChunk?: (text: string) => void
): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://lynxiee.ai',
      'X-Title': 'LYNXIEE MARKET AI',
    },
    body: JSON.stringify({
      model: model || 'openai/gpt-4o-mini',
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter error: ${errText}`);
  }

  if (response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;
          try {
            const data = JSON.parse(raw);
            const delta = data.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullText += delta;
              if (onChunk) onChunk(fullText);
            }
          } catch {}
        }
      }
    }

    if (fullText.trim()) return fullText.trim();
  }

  // Fallback json if stream not consumed
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  if (onChunk && text) onChunk(text);
  return text;
}

/**
 * Direct Xkiro.com API call from client with streaming
 */
export async function callXkiroClientDirect(
  messages: ChatPayloadMessage[],
  apiKey?: string,
  baseUrl: string = 'https://api.xkiro.com/v1',
  model: string = 'openai/gpt-4o-mini',
  onChunk?: (text: string) => void
): Promise<string> {
  const targetUrl = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Title': 'LYNXIEE MARKET AI',
  };
  if (apiKey && apiKey.trim().length > 0) {
    headers['Authorization'] = `Bearer ${apiKey.trim()}`;
  }

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model || 'openai/gpt-4o-mini',
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Xkiro.com error: ${errText}`);
  }

  if (response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;
          try {
            const data = JSON.parse(raw);
            const delta = data.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullText += delta;
              if (onChunk) onChunk(fullText);
            }
          } catch {
            if (raw && !raw.startsWith('{')) {
              fullText += raw;
              if (onChunk) onChunk(fullText);
            }
          }
        }
      }
    }

    if (fullText.trim()) return fullText.trim();
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || data.result || data.response || '';
  if (onChunk && text) onChunk(text);
  return text;
}

/**
 * Universal Stream & Live Chat Pipeline
 */
export async function executeClientChatFallback(
  messages: ChatPayloadMessage[],
  options?: {
    model?: string;
    apiKey?: string;
    xkiroKey?: string;
    xkiroBaseUrl?: string;
    provider?: 'openrouter' | 'mayzaa' | 'xkiro' | 'gemini';
    onChunk?: (accumulated: string) => void;
  }
): Promise<ClientAiResponse> {
  const startTime = Date.now();
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  const prompt = lastUserMsg?.content || '';

  // 1. Try Backend Streaming first
  try {
    return await streamBackendChat(messages, {
      onChunk: options?.onChunk,
      model: options?.model,
    });
  } catch (backendErr: any) {
    console.warn('[ResponseEngine] Backend API stream failed or not connected, attempting direct integration...', backendErr?.message);
  }

  // 2. Direct Xkiro if requested or configured
  if (options?.provider === 'xkiro' || options?.xkiroKey) {
    try {
      const text = await callXkiroClientDirect(
        messages,
        options.xkiroKey,
        options.xkiroBaseUrl || 'https://api.xkiro.com/v1',
        options.model || 'openai/gpt-4o-mini',
        options?.onChunk
      );
      return {
        text,
        provider: 'xkiro-direct',
        model: options.model || 'Xkiro AI Gateway',
        latencyMs: Date.now() - startTime,
      };
    } catch (xkiroErr: any) {
      console.warn('[ResponseEngine] Direct Xkiro failed:', xkiroErr?.message);
    }
  }

  // 3. Direct OpenRouter if client API Key is provided
  if (options?.apiKey && options.apiKey.trim().startsWith('sk-or-')) {
    try {
      const text = await callOpenRouterClientDirect(messages, options.apiKey.trim(), options.model, options?.onChunk);
      return {
        text,
        provider: 'openrouter-direct',
        model: options.model || 'OpenRouter AI',
        latencyMs: Date.now() - startTime,
      };
    } catch (openRouterErr: any) {
      console.warn('[ResponseEngine] Direct OpenRouter failed:', openRouterErr?.message);
    }
  }

  // 4. Direct Mayzaa API
  try {
    const text = await callMayzaaClientDirect(prompt, options?.onChunk);
    if (text && text.length > 0) {
      return {
        text,
        provider: 'mayzaa-direct',
        model: 'GPT-4o Mini (Mayzaa Live)',
        latencyMs: Date.now() - startTime,
      };
    }
  } catch (mayzaaErr: any) {
    console.error('[ResponseEngine] Live model call failed:', mayzaaErr?.message);
    throw new Error(`AI Model connection failed: ${mayzaaErr?.message || 'Unable to reach AI gateway'}`);
  }

  throw new Error('No AI response received from any upstream provider.');
}
