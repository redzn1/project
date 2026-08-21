import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  Key,
  Cpu,
  Sliders,
  FileText,
  Lock,
  LogOut,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  ExternalLink,
  Zap,
  Activity,
  Trash2,
  Eye,
  EyeOff,
  Sparkles,
  Database,
  Check,
  Send,
  Square,
  RotateCcw,
  Terminal,
  Clock,
  Layers,
  Flame,
  ShieldAlert,
  SlidersHorizontal,
  ChevronRight,
  Globe,
  Radio,
  Copy,
  ArrowLeft,
  Server,
  PlayCircle,
  Code,
  CheckCheck,
} from 'lucide-react';
import { AISettings, OpenRouterModel, APILogEntry, ToastMessage } from '../types';

interface TelemetryData {
  latency: number;
  health: 'Operational' | 'Degraded' | 'Critical';
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  sessions: {
    active: number;
    totalRequests: number;
  };
  errors: {
    ratePercent: number;
    failedCount: number;
    successCount: number;
    breakdown: {
      client4xx: number;
      server5xx: number;
      timeout: number;
    };
  };
  recentLatencyHistory: number[];
}

interface ProviderConfigState {
  activeProvider: 'openrouter' | 'mayzaa' | 'xkiro' | 'gemini';
  activeModel: string;
  openRouterKey: string;
  openRouterKeyMasked: string;
  openRouterKeyPresent: boolean;
  xkiroKey: string;
  xkiroKeyMasked: string;
  xkiroKeyPresent: boolean;
  xkiroBaseUrl: string;
  xkiroModel: string;
  mayzaaUrl: string;
}

interface AdminPanelProps {
  onBackToChat: () => void;
  onShowToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

type TabType = 'providers' | 'telemetry' | 'models' | 'controls' | 'preview' | 'apidocs' | 'diagnostics' | 'security';

export const AdminPanel: React.FC<AdminPanelProps> = ({ onBackToChat, onShowToast }) => {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isDevUser, setIsDevUser] = useState<boolean>(false);
  const [password, setPassword] = useState('');
  const [emailInput, setEmailInput] = useState('dev@lynxie.ai');
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<TabType>('providers');

  // Unified Providers State (3 Systems)
  const [providerConfig, setProviderConfig] = useState<ProviderConfigState>({
    activeProvider: 'mayzaa',
    activeModel: 'openai/gpt-4o-mini',
    openRouterKey: '',
    openRouterKeyMasked: '',
    openRouterKeyPresent: false,
    xkiroKey: '',
    xkiroKeyMasked: '',
    xkiroKeyPresent: false,
    xkiroBaseUrl: 'https://api.xkiro.com/v1',
    xkiroModel: 'openai/gpt-4o-mini',
    mayzaaUrl: 'https://api.mayzaa.my.id/api/ai/chat-gpt?text=',
  });

  // Test status for each provider
  const [testingProvider, setTestingProvider] = useState<'openrouter' | 'mayzaa' | 'xkiro' | null>(null);
  const [testResults, setTestResults] = useState<{
    openrouter?: { success: boolean; message: string };
    mayzaa?: { success: boolean; message: string };
    xkiro?: { success: boolean; message: string };
  }>({});

