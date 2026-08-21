import fs from 'fs';
import path from 'path';

export interface OpenRouterModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  context_length: number;
  pricing?: { prompt: string; completion: string } | string;
  enabled: boolean;
  isCustom?: boolean;
  createdAt?: number;
}

export interface TelemetryMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  avgLatencyMs: number;
  lastLatencyMs: number;
  startedAt: number;
  lastActiveAt: number;
  activeSessions: number;
  apiKeyUsageRate: number; // requests per minute
  healthStatus: 'healthy' | 'degraded' | 'error';
}

export interface ServerDatabaseConfig {
  adminPassword: string;
  activeProvider: 'openrouter' | 'mayzaa' | 'xkiro' | 'gemini';
  activeModel: string;
  
  // Provider 1: OpenRouter
  openRouterApiKey: string;
  openRouterBaseUrl: string;
  
  // Provider 2: Mayzaa API
  mayzaaApiUrl: string;
  customApiUrl: string;
  
  // Provider 3: Xkiro.com
  xkiroApiKey: string;
  xkiroBaseUrl: string;
  xkiroModel: string;

  systemPrompt: string;
  systemPromptEnabled: boolean;
  safetyFilterLevel: 'low' | 'medium' | 'strict';
  openRouterModels?: OpenRouterModel[];
  aiSettings: {
    temperature: number;
    maxTokens: number;
    topP: number;
  };
  systemStats: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    latencyHistory: number[];
    startedAt: number;
    lastActiveAt: number;
  };
  logs: Array<{
    id: string;
    timestamp: number;
    provider: string;
    model: string;
    promptSnippet: string;
    responseSnippet?: string;
    tokens?: { input: number; output: number; total: number };
    status: number;
    latencyMs: number;
    ip?: string;
    error?: string;
  }>;
}

export const INITIAL_OPENROUTER_MODELS: OpenRouterModel[] = [
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini (OpenAI)',
    provider: 'OpenAI',
    description: 'Fast, highly intelligent model for lightweight tasks and everyday conversations.',
    context_length: 128000,
    pricing: { prompt: '$0.00000015', completion: '$0.0000006' },
    enabled: true,
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o (OpenAI)',
    provider: 'OpenAI',
    description: 'Flagship versatile multimodal model by OpenAI.',
    context_length: 128000,
    pricing: { prompt: '$0.0000025', completion: '$0.00001' },
    enabled: true,
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet (Anthropic)',
    provider: 'Anthropic',
    description: 'Superior reasoning, coding, and creative writing abilities.',
    context_length: 200000,
    pricing: { prompt: '$0.000003', completion: '$0.000015' },
    enabled: true,
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek V3 (DeepSeek)',
    provider: 'DeepSeek',
    description: 'Powerful, economical open-weights frontier model.',
    context_length: 64000,
    pricing: { prompt: '$0.00000014', completion: '$0.00000028' },
    enabled: true,
  },
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1 Reasoning (DeepSeek)',
    provider: 'DeepSeek',
    description: 'Advanced reasoning model with deep chain-of-thought logic.',
    context_length: 64000,
    pricing: { prompt: '$0.00000055', completion: '$0.00000219' },
    enabled: true,
  },
  {
    id: 'google/gemini-2.0-flash-001',
    name: 'Gemini 2.0 Flash (Google)',
    provider: 'Google',
    description: 'Ultra fast response times with multimodal agility and large context.',
    context_length: 1000000,
    pricing: { prompt: '$0.0000001', completion: '$0.0000004' },
    enabled: true,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B Instruct (Meta)',
    provider: 'Meta',
    description: 'Open-weight powerhouse with industry-leading reasoning performance.',
    context_length: 128000,
    pricing: { prompt: '$0.00000012', completion: '$0.0000003' },
    enabled: true,
  },
  {
    id: 'qwen/qwen-2.5-72b-instruct',
    name: 'Qwen 2.5 72B Instruct (Alibaba)',
    provider: 'Qwen',
    description: 'Exceptional open multilingual reasoning and math capabilities.',
    context_length: 128000,
    pricing: { prompt: '$0.00000035', completion: '$0.0000004' },
    enabled: true,
  },
  {
    id: 'mistralai/mistral-large-2411',
    name: 'Mistral Large (Mistral AI)',
    provider: 'Mistral AI',
    description: 'Top-tier reasoning, multilingual capabilities, and coding precision.',
    context_length: 128000,
    pricing: { prompt: '$0.000002', completion: '$0.000006' },
    enabled: true,
  },
  {
    id: 'mayzaa-chatgpt',
    name: 'Mayzaa ChatGPT Endpoint',
    provider: 'Mayzaa AI',
    description: 'Direct AI chat endpoint hosted by Mayzaa API (https://api.mayzaa.my.id).',
    context_length: 16000,
    pricing: { prompt: 'Free', completion: 'Free' },
    enabled: true,
  },
];

