export type Role = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  model?: string;
  provider?: string;
  isStreaming?: boolean;
  error?: boolean;
  responseTimeMs?: number;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  messages: ChatMessage[];
}

export type AIProvider = 'openrouter' | 'mayzaa' | 'xkiro' | 'gemini';

export interface AISettings {
  provider: AIProvider;
  selectedModel: string;
  // OpenRouter
  openRouterApiKey?: string;
  openRouterBaseUrl?: string;
  openRouterKeyPresent?: boolean;
  openRouterKeyMasked?: string;
  // Mayzaa API
  mayzaaApiUrl?: string;
  customApiUrl?: string;
  // Xkiro.com API
  xkiroApiKey?: string;
  xkiroBaseUrl?: string;
  xkiroModel?: string;
  xkiroKeyPresent?: boolean;
  xkiroKeyMasked?: string;
  // System Prompt & AI Hyperparameters
  systemPrompt: string;
  systemPromptEnabled?: boolean;
  temperature: number;
  maxTokens: number;
  topP: number;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt?: string | number;
    completion?: string | number;
  } | string;
  provider?: string;
  enabled?: boolean;
  isCustom?: boolean;
  architecture?: {
    modality?: string;
    tokenizer?: string;
    instruct_type?: string;
  };
}

export interface APILogEntry {
  id: string;
  timestamp: number;
  provider: string;
  model: string;
  promptSnippet: string;
  responseSnippet?: string;
  status: number;
  latencyMs: number;
  ip?: string;
  error?: string;
}

export interface SystemStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  startedAt: number;
  lastActiveAt: number;
  openRouterConnected: boolean;
  xkiroConnected?: boolean;
  activeProvider: AIProvider;
  activeModel: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title?: string;
  message: string;
}

export interface AuthUser {
  uid: string;
  name: string;
  email: string;
  createdAt: number;
  lastLogin: number;
  photoURL?: string;
  isDev?: boolean;
}

export interface UserPreferences {
  userName: string;
  theme: 'dark' | 'light' | 'slate';
  fontSize: 'sm' | 'base' | 'lg';
  streamResponse: boolean;
  typewriterSpeed?: number; // ms per char (e.g. 10)
  autoSpeakAi?: boolean;
  voiceLanguage?: 'id-ID' | 'en-US';
  soundEffects: boolean;
  show3DBackground: boolean;
  clientApiKey?: string;
}