  // Telemetry data
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    latency: 180,
    health: 'Operational',
    tokens: { input: 12450, output: 28910, total: 41360 },
    sessions: { active: 1, totalRequests: 84 },
    errors: { ratePercent: 0, failedCount: 0, successCount: 84, breakdown: { client4xx: 0, server5xx: 0, timeout: 0 } },
    recentLatencyHistory: [140, 165, 180, 150, 190, 175, 180],
  });
  const [telemetryLoading, setTelemetryLoading] = useState(false);

  // Settings & Hyperparameters
  const [settings, setSettings] = useState<AISettings>({
    provider: 'mayzaa',
    selectedModel: 'openai/gpt-4o-mini',
    customApiUrl: 'https://api.mayzaa.my.id/api/ai/chat-gpt?text=',
    systemPrompt: 'You are LYNXIEE MARKET AI, an ultra-fast, intelligent, and concise AI assistant with deep expertise in coding, data analytics, and general knowledge.',
    temperature: 0.7,
    maxTokens: 2048,
    topP: 0.9,
  });

  const [savingSettings, setSavingSettings] = useState(false);

  // Models state
  const [modelsList, setModelsList] = useState<OpenRouterModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState('ALL');

  // Logs state
  const [logs, setLogs] = useState<APILogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilter, setLogFilter] = useState<'ALL' | 'SUCCESS' | 'ERROR'>('ALL');

  // Playground interactive sandbox
  const [previewMessages, setPreviewMessages] = useState<Array<{ id: string; role: 'user' | 'assistant'; content: string; provider?: string; timestamp: number }>>([
    {
      id: 'prev_1',
      role: 'assistant',
      content: 'Developer Console Active. Live testing sandbox for OpenRouter, Mayzaa API, and Xkiro.com.',
      provider: 'System Gateway',
      timestamp: Date.now(),
    },
  ]);
  const [previewInput, setPreviewInput] = useState('');
  const [previewGenerating, setPreviewGenerating] = useState(false);
  const [previewProvider, setPreviewProvider] = useState<'openrouter' | 'mayzaa' | 'xkiro'>('mayzaa');

  // Copied indicator state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Verify auth on mount (auto-bypass for dev account)
  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      // Auto-authenticate if developer account is active
      const autoRes = await fetch('/api/admin/auto-auth');
      const autoData = await autoRes.json();
      if (autoData.authenticated) {
        setIsAuthenticated(true);
        setIsDevUser(true);
        loadAllData();
        return;
      }

      const res = await fetch('/api/admin/status');
      const data = await res.json();
      const isAuth = Boolean(data.authenticated);
      setIsAuthenticated(isAuth);
      if (isAuth) {
        loadAllData();
      }
    } catch {
      setIsAuthenticated(false);
    }
  };

  const loadAllData = async () => {
    fetchProvidersConfig();
    fetchTelemetry();
    fetchModels();
    fetchLogs();
  };

  const fetchProvidersConfig = async () => {
    try {
      const res = await fetch('/api/admin/providers');
      if (res.ok) {
        const data = await res.json();
        setProviderConfig({
          activeProvider: data.activeProvider || 'mayzaa',
          activeModel: data.activeModel || 'openai/gpt-4o-mini',
          openRouterKey: '',
          openRouterKeyMasked: data.providers?.openrouter?.keyMasked || '',
          openRouterKeyPresent: Boolean(data.providers?.openrouter?.keyPresent),
          xkiroKey: '',
          xkiroKeyMasked: data.providers?.xkiro?.keyMasked || '',
          xkiroKeyPresent: Boolean(data.providers?.xkiro?.keyPresent),
          xkiroBaseUrl: data.providers?.xkiro?.baseUrl || 'https://api.xkiro.com/v1',
          xkiroModel: data.providers?.xkiro?.model || 'openai/gpt-4o-mini',
          mayzaaUrl: data.providers?.mayzaa?.apiUrl || 'https://api.mayzaa.my.id/api/ai/chat-gpt?text=',
        });
        if (data.aiSettings) {
          setSettings((prev) => ({
            ...prev,
            temperature: data.aiSettings.temperature ?? 0.7,
            maxTokens: data.aiSettings.maxTokens ?? 2048,
            topP: data.aiSettings.topP ?? 0.9,
            systemPrompt: data.systemPrompt ?? prev.systemPrompt,
          }));
        }
      }
    } catch (e) {
      console.warn('Providers config fetch error:', e);
    }
  };

  const fetchTelemetry = async () => {
    setTelemetryLoading(true);
    try {
      const res = await fetch('/api/admin/telemetry');
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
      }
    } catch (e) {
      console.warn('Telemetry fetch error:', e);
    } finally {
      setTelemetryLoading(false);
    }
  };

  const fetchModels = async () => {
    setModelsLoading(true);
    try {
      const res = await fetch('/api/admin/models');
      if (res.ok) {
        const data = await res.json();
        setModelsList(data.models || []);
      }
    } catch (e) {
      console.warn('Models fetch error:', e);
    } finally {
      setModelsLoading(false);
    }
  };

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await fetch('/api/admin/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.warn('Logs fetch error:', e);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      const isDev = emailInput.trim().toLowerCase() === 'dev@lynxie.ai';
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.trim() || 'dev@lynxie.ai',
          password: password.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('lynxiee_dev_auth', 'true');
        setIsAuthenticated(true);
        setIsDevUser(isDev || data.isDev);
        onShowToast({
          type: 'success',
          title: 'Akses Diterima',
          message: 'Selamat datang di Panel Kontrol Developer /openr',
        });
        loadAllData();
      } else {
        setAuthError(data.error || 'Autentikasi gagal. Silakan coba kembali.');
      }
    } catch (err: any) {
      setAuthError('Koneksi server terputus.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDevBypass = async () => {
    setAuthLoading(true);
    try {
      const res = await fetch('/api/admin/dev-login');
      const data = await res.json();
      if (data.authenticated) {
        localStorage.setItem('lynxiee_dev_auth', 'true');
        setIsAuthenticated(true);
        setIsDevUser(true);
        onShowToast({
          type: 'success',
          title: 'Dev Bypass Aktif',
          message: 'Masuk tanpa password untuk akun developer dev@lynxie.ai',
        });
        loadAllData();
      }
    } catch {
      setAuthError('Dev bypass gagal terhubung ke backend.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch {}
    localStorage.removeItem('lynxiee_dev_auth');
    setIsAuthenticated(false);
    onBackToChat();
  };

  const handleSaveProviders = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin/providers/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activeProvider: providerConfig.activeProvider,
          activeModel: providerConfig.activeModel,
          openRouterKey: providerConfig.openRouterKey || undefined,
          xkiroKey: providerConfig.xkiroKey || undefined,
          xkiroBaseUrl: providerConfig.xkiroBaseUrl,
          xkiroModel: providerConfig.xkiroModel,
          mayzaaUrl: providerConfig.mayzaaUrl,
          systemPrompt: settings.systemPrompt,
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
          topP: settings.topP,
        }),
      });

      if (res.ok) {
        onShowToast({
          type: 'success',
          title: 'Konfigurasi 3 Provider Disimpan',
          message: `Provider aktif saat ini: ${providerConfig.activeProvider.toUpperCase()}`,
        });
        fetchProvidersConfig();
      } else {
        const d = await res.json();
        throw new Error(d.error || 'Gagal menyimpan');
      }
    } catch (err: any) {
      onShowToast({
        type: 'error',
        title: 'Gagal Menyimpan',
        message: err?.message || 'Tidak dapat memperbarui konfigurasi provider.',
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSetActiveProvider = async (provider: 'openrouter' | 'mayzaa' | 'xkiro') => {
    try {
      const res = await fetch('/api/admin/providers/set-active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      if (res.ok) {
        setProviderConfig((prev) => ({ ...prev, activeProvider: provider }));
        onShowToast({
          type: 'success',
          title: 'Provider Aktif Diubah',
          message: `Semua respon chatbot sekarang diarahkan ke ${provider.toUpperCase()}`,
        });
      }
    } catch {
      onShowToast({
        type: 'error',
        title: 'Gagal Mengubah Provider',
        message: 'Koneksi ke backend gagal.',
      });
    }
  };

  const handleTestProvider = async (provider: 'openrouter' | 'mayzaa' | 'xkiro') => {
    setTestingProvider(provider);
    try {
      let endpoint = '/api/admin/providers/test-openrouter';
      let payload: any = { apiKey: providerConfig.openRouterKey };

      if (provider === 'mayzaa') {
        endpoint = '/api/admin/providers/test-mayzaa';
        payload = { apiUrl: providerConfig.mayzaaUrl };
      } else if (provider === 'xkiro') {
        endpoint = '/api/admin/providers/test-xkiro';
        payload = { apiKey: providerConfig.xkiroKey, baseUrl: providerConfig.xkiroBaseUrl };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setTestResults((prev) => ({
        ...prev,
        [provider]: {
          success: Boolean(data.success),
          message: data.message || (data.success ? 'Koneksi Sukses' : 'Koneksi Gagal'),
        },
      }));

      onShowToast({
        type: data.success ? 'success' : 'error',
        title: `Test ${provider.toUpperCase()}`,
        message: data.message || 'Hasil pengujian selesai.',
      });
    } catch (e: any) {
      setTestResults((prev) => ({
        ...prev,
        [provider]: { success: false, message: e.message || 'Network error' },
      }));
    } finally {
      setTestingProvider(null);
    }
  };

  const handleClearLogs = async () => {
    try {
      await fetch('/api/admin/logs/clear', { method: 'POST' });
      setLogs([]);
      onShowToast({
        type: 'info',
        title: 'Log Dibersihkan',
        message: 'Seluruh riwayat diagnostik telah dihapus.',
      });
    } catch {
      onShowToast({
        type: 'error',
        title: 'Gagal',
        message: 'Gagal membersihkan log server.',
      });
    }
  };

  const handleSendPreview = async () => {
    const trimmed = previewInput.trim();
    if (!trimmed || previewGenerating) return;

    const userMsg = { id: `u_${Date.now()}`, role: 'user' as const, content: trimmed, timestamp: Date.now() };
    const botMsgId = `b_${Date.now()}`;
    const newMessages = [...previewMessages, userMsg];
    setPreviewMessages(newMessages);
    setPreviewInput('');
    setPreviewGenerating(true);

    try {
      let endpoint = '/api/chat';
      let payload: any = {
        messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        model: providerConfig.activeModel,
        temperature: settings.temperature,
        systemPrompt: settings.systemPrompt,
      };

      if (previewProvider === 'openrouter') {
        endpoint = '/api/openr';
        payload = { text: trimmed, model: providerConfig.activeModel, system: settings.systemPrompt };
      } else if (previewProvider === 'xkiro') {
        endpoint = '/api/xkiro';
        payload = { text: trimmed, model: providerConfig.xkiroModel, system: settings.systemPrompt };
      } else if (previewProvider === 'mayzaa') {
        endpoint = '/api/chat';
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      const text = data.result || data.response || data.text || 'No output received.';

      setPreviewMessages((prev) => [
        ...prev,
        {
          id: botMsgId,
          role: 'assistant',
          content: text,
          provider: data.provider || previewProvider,
          timestamp: Date.now(),
        },
      ]);
    } catch (e: any) {
      setPreviewMessages((prev) => [
        ...prev,
        {
          id: botMsgId,
          role: 'assistant',
          content: `Error: ${e.message}`,
          provider: 'Error',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setPreviewGenerating(false);
    }
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
    onShowToast({
      type: 'info',
      title: 'Disalin ke Clipboard',
      message: text.slice(0, 45) + '...',
    });
  };

  // Filtered models
  const filteredModels = useMemo(() => {
    let list = modelsList;
    if (providerFilter !== 'ALL') {
      list = list.filter((m) => m.provider.toLowerCase() === providerFilter.toLowerCase());
    }
    if (modelSearch.trim()) {
      const q = modelSearch.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q));
    }
    return list;
  }, [modelsList, providerFilter, modelSearch]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    if (logFilter === 'SUCCESS') return logs.filter((l) => l.statusCode >= 200 && l.statusCode < 400);
    if (logFilter === 'ERROR') return logs.filter((l) => l.statusCode >= 400);
    return logs;
  }, [logs, logFilter]);

  // ----------------------------------------------------
  // RENDER: Unauthenticated / Security Lock Screen
  // ----------------------------------------------------
  if (isAuthenticated === false) {
    return (
      <div className="fixed inset-0 z-50 bg-[#090d16] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#0f172a]/95 backdrop-blur-2xl border border-slate-700/60 p-7 sm:p-8 rounded-3xl shadow-2xl space-y-6 relative overflow-hidden">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
              <Terminal className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Developer Gateway (/openr)</h2>
              <p className="text-xs text-slate-400 mt-1">
                Akses panel kontrol 3 Sistem Provider: OpenRouter, Mayzaa API, dan Xkiro.com
              </p>
            </div>
          </div>

          {/* Dev Quick Bypass Alert */}
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-emerald-300">Akun Developer (Passwordless)</p>
              <p className="text-slate-300">
                Akun <code className="text-emerald-400 font-mono font-bold">dev@lynxie.ai</code> dapat langsung masuk tanpa memasukkan password.
              </p>
              <button
                type="button"
                onClick={handleDevBypass}
                disabled={authLoading}
                className="mt-2 w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-600/20"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Masuk Otomatis Sebagai Dev</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {authError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{authError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Developer Email</label>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="dev@lynxie.ai"
                className="w-full bg-[#090d16] border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-all font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Password Kredensial (Opsional jika Dev)</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password admin..."
                  className="w-full bg-[#090d16] border border-slate-700/60 rounded-xl px-4 pr-11 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-600/25"
            >
              {authLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Otorisasi & Buka Dashboard</span>
                </>
              )}
            </button>
          </form>

          <button
            onClick={onBackToChat}
            className="w-full py-2.5 text-center text-xs text-slate-400 hover:text-white transition-colors"
          >
            ← Kembali ke Chatbot
          </button>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: Main Dashboard with Modern Left Sidebar Navbar
  // ----------------------------------------------------
  return (
    <div className="fixed inset-0 z-50 bg-[#080c14] text-slate-100 flex flex-col md:flex-row overflow-hidden font-sans">
      
      {/* ---------------------------------------------------- */}
      {/* LEFT SIDEBAR NAVIGATION BAR                          */}
      {/* ---------------------------------------------------- */}
      <aside className="w-full md:w-64 lg:w-72 bg-[#0d1322] border-r border-slate-800/80 flex flex-col shrink-0 z-20">
        
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-400 p-0.5 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <div className="w-full h-full bg-[#090d16] rounded-[10px] flex items-center justify-center">
                <img src="/logo.svg" alt="LYNXIEE" className="w-6 h-6 object-contain" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-white tracking-tight">LYNXIEE</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                  /openr
                </span>
              </div>
              <p className="text-[11px] text-slate-400">3 AI Provider Hub</p>
            </div>
          </div>
          
          <button
            onClick={onBackToChat}
            title="Kembali ke Chat"
            className="md:hidden p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Active Provider Indicator Banner */}
        <div className="px-4 py-3 bg-[#11182c] border-b border-slate-800/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-slate-400">Active Engine:</span>
          </div>
          <span className="font-bold font-mono text-cyan-300 uppercase px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
            {providerConfig.activeProvider}
          </span>
        </div>

        {/* Sidebar Menu Items */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1.5">
            Core Control
          </div>

          <button
            onClick={() => setActiveTab('providers')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'providers'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-md shadow-cyan-500/10 font-semibold'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Zap className={`w-4 h-4 ${activeTab === 'providers' ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span>3 AI Providers Hub</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
              3 Systems
            </span>
          </button>

          <button
            onClick={() => setActiveTab('telemetry')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'telemetry'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Activity className={`w-4 h-4 ${activeTab === 'telemetry' ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span>Overview & Metrics</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('models')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'models'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Cpu className={`w-4 h-4 ${activeTab === 'models' ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span>Model Catalog</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
              {modelsList.length || 10}+
            </span>
          </button>

          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 pt-4 pb-1.5">
            Developer Tools
          </div>

          <button
            onClick={() => setActiveTab('preview')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'preview'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <PlayCircle className={`w-4 h-4 ${activeTab === 'preview' ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span>Interactive Sandbox</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
              Live
            </span>
          </button>

          <button
            onClick={() => setActiveTab('apidocs')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'apidocs'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Code className={`w-4 h-4 ${activeTab === 'apidocs' ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span>API Endpoints & Docs</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('controls')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'controls'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <SlidersHorizontal className={`w-4 h-4 ${activeTab === 'controls' ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span>Hyperparameters</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'diagnostics'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FileText className={`w-4 h-4 ${activeTab === 'diagnostics' ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span>Logs & Telemetry</span>
            </div>
            {logs.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                {logs.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'security'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Shield className={`w-4 h-4 ${activeTab === 'security' ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span>Security & Access</span>
            </div>
          </button>
        </nav>

        {/* Sidebar Footer User Info */}
        <div className="p-3 border-t border-slate-800/80 space-y-2">
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-xs font-bold shrink-0">
                D
              </div>
              <div className="overflow-hidden">
                <p className="text-[11px] font-semibold text-white truncate">dev@lynxie.ai</p>
                <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Bypass Active
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Logout"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={onBackToChat}
            className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-2 transition-colors border border-slate-700/50"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Chatbot</span>
          </button>
        </div>
      </aside>

      {/* ---------------------------------------------------- */}
      {/* MAIN CONTENT AREA                                    */}
      {/* ---------------------------------------------------- */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-[#080c14]">
        
        {/* Top Content Bar */}
        <header className="px-6 py-3.5 border-b border-slate-800/80 bg-[#0b101c]/90 backdrop-blur-md flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              {activeTab === 'providers' && '3 AI Provider Gateway Hub'}
              {activeTab === 'telemetry' && 'System Overview & Telemetry'}
              {activeTab === 'models' && 'Model Catalog & Context Window'}
              {activeTab === 'controls' && 'AI Hyperparameters & System Prompt'}
              {activeTab === 'preview' && 'Interactive AI Sandbox Playground'}
              {activeTab === 'apidocs' && 'Direct GET & POST API Documentation'}
              {activeTab === 'diagnostics' && 'Real-time Diagnostic Logs'}
              {activeTab === 'security' && 'Security & Developer Authentication'}
            </h1>
            <p className="text-xs text-slate-400">
              Konfigurasi terpusat untuk OpenRouter, Mayzaa API, dan Xkiro.com
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchProvidersConfig();
                fetchTelemetry();
                fetchLogs();
                onShowToast({ type: 'info', title: 'Data Diperbarui', message: 'Memuat ulang data terbaru...' });
              }}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/40 text-xs flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={handleSaveProviders}
              disabled={savingSettings}
              className="py-2 px-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-cyan-600/20 disabled:opacity-50"
            >
              {savingSettings ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>Simpan Perubahan</span>
            </button>
          </div>
        </header>

        {/* Scrollable View Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 custom-scrollbar">
          
          {/* ---------------------------------------------------- */}
          {/* TAB 1: 3 AI PROVIDERS HUB (OPENROUTER, MAYZAA, XKIRO) */}
          {/* ---------------------------------------------------- */}
          {activeTab === 'providers' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              
              {/* Active Provider Selector Radio Card */}
              <div className="p-5 sm:p-6 rounded-2xl bg-[#0f172a] border border-slate-800 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      <Radio className="w-4 h-4 text-cyan-400" />
                      Pilih Provider AI Utama (Active Response Engine)
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Pilih penyedia mana yang digunakan untuk menghasilkan jawaban percakapan utama.
                    </p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-300 font-mono border border-cyan-500/20">
                    Aktif: {providerConfig.activeProvider.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Option 1: OpenRouter */}
                  <div
                    onClick={() => handleSetActiveProvider('openrouter')}
                    className={`cursor-pointer p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                      providerConfig.activeProvider === 'openrouter'
                        ? 'bg-cyan-950/30 border-cyan-500 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/40'
                        : 'bg-[#131d33] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center font-bold text-xs">
                          OR
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">OpenRouter</h3>
                          <p className="text-[11px] text-slate-400">Multi-Model Gateway</p>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="activeProvider"
                        checked={providerConfig.activeProvider === 'openrouter'}
                        onChange={() => handleSetActiveProvider('openrouter')}
                        className="accent-cyan-500 w-4 h-4 cursor-pointer"
                      />
                    </div>
                    <div className="text-[11px] text-slate-400 space-y-1">
                      <div className="flex items-center justify-between">
                        <span>Status Kunci:</span>
                        <span className={providerConfig.openRouterKeyPresent ? 'text-emerald-400 font-medium' : 'text-amber-400'}>
                          {providerConfig.openRouterKeyPresent ? 'Tersedia' : 'Belum Diisi'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Endpoint:</span>
                        <span className="font-mono text-slate-300">/api/openr</span>
                      </div>
                    </div>
                  </div>

                  {/* Option 2: Mayzaa API */}
                  <div
                    onClick={() => handleSetActiveProvider('mayzaa')}
                    className={`cursor-pointer p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                      providerConfig.activeProvider === 'mayzaa'
                        ? 'bg-emerald-950/30 border-emerald-500 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/40'
                        : 'bg-[#131d33] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold text-xs">
                          MZ
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">Mayzaa API</h3>
                          <p className="text-[11px] text-emerald-400">Free ChatGPT Direct</p>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="activeProvider"
                        checked={providerConfig.activeProvider === 'mayzaa'}
                        onChange={() => handleSetActiveProvider('mayzaa')}
                        className="accent-emerald-500 w-4 h-4 cursor-pointer"
                      />
                    </div>
                    <div className="text-[11px] text-slate-400 space-y-1">
                      <div className="flex items-center justify-between">
                        <span>Biaya:</span>
                        <span className="text-emerald-400 font-medium">Gratis (No Key Needed)</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Endpoint:</span>
                        <span className="font-mono text-slate-300">/api/ai/chat-gpt</span>
                      </div>
                    </div>
                  </div>

                  {/* Option 3: Xkiro.com */}
                  <div
                    onClick={() => handleSetActiveProvider('xkiro')}
                    className={`cursor-pointer p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                      providerConfig.activeProvider === 'xkiro'
                        ? 'bg-indigo-950/30 border-indigo-500 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/40'
                        : 'bg-[#131d33] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center font-bold text-xs">
                          XK
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">Xkiro.com</h3>
                          <p className="text-[11px] text-indigo-300">OpenAI-Compatible AI Gateway</p>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="activeProvider"
                        checked={providerConfig.activeProvider === 'xkiro'}
                        onChange={() => handleSetActiveProvider('xkiro')}
                        className="accent-indigo-500 w-4 h-4 cursor-pointer"
                      />
                    </div>
                    <div className="text-[11px] text-slate-400 space-y-1">
                      <div className="flex items-center justify-between">
                        <span>Base URL:</span>
                        <span className="font-mono text-slate-300 truncate max-w-[120px]">api.xkiro.com</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Endpoint:</span>
                        <span className="font-mono text-slate-300">/api/xkiro</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* 3 Provider Configuration Accordions / Detailed Panels */}
              <div className="space-y-6">

                {/* 1. OpenRouter Provider Settings */}
                <div className="p-5 sm:p-6 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center font-bold text-xs">
                        1
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">Sistem 1: OpenRouter API Engine</h3>
                        <p className="text-xs text-slate-400">
                          Akses ke Claude 3.5, GPT-4o, DeepSeek R1, Llama 3.3 melalui openrouter.ai
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleTestProvider('openrouter')}
                      disabled={testingProvider === 'openrouter'}
                      className="py-1.5 px-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 border border-cyan-500/30"
                    >
                      {testingProvider === 'openrouter' ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Zap className="w-3.5 h-3.5" />
                      )}
                      <span>Test Koneksi OpenRouter</span>
                    </button>
                  </div>

                  {testResults.openrouter && (
                    <div
                      className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                        testResults.openrouter.success
                          ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-950/40 border border-rose-500/30 text-rose-300'
                      }`}
                    >
                      {testResults.openrouter.success ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      )}
                      <span>{testResults.openrouter.message}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                        <span>OpenRouter API Key</span>
                        {providerConfig.openRouterKeyPresent && (
                          <span className="text-[10px] text-emerald-400 font-mono">
                            Tersimpan: {providerConfig.openRouterKeyMasked}
                          </span>
                        )}
                      </label>
                      <input
                        type="password"
                        value={providerConfig.openRouterKey}
                        onChange={(e) => setProviderConfig({ ...providerConfig, openRouterKey: e.target.value })}
                        placeholder={providerConfig.openRouterKeyPresent ? 'Kunci tersimpan. Ketik kunci baru untuk mengganti' : 'sk-or-v1-...'}
                        className="w-full bg-[#080c14] border border-slate-700/60 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Model Aktif OpenRouter</label>
                      <select
                        value={providerConfig.activeModel}
                        onChange={(e) => setProviderConfig({ ...providerConfig, activeModel: e.target.value })}
                        className="w-full bg-[#080c14] border border-slate-700/60 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                      >
                        <option value="openai/gpt-4o-mini">GPT-4o Mini (OpenAI) - Rekomendasi Cepat</option>
                        <option value="openai/gpt-4o">GPT-4o (OpenAI) - Versi Lengkap</option>
                        <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet (Anthropic)</option>
                        <option value="deepseek/deepseek-chat">DeepSeek V3 (DeepSeek)</option>
                        <option value="deepseek/deepseek-r1">DeepSeek R1 Reasoning (DeepSeek)</option>
                        <option value="google/gemini-2.0-flash-001">Gemini 2.0 Flash (Google)</option>
                        <option value="meta-llama/llama-3.3-70b-instruct">Llama 3.3 70B Instruct (Meta)</option>
                        <option value="mistralai/mistral-large-2411">Mistral Large (Mistral AI)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. Mayzaa API Provider Settings */}
                <div className="p-5 sm:p-6 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold text-xs">
                        2
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">Sistem 2: Mayzaa API ChatGPT Endpoint</h3>
                        <p className="text-xs text-slate-400">
                          Endpoint API ChatGPT publik tanpa API key (https://api.mayzaa.my.id)
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleTestProvider('mayzaa')}
                      disabled={testingProvider === 'mayzaa'}
                      className="py-1.5 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 border border-emerald-500/30"
                    >
                      {testingProvider === 'mayzaa' ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Zap className="w-3.5 h-3.5" />
                      )}
                      <span>Test Koneksi Mayzaa API</span>
                    </button>
                  </div>

                  {testResults.mayzaa && (
                    <div
                      className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                        testResults.mayzaa.success
                          ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-950/40 border border-rose-500/30 text-rose-300'
                      }`}
                    >
                      {testResults.mayzaa.success ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      )}
                      <span>{testResults.mayzaa.message}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Target Endpoint URL</label>
                    <input
                      type="text"
                      value={providerConfig.mayzaaUrl}
                      onChange={(e) => setProviderConfig({ ...providerConfig, mayzaaUrl: e.target.value })}
                      placeholder="https://api.mayzaa.my.id/api/ai/chat-gpt?text="
                      className="w-full bg-[#080c14] border border-slate-700/60 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>

                {/* 3. Xkiro.com Provider Settings */}
                <div className="p-5 sm:p-6 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center font-bold text-xs">
                        3
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">Sistem 3: Xkiro.com AI Gateway</h3>
                        <p className="text-xs text-slate-400">
                          Integrasi endpoint OpenAI-compatible oleh Xkiro (https://api.xkiro.com/v1)
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleTestProvider('xkiro')}
                      disabled={testingProvider === 'xkiro'}
                      className="py-1.5 px-3 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 border border-indigo-500/30"
                    >
                      {testingProvider === 'xkiro' ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Zap className="w-3.5 h-3.5" />
                      )}
                      <span>Test Koneksi Xkiro</span>
                    </button>
                  </div>

                  {testResults.xkiro && (
                    <div
                      className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                        testResults.xkiro.success
                          ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-950/40 border border-rose-500/30 text-rose-300'
                      }`}
                    >
                      {testResults.xkiro.success ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      )}
                      <span>{testResults.xkiro.message}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Xkiro Base URL</label>
                      <input
                        type="text"
                        value={providerConfig.xkiroBaseUrl}
                        onChange={(e) => setProviderConfig({ ...providerConfig, xkiroBaseUrl: e.target.value })}
                        placeholder="https://api.xkiro.com/v1"
                        className="w-full bg-[#080c14] border border-slate-700/60 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                        <span>Xkiro API Key</span>
                        {providerConfig.xkiroKeyPresent && (
                          <span className="text-[10px] text-emerald-400 font-mono">
                            {providerConfig.xkiroKeyMasked}
                          </span>
                        )}
                      </label>
                      <input
                        type="password"
                        value={providerConfig.xkiroKey}
                        onChange={(e) => setProviderConfig({ ...providerConfig, xkiroKey: e.target.value })}
                        placeholder={providerConfig.xkiroKeyPresent ? 'Kunci tersimpan' : 'Bearer Key (opsional)'}
                        className="w-full bg-[#080c14] border border-slate-700/60 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Xkiro Target Model</label>
                      <input
                        type="text"
                        value={providerConfig.xkiroModel}
                        onChange={(e) => setProviderConfig({ ...providerConfig, xkiroModel: e.target.value })}
                        placeholder="openai/gpt-4o-mini"
                        className="w-full bg-[#080c14] border border-slate-700/60 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* TAB 2: OVERVIEW & TELEMETRY                          */}
          {/* ---------------------------------------------------- */}
          {activeTab === 'telemetry' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              {/* Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-[#0f172a] border border-slate-800">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span>System Health</span>
                    <Activity className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-xl font-bold text-emerald-400">{telemetry.health}</div>
                  <div className="text-[11px] text-slate-400 mt-1">Provider: {providerConfig.activeProvider}</div>
                </div>

                <div className="p-4 rounded-2xl bg-[#0f172a] border border-slate-800">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span>Average Latency</span>
                    <Clock className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-xl font-bold text-white">{telemetry.latency} ms</div>
                  <div className="text-[11px] text-cyan-400 mt-1">Real-time benchmark</div>
                </div>

                <div className="p-4 rounded-2xl bg-[#0f172a] border border-slate-800">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span>Total Tokens Processed</span>
                    <Zap className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-xl font-bold text-white">{telemetry.tokens.total.toLocaleString()}</div>
                  <div className="text-[11px] text-slate-400 mt-1">In: {telemetry.tokens.input} | Out: {telemetry.tokens.output}</div>
                </div>

                <div className="p-4 rounded-2xl bg-[#0f172a] border border-slate-800">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span>Total Requests</span>
                    <Globe className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="text-xl font-bold text-white">{telemetry.sessions.totalRequests}</div>
                  <div className="text-[11px] text-emerald-400 mt-1">{telemetry.errors.successCount} sukses</div>
                </div>
              </div>

              {/* Latency History */}
              <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-white">Latency Performance History</h3>
                <div className="h-28 flex items-end gap-2 pt-4">
                  {telemetry.recentLatencyHistory.map((lat, idx) => {
                    const heightPercent = Math.min(100, Math.max(15, (lat / 300) * 100));
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className="w-full rounded-t-lg bg-cyan-500/30 group-hover:bg-cyan-400 transition-all"
                        ></div>
                        <span className="text-[10px] font-mono text-slate-400">{lat}ms</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* TAB 3: MODEL CATALOG                                 */}
          {/* ---------------------------------------------------- */}
          {activeTab === 'models' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                    placeholder="Cari model AI..."
                    className="w-full bg-[#0f172a] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
                  {['ALL', 'OpenAI', 'Anthropic', 'DeepSeek', 'Google', 'Mayzaa AI', 'Xkiro.com'].map((prov) => (
                    <button
                      key={prov}
                      onClick={() => setProviderFilter(prov)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                        providerFilter === prov
                          ? 'bg-cyan-600 text-white font-semibold'
                          : 'bg-[#0f172a] text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {prov}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredModels.map((m) => {
                  const isSelected = providerConfig.activeModel === m.id;
                  return (
                    <div
                      key={m.id}
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                        isSelected
                          ? 'bg-cyan-950/20 border-cyan-500 shadow-md shadow-cyan-500/10'
                          : 'bg-[#0f172a] border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            {m.provider}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] font-bold text-cyan-400 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Aktif
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-white">{m.name}</h4>
                        <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">{m.id}</p>
                        <p className="text-xs text-slate-400 mt-2 line-clamp-2">{m.description}</p>
                      </div>

                      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-mono">
                          {((m.context_length || 128000) / 1000).toFixed(0)}k Context
                        </span>
                        <button
                          onClick={() => {
                            setProviderConfig({ ...providerConfig, activeModel: m.id });
                            onShowToast({ type: 'success', title: 'Model Dipilih', message: m.name });
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                            isSelected
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                          }`}
                        >
                          {isSelected ? 'Terpilih' : 'Gunakan Model'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* TAB 4: INTERACTIVE PLAYGROUND                        */}
          {/* ---------------------------------------------------- */}
          {activeTab === 'preview' && (
            <div className="max-w-5xl mx-auto h-[600px] flex flex-col rounded-2xl bg-[#0f172a] border border-slate-800 overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-slate-800 bg-[#121b30] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <PlayCircle className="w-5 h-5 text-cyan-400" />
                  <div>
                    <h3 className="text-sm font-bold text-white">Live AI Test Playground</h3>
                    <p className="text-[11px] text-slate-400">Uji langsung streaming respon dari 3 provider</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Engine:</span>
                  <select
                    value={previewProvider}
                    onChange={(e: any) => setPreviewProvider(e.target.value)}
                    className="bg-[#090d16] border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-cyan-300 font-medium focus:outline-none"
                  >
                    <option value="openrouter">OpenRouter API</option>
                    <option value="mayzaa">Mayzaa API (ChatGPT)</option>
                    <option value="xkiro">Xkiro.com</option>
                  </select>
                </div>
              </div>

              {/* Chat Stream Area */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 custom-scrollbar">
                {previewMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div className="text-[10px] text-slate-400 mb-1 px-1 flex items-center gap-1.5">
                      <span>{msg.role === 'user' ? 'Tester' : msg.provider || 'AI Gateway'}</span>
                      <span>•</span>
                      <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div
                      className={`max-w-[85%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-cyan-600 text-white rounded-br-none'
                          : 'bg-[#141f38] text-slate-200 border border-slate-700/60 rounded-bl-none'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {previewGenerating && (
                  <div className="flex items-center gap-2 text-xs text-cyan-400 p-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghubungi AI provider...</span>
                  </div>
                )}
              </div>

              {/* Input Box */}
              <div className="p-3 bg-[#0d1424] border-t border-slate-800 flex items-center gap-2">
                <input
                  type="text"
                  value={previewInput}
                  onChange={(e) => setPreviewInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendPreview()}
                  placeholder="Ketik pertanyaan untuk menguji respon..."
                  className="flex-1 bg-[#080c14] border border-slate-700/60 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={handleSendPreview}
                  disabled={previewGenerating || !previewInput.trim()}
                  className="p-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-40 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* TAB 5: API ENDPOINTS & DOCS                          */}
          {/* ---------------------------------------------------- */}
          {activeTab === 'apidocs' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Code className="w-4 h-4 text-cyan-400" />
                  Daftar 3 Sistem Endpoint API Siap Pakai
                </h3>
                <p className="text-xs text-slate-400">
                  Endpoint ini dapat diakses langsung menggunakan GET (URL Browser) atau POST (JSON payload).
                </p>
              </div>

              {/* System 1 Endpoint */}
              <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-400 uppercase">Sistem 1: OpenRouter API</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300">GET & POST</span>
                </div>
                <div className="p-3 rounded-xl bg-[#080c14] border border-slate-800 flex items-center justify-between gap-2 font-mono text-xs text-slate-300 overflow-x-auto">
                  <code>GET /api/openr?text=Halo&model=openai/gpt-4o-mini</code>
                  <button
                    onClick={() => handleCopyText('/api/openr?text=Halo&model=openai/gpt-4o-mini', 'ep1')}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white shrink-0"
                  >
                    {copiedKey === 'ep1' ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* System 2 Endpoint */}
              <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 uppercase">Sistem 2: Mayzaa API ChatGPT</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300">GET (Free)</span>
                </div>
                <div className="p-3 rounded-xl bg-[#080c14] border border-slate-800 flex items-center justify-between gap-2 font-mono text-xs text-slate-300 overflow-x-auto">
                  <code>GET /api/ai/chat-gpt?text=Halo+Mayzaa</code>
                  <button
                    onClick={() => handleCopyText('/api/ai/chat-gpt?text=Halo+Mayzaa', 'ep2')}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white shrink-0"
                  >
                    {copiedKey === 'ep2' ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* System 3 Endpoint */}
              <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-400 uppercase">Sistem 3: Xkiro.com Gateway</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300">GET & POST</span>
                </div>
                <div className="p-3 rounded-xl bg-[#080c14] border border-slate-800 flex items-center justify-between gap-2 font-mono text-xs text-slate-300 overflow-x-auto">
                  <code>GET /api/xkiro?text=Halo+Xkiro</code>
                  <button
                    onClick={() => handleCopyText('/api/xkiro?text=Halo+Xkiro', 'ep3')}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white shrink-0"
                  >
                    {copiedKey === 'ep3' ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Universal Master Chat Endpoint */}
              <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 uppercase">Master Chatbot (Auto-Routed to Active Provider)</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300">GET & POST (Stream)</span>
                </div>
                <div className="p-3 rounded-xl bg-[#080c14] border border-slate-800 flex items-center justify-between gap-2 font-mono text-xs text-slate-300 overflow-x-auto">
                  <code>POST /api/chat {"{ \"messages\": [...], \"stream\": true }"}</code>
                  <button
                    onClick={() => handleCopyText('/api/chat', 'ep4')}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white shrink-0"
                  >
                    {copiedKey === 'ep4' ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* TAB 6: HYPERPARAMETERS & SYSTEM PROMPT               */}
          {/* ---------------------------------------------------- */}
          {activeTab === 'controls' && (
            <div className="space-y-6 max-w-5xl mx-auto">
              <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-white">System Prompt AI</h3>
                <textarea
                  rows={4}
                  value={settings.systemPrompt}
                  onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
                  placeholder="Definisikan kepribadian dan instruksi utama AI..."
                  className="w-full bg-[#080c14] border border-slate-700/60 rounded-xl p-3.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">Temperature</span>
                    <span className="font-mono text-cyan-400">{settings.temperature}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={settings.temperature}
                    onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                </div>

                <div className="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">Max Tokens</span>
                    <span className="font-mono text-cyan-400">{settings.maxTokens}</span>
                  </div>
                  <input
                    type="range"
                    min="256"
                    max="8192"
                    step="256"
                    value={settings.maxTokens}
                    onChange={(e) => setSettings({ ...settings, maxTokens: parseInt(e.target.value) })}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                </div>

                <div className="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">Top-P Sampling</span>
                    <span className="font-mono text-cyan-400">{settings.topP}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={settings.topP}
                    onChange={(e) => setSettings({ ...settings, topP: parseFloat(e.target.value) })}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* TAB 7: LOGS & DIAGNOSTICS                            */}
          {/* ---------------------------------------------------- */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-4 max-w-6xl mx-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {['ALL', 'SUCCESS', 'ERROR'].map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setLogFilter(filter as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        logFilter === filter
                          ? 'bg-cyan-600 text-white'
                          : 'bg-[#0f172a] text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleClearLogs}
                  className="py-1.5 px-3 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-medium border border-rose-500/30 flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Bersihkan Log</span>
                </button>
              </div>

              <div className="rounded-2xl bg-[#0f172a] border border-slate-800 overflow-hidden">
                <div className="divide-y divide-slate-800/80">
                  {filteredLogs.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">Belum ada riwayat log.</div>
                  ) : (
                    filteredLogs.map((log) => (
                      <div key={log.id} className="p-3.5 flex items-center justify-between gap-4 text-xs">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <span
                            className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                              log.statusCode < 400
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {log.statusCode}
                          </span>
                          <span className="font-mono text-slate-400 uppercase text-[10px] px-1.5 py-0.5 rounded bg-slate-800">
                            {log.provider}
                          </span>
                          <span className="text-white truncate max-w-xs">{log.promptSnippet || log.endpoint}</span>
                        </div>

                        <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px] shrink-0">
                          <span>{log.latencyMs}ms</span>
                          <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* TAB 8: SECURITY & DEV MODE                           */}
          {/* ---------------------------------------------------- */}
          {activeTab === 'security' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                  <Shield className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h3 className="text-sm font-bold text-white">Status Akses Developer</h3>
                    <p className="text-xs text-slate-400">Akun dev@lynxie.ai memiliki izin bypass password penuh</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#080c14] border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Akun Developer:</span>
                    <span className="font-mono text-emerald-400 font-bold">dev@lynxie.ai</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Bypass Password:</span>
                    <span className="text-emerald-400">Aktif (Tanpa Password di /openr)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Keamanan Server:</span>
                    <span className="text-slate-200">Rate Limiter & Session Token Protected</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

    </div>
  );
};