const DEFAULT_SYSTEM_PROMPT = `You are LYNXIEE MARKET AI, an advanced and precise intelligence model.
Always deliver high quality, factually accurate, structured, and polite responses.
Format code cleanly with syntax tags, formulas with LaTeX ($ for inline, $$ for block), and lists with clear hierarchy.`;

const DEFAULT_CONFIG: ServerDatabaseConfig = {
  adminPassword: process.env.DEV_PASSWORD || process.env.ADMIN_PASSWORD || 'DevLAI',
  activeProvider: (process.env.OPENROUTER_API_KEY ? 'openrouter' : 'mayzaa') as any,
  activeModel: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openRouterBaseUrl: 'https://openrouter.ai/api/v1',
  mayzaaApiUrl: process.env.MAYZAA_API_URL || 'https://api.mayzaa.my.id/api/ai/chat-gpt?text=',
  customApiUrl: process.env.MAYZAA_API_URL || 'https://api.mayzaa.my.id/api/ai/chat-gpt?text=',
  xkiroApiKey: process.env.XKIRO_API_KEY || '',
  xkiroBaseUrl: process.env.XKIRO_BASE_URL || 'https://api.xkiro.com/v1',
  xkiroModel: process.env.XKIRO_MODEL || 'openai/gpt-4o-mini',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  systemPromptEnabled: true,
  safetyFilterLevel: 'medium',
  openRouterModels: INITIAL_OPENROUTER_MODELS,
  aiSettings: {
    temperature: 0.7,
    maxTokens: 2048,
    topP: 0.9,
  },
  systemStats: {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    latencyHistory: [],
    startedAt: Date.now(),
    lastActiveAt: Date.now(),
  },
  logs: [],
};

const getDbPaths = () => {
  const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (isVercel) {
    return {
      dir: '/tmp',
      file: path.join('/tmp', 'lynxiee_config.json'),
    };
  }
  const dir = path.join(process.cwd(), 'database');
  return {
    dir,
    file: path.join(dir, 'config.json'),
  };
};

class DatabaseStore {
  private config: ServerDatabaseConfig;
  private activeSessionSet: Set<string> = new Set();

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): ServerDatabaseConfig {
    const { dir, file } = getDbPaths();
    try {
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
        } catch {
          // ignore directory creation error on serverless
        }
      }

      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          systemPromptEnabled: parsed.systemPromptEnabled !== undefined ? parsed.systemPromptEnabled : true,
          safetyFilterLevel: parsed.safetyFilterLevel || 'medium',
          aiSettings: {
            ...DEFAULT_CONFIG.aiSettings,
            ...(parsed.aiSettings || {}),
          },
          systemStats: {
            ...DEFAULT_CONFIG.systemStats,
            ...(parsed.systemStats || {}),
            latencyHistory: parsed.systemStats?.latencyHistory || [],
          },
          adminPassword: parsed.adminPassword || process.env.DEV_PASSWORD || DEFAULT_CONFIG.adminPassword,
          openRouterApiKey: parsed.openRouterApiKey || process.env.OPENROUTER_API_KEY || '',
          xkiroApiKey: parsed.xkiroApiKey || process.env.XKIRO_API_KEY || '',
          xkiroBaseUrl: parsed.xkiroBaseUrl || process.env.XKIRO_BASE_URL || 'https://api.xkiro.com/v1',
          xkiroModel: parsed.xkiroModel || process.env.XKIRO_MODEL || 'openai/gpt-4o-mini',
          mayzaaApiUrl: parsed.mayzaaApiUrl || process.env.MAYZAA_API_URL || 'https://api.mayzaa.my.id/api/ai/chat-gpt?text=',
          openRouterBaseUrl: parsed.openRouterBaseUrl || 'https://openrouter.ai/api/v1',
        };
      }
    } catch (err) {
      console.warn('[Database] Initializing with default config in-memory:', err);
    }

    this.saveConfig(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  }

  private saveConfig(configToSave: ServerDatabaseConfig) {
    const { dir, file } = getDbPaths();
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(file, JSON.stringify(configToSave, null, 2), 'utf-8');
    } catch (err) {
      try {
        const tmpFile = path.join('/tmp', 'lynxiee_config.json');
        fs.writeFileSync(tmpFile, JSON.stringify(configToSave, null, 2), 'utf-8');
      } catch (tmpErr) {
        // Safe in-memory fallback
      }
    }
  }

  public registerSession(sessionId: string) {
    if (sessionId) {
      this.activeSessionSet.add(sessionId);
    }
  }

  public getConfig(): ServerDatabaseConfig {
    const envKey = (process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY || '').trim();
    const effectiveKey = envKey.length > 0 ? envKey : (this.config.openRouterApiKey || '');
    const envXkiroKey = (process.env.XKIRO_API_KEY || '').trim();
    const effectiveXkiroKey = envXkiroKey.length > 0 ? envXkiroKey : (this.config.xkiroApiKey || '');
    const envAdminPassword = (process.env.DEV_PASSWORD || process.env.ADMIN_PASSWORD || '').trim();
    const effectiveAdminPassword = envAdminPassword.length > 0 ? envAdminPassword : (this.config.adminPassword || 'DevLAI');
    const envModel = (process.env.OPENROUTER_MODEL || '').trim();
    const effectiveModel = envModel.length > 0 ? envModel : this.config.activeModel;

    return {
      ...this.config,
      adminPassword: effectiveAdminPassword,
      openRouterApiKey: effectiveKey,
      xkiroApiKey: effectiveXkiroKey,
      activeModel: effectiveModel,
    };
  }

  public getPublicSettings() {
    const currentConfig = this.getConfig();
    return {
      provider: currentConfig.activeProvider,
      selectedModel: currentConfig.activeModel,
      customApiUrl: currentConfig.customApiUrl || currentConfig.mayzaaApiUrl,
      mayzaaApiUrl: currentConfig.mayzaaApiUrl,
      openRouterBaseUrl: currentConfig.openRouterBaseUrl,
      xkiroBaseUrl: currentConfig.xkiroBaseUrl,
      xkiroModel: currentConfig.xkiroModel,
      systemPrompt: currentConfig.systemPrompt,
      systemPromptEnabled: currentConfig.systemPromptEnabled,
      safetyFilterLevel: currentConfig.safetyFilterLevel,
      temperature: currentConfig.aiSettings.temperature,
      maxTokens: currentConfig.aiSettings.maxTokens,
      topP: currentConfig.aiSettings.topP,
      openRouterKeyPresent: Boolean(currentConfig.openRouterApiKey && currentConfig.openRouterApiKey.length > 5),
      openRouterKeyMasked: this.maskApiKey(currentConfig.openRouterApiKey),
      xkiroKeyPresent: Boolean(currentConfig.xkiroApiKey && currentConfig.xkiroApiKey.length > 5),
      xkiroKeyMasked: this.maskApiKey(currentConfig.xkiroApiKey),
    };
  }

  public maskApiKey(key: string): string {
    if (!key || key.length < 8) return '';
    const prefix = key.slice(0, 7);
    const suffix = key.slice(-4);
    return `${prefix}••••••••••••${suffix}`;
  }

  public updateSettings(partial: Partial<{
    provider: 'openrouter' | 'mayzaa' | 'xkiro' | 'gemini';
    selectedModel: string;
    customApiUrl: string;
    mayzaaApiUrl: string;
    openRouterBaseUrl: string;
    xkiroApiKey: string;
    xkiroBaseUrl: string;
    xkiroModel: string;
    systemPrompt: string;
    systemPromptEnabled: boolean;
    safetyFilterLevel: 'low' | 'medium' | 'strict';
    temperature: number;
    maxTokens: number;
    topP: number;
  }>) {
    if (partial.provider !== undefined) this.config.activeProvider = partial.provider;
    if (partial.selectedModel !== undefined) this.config.activeModel = partial.selectedModel;
    if (partial.customApiUrl !== undefined) {
      this.config.customApiUrl = partial.customApiUrl;
      this.config.mayzaaApiUrl = partial.customApiUrl;
    }
    if (partial.mayzaaApiUrl !== undefined) {
      this.config.mayzaaApiUrl = partial.mayzaaApiUrl;
      this.config.customApiUrl = partial.mayzaaApiUrl;
    }
    if (partial.openRouterBaseUrl !== undefined) this.config.openRouterBaseUrl = partial.openRouterBaseUrl;
    if (partial.xkiroApiKey !== undefined && !partial.xkiroApiKey.includes('••••')) this.config.xkiroApiKey = partial.xkiroApiKey.trim();
    if (partial.xkiroBaseUrl !== undefined) this.config.xkiroBaseUrl = partial.xkiroBaseUrl;
    if (partial.xkiroModel !== undefined) this.config.xkiroModel = partial.xkiroModel;
    if (partial.systemPrompt !== undefined) this.config.systemPrompt = partial.systemPrompt;
    if (partial.systemPromptEnabled !== undefined) this.config.systemPromptEnabled = partial.systemPromptEnabled;
    if (partial.safetyFilterLevel !== undefined) this.config.safetyFilterLevel = partial.safetyFilterLevel;

    if (partial.temperature !== undefined || partial.maxTokens !== undefined || partial.topP !== undefined) {
      this.config.aiSettings = {
        temperature: partial.temperature ?? this.config.aiSettings.temperature,
        maxTokens: partial.maxTokens ?? this.config.aiSettings.maxTokens,
        topP: partial.topP ?? this.config.aiSettings.topP,
      };
    }

    this.saveConfig(this.config);
  }

  public setOpenRouterKey(key: string) {
    this.config.openRouterApiKey = key.trim();
    if (this.config.openRouterApiKey) {
      this.config.activeProvider = 'openrouter';
    }
    this.saveConfig(this.config);
  }

  public deleteOpenRouterKey() {
    this.config.openRouterApiKey = '';
    if (this.config.activeProvider === 'openrouter') {
      this.config.activeProvider = 'mayzaa';
    }
    this.saveConfig(this.config);
  }

  public setXkiroKey(key: string) {
    this.config.xkiroApiKey = key.trim();
    if (this.config.xkiroApiKey) {
      this.config.activeProvider = 'xkiro';
    }
    this.saveConfig(this.config);
  }

  public deleteXkiroKey() {
    this.config.xkiroApiKey = '';
    if (this.config.activeProvider === 'xkiro') {
      this.config.activeProvider = 'mayzaa';
    }
    this.saveConfig(this.config);
  }

  public setAdminPassword(newPassword: string) {
    this.config.adminPassword = newPassword;
    this.saveConfig(this.config);
  }

  public logRequest(entry: {
    provider: string;
    model: string;
    promptSnippet: string;
    responseSnippet?: string;
    tokens?: { input: number; output: number; total: number };
    status: number;
    latencyMs: number;
    ip?: string;
    error?: string;
  }) {
    const id = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const logItem = {
      id,
      timestamp: Date.now(),
      ...entry,
      promptSnippet: entry.promptSnippet ? entry.promptSnippet.slice(0, 150) : '',
      responseSnippet: entry.responseSnippet ? entry.responseSnippet.slice(0, 150) : undefined,
    };

    this.config.logs.unshift(logItem);
    if (this.config.logs.length > 300) {
      this.config.logs = this.config.logs.slice(0, 300);
    }

    this.config.systemStats.totalRequests += 1;
    if (entry.status >= 200 && entry.status < 400) {
      this.config.systemStats.successfulRequests += 1;
    } else {
      this.config.systemStats.failedRequests += 1;
    }

    // Token aggregation
    const inputT = entry.tokens?.input || Math.max(1, Math.round((entry.promptSnippet?.length || 0) / 4));
    const outputT = entry.tokens?.output || Math.max(1, Math.round((entry.responseSnippet?.length || 0) / 4));
    const totalT = entry.tokens?.total || (inputT + outputT);

    this.config.systemStats.inputTokens = (this.config.systemStats.inputTokens || 0) + inputT;
    this.config.systemStats.outputTokens = (this.config.systemStats.outputTokens || 0) + outputT;
    this.config.systemStats.totalTokens = (this.config.systemStats.totalTokens || 0) + totalT;

    // Latency History (keep last 30 measurements)
    const latencies = this.config.systemStats.latencyHistory || [];
    latencies.push(entry.latencyMs);
    if (latencies.length > 30) latencies.shift();
    this.config.systemStats.latencyHistory = latencies;

    this.config.systemStats.lastActiveAt = Date.now();
    this.saveConfig(this.config);
  }

  public getLogs() {
    return this.config.logs;
  }

  public clearLogs() {
    this.config.logs = [];
    this.saveConfig(this.config);
  }

  public getTelemetry(): TelemetryMetrics {
    const stats = this.config.systemStats;
    const latencies = stats.latencyHistory || [];
    const avgLatency = latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0;
    const lastLatency = latencies.length > 0 ? latencies[latencies.length - 1] : 0;

    // Calculate usage rate (requests in last 5 minutes)
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const recentLogs = this.config.logs.filter((l) => l.timestamp >= fiveMinAgo);
    const rpm = recentLogs.length > 0 ? Math.round((recentLogs.length / 5) * 10) / 10 : 0;

    // Determine health status
    let healthStatus: 'healthy' | 'degraded' | 'error' = 'healthy';
    if (stats.failedRequests > 0 && stats.failedRequests / Math.max(1, stats.totalRequests) > 0.3) {
      healthStatus = 'error';
    } else if (avgLatency > 4000) {
      healthStatus = 'degraded';
    }

    return {
      totalRequests: stats.totalRequests,
      successfulRequests: stats.successfulRequests,
      failedRequests: stats.failedRequests,
      totalTokens: stats.totalTokens || (stats.inputTokens + stats.outputTokens),
      inputTokens: stats.inputTokens || 0,
      outputTokens: stats.outputTokens || 0,
      avgLatencyMs: avgLatency,
      lastLatencyMs: lastLatency,
      startedAt: stats.startedAt,
      lastActiveAt: stats.lastActiveAt,
      activeSessions: Math.max(1, this.activeSessionSet.size),
      apiKeyUsageRate: rpm,
      healthStatus,
    };
  }

  public getStats() {
    return this.getTelemetry();
  }

  public setActiveProvider(provider: 'openrouter' | 'mayzaa' | 'xkiro' | 'gemini') {
    this.config.activeProvider = provider;
    this.saveConfig(this.config);
  }

  public setXkiroBaseUrl(url: string) {
    this.config.xkiroBaseUrl = url;
    this.saveConfig(this.config);
  }

  public setXkiroModel(model: string) {
    this.config.xkiroModel = model;
    this.saveConfig(this.config);
  }

  public setMayzaaApiUrl(url: string) {
    this.config.mayzaaApiUrl = url;
    this.saveConfig(this.config);
  }

  public getOpenRouterModels(): OpenRouterModel[] {
    if (!this.config.openRouterModels || this.config.openRouterModels.length === 0) {
      this.config.openRouterModels = [...INITIAL_OPENROUTER_MODELS];
      this.saveConfig(this.config);
    }
    return this.config.openRouterModels;
  }

  public addOpenRouterModel(newModel: Partial<OpenRouterModel>): OpenRouterModel {
    if (!newModel.id || !newModel.id.trim()) {
      throw new Error('Model ID is required (e.g. "anthropic/claude-3.5-sonnet")');
    }
    const cleanId = newModel.id.trim();
    const models = this.getOpenRouterModels();
    
    const existingIndex = models.findIndex((m) => m.id.toLowerCase() === cleanId.toLowerCase());
    const modelToSave: OpenRouterModel = {
      id: cleanId,
      name: newModel.name?.trim() || cleanId,
      provider: newModel.provider?.trim() || cleanId.split('/')[0] || 'Custom',
      description: newModel.description?.trim() || `Model ${cleanId}`,
      context_length: Number(newModel.context_length) || 128000,
      pricing: newModel.pricing || { prompt: '$0.000001', completion: '$0.000002' },
      enabled: newModel.enabled !== false,
      isCustom: true,
      createdAt: Date.now(),
    };

    if (existingIndex >= 0) {
      models[existingIndex] = { ...models[existingIndex], ...modelToSave };
    } else {
      models.unshift(modelToSave);
    }

    this.config.openRouterModels = models;
    this.saveConfig(this.config);
    return modelToSave;
  }

  public updateOpenRouterModel(id: string, updates: Partial<OpenRouterModel>): OpenRouterModel {
    const models = this.getOpenRouterModels();
    const index = models.findIndex((m) => m.id.toLowerCase() === id.toLowerCase());
    if (index === -1) {
      throw new Error(`Model with ID "${id}" not found.`);
    }

    const updated = {
      ...models[index],
      ...updates,
      id: updates.id ? updates.id.trim() : models[index].id,
      name: updates.name ? updates.name.trim() : models[index].name,
      provider: updates.provider ? updates.provider.trim() : models[index].provider,
      description: updates.description !== undefined ? updates.description.trim() : models[index].description,
      context_length: updates.context_length ? Number(updates.context_length) : models[index].context_length,
      pricing: updates.pricing !== undefined ? updates.pricing : models[index].pricing,
      enabled: updates.enabled !== undefined ? updates.enabled : models[index].enabled,
    };

    models[index] = updated;
    this.config.openRouterModels = models;
    this.saveConfig(this.config);
    return updated;
  }

  public deleteOpenRouterModel(id: string): boolean {
    const models = this.getOpenRouterModels();
    const filtered = models.filter((m) => m.id.toLowerCase() !== id.toLowerCase());
    if (filtered.length === models.length) return false;

    this.config.openRouterModels = filtered;
    this.saveConfig(this.config);
    return true;
  }

  public setActiveModel(modelId: string) {
    this.config.activeModel = modelId;
    if (modelId.includes('mayzaa')) {
      this.config.activeProvider = 'mayzaa';
    } else if (modelId.startsWith('gemini-') && !modelId.includes('/')) {
      this.config.activeProvider = 'gemini';
    } else {
      this.config.activeProvider = 'openrouter';
    }
    this.saveConfig(this.config);
  }

  public toggleOpenRouterModel(id: string, enabled: boolean) {
    return this.updateOpenRouterModel(id, { enabled });
  }

  public resetOpenRouterModels(): OpenRouterModel[] {
    this.config.openRouterModels = [...INITIAL_OPENROUTER_MODELS];
    this.saveConfig(this.config);
    return this.config.openRouterModels;
  }

  public resetSystemPrompt(): string {
    this.config.systemPrompt = DEFAULT_SYSTEM_PROMPT;
    this.config.systemPromptEnabled = true;
    this.saveConfig(this.config);
    return DEFAULT_SYSTEM_PROMPT;
  }
}

export const db = new DatabaseStore();
