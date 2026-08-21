import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { ThreeBackground } from './components/ThreeBackground';
import { SettingsModal } from './components/SettingsModal';
import { ToastContainer } from './components/Toast';
import { AdminPanel } from './components/AdminPanel';
import { LoadingScreen } from './components/LoadingScreen';
import { AuthModal } from './components/AuthModal';
import {
  auth,
  onAuthStateChanged,
  logoutFirebase,
  syncConversationsToCloud,
  loadCloudConversations,
  AppUser,
} from './lib/firebase';
import { executeClientChatFallback } from './lib/clientAi';
import { ttsEngine } from './lib/voiceAi';
import { Conversation, ChatMessage as ChatMessageType, ToastMessage, UserPreferences } from './types';
import { Sparkles, Bot } from 'lucide-react';

const STORAGE_KEY_CHATS = 'lynxiee_ai_chats_v1';
const STORAGE_KEY_PREFS = 'lynxiee_ai_prefs_v1';
const STORAGE_KEY_USER = 'lynxiee_ai_user_v1';
const SESSION_KEY_SPLASH = 'lynxiee_splash_done_v1';

const DEFAULT_PREFERENCES: UserPreferences = {
  userName: 'Explorer',
  theme: 'dark',
  fontSize: 'base',
  streamResponse: true,
  typewriterSpeed: 10,
  autoSpeakAi: false,
  voiceLanguage: 'id-ID',
  soundEffects: true,
  show3DBackground: true,
};

export default function App() {
  // Single initial splash screen flag (Strictly ONCE per session lifecycle)
  const [hasCompletedInitialSplash, setHasCompletedInitialSplash] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(SESSION_KEY_SPLASH) === 'true';
    }
    return false;
  });

  // Authentication State
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try {
      const savedUser = localStorage.getItem(STORAGE_KEY_USER);
      if (savedUser) return JSON.parse(savedUser);
    } catch {
      // ignore
    }
    return null;
  });

  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Navigation state (Detects /openr or hash #openr)
  const [currentRoute, setCurrentRoute] = useState<'chat' | 'admin'>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      if (path.includes('/openr') || hash === '#openr') {
        return 'admin';
      }
    }
    return 'chat';
  });

  // Conversations state with robust localStorage recovery
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CHATS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load local conversations:', e);
    }
    const initialId = `chat_${Date.now()}`;
    return [
      {
        id: initialId,
        title: 'New Conversation',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
      },
    ];
  });

  const [activeConversationId, setActiveConversationId] = useState<string>(() => {
    return conversations[0]?.id || `chat_${Date.now()}`;
  });

  // Preferences
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFS);
      if (saved) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_PREFERENCES;
  });

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentModel, setCurrentModel] = useState('GPT-4o Mini');
  const [isOnline, setIsOnline] = useState(true);

  // Active abort controller for stream cancellation
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Mark initial splash screen as completed
  useEffect(() => {
    if (!hasCompletedInitialSplash) {
      const timer = setTimeout(() => {
        setHasCompletedInitialSplash(true);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(SESSION_KEY_SPLASH, 'true');
        }
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [hasCompletedInitialSplash]);

  // Set theme class on body
  useEffect(() => {
    document.body.className = `theme-${preferences.theme || 'dark'}`;
  }, [preferences.theme]);

  // Firebase Auth State Listener (Seamless, non-blocking)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const email = firebaseUser.email || '';
        const name = firebaseUser.displayName || email.split('@')[0] || 'User';
        const isDev = email === 'dev@lynxie.ai';
        const userObj: AppUser = {
          uid: firebaseUser.uid,
          name,
          email,
          createdAt: firebaseUser.metadata.creationTime
            ? new Date(firebaseUser.metadata.creationTime).getTime()
            : Date.now(),
          lastLogin: Date.now(),
          isDev,
        };

        setCurrentUser(userObj);
        try {
          localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(userObj));
          if (isDev) {
            localStorage.setItem('lynxiee_dev_auth', 'true');
          }
        } catch {
          // ignore
        }

        // Sync with Cloud RTDB conversations
        try {
          const cloudChats = await loadCloudConversations(firebaseUser.uid);
          if (cloudChats && cloudChats.length > 0) {
            setConversations(cloudChats);
            if (cloudChats[0]?.id) {
              setActiveConversationId(cloudChats[0].id);
            }
          }
        } catch {}
      } else {
        const isDevLocal = localStorage.getItem('lynxiee_dev_auth') === 'true';
        if (!isDevLocal) {
          setCurrentUser(null);
          try {
            localStorage.removeItem(STORAGE_KEY_USER);
          } catch {}
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Sync route with URL history & hash
  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname.toLowerCase().includes('/openr') || window.location.hash.toLowerCase() === '#openr') {
        setCurrentRoute('admin');
      } else {
        setCurrentRoute('chat');
      }
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  const navigateTo = (route: 'chat' | 'admin') => {
    setCurrentRoute(route);
    const newPath = route === 'admin' ? '/openr' : '/';
    window.history.pushState({}, '', newPath);
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await logoutFirebase();
      localStorage.removeItem('lynxiee_dev_auth');
      localStorage.removeItem(STORAGE_KEY_USER);
      setCurrentUser(null);
      showToast({
        type: 'info',
        title: 'Logout Berhasil',
        message: 'Anda telah keluar dari sesi akun.',
      });
    } catch (err: any) {
      console.error('Logout error:', err);
      showToast({
        type: 'error',
        title: 'Gagal Logout',
        message: err.message || 'Terjadi kesalahan saat logout.',
      });
    }
  };

  // Save conversations to localStorage and Cloud RTDB
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(conversations));
    } catch (err) {
      console.error('Storage error:', err);
    }

    if (currentUser?.uid) {
      syncConversationsToCloud(currentUser.uid, conversations);
    }
  }, [conversations, currentUser?.uid]);

  // Save preferences
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(preferences));
    } catch (err) {
      console.error('Prefs storage error:', err);
    }
  }, [preferences]);

  // Fetch current model
  useEffect(() => {
    const fetchCurrentModel = async () => {
      try {
        const res = await fetch('/api/models/current');
        if (res.ok) {
          const data = await res.json();
          setCurrentModel(data.activeModel || 'GPT-4o Mini');
        }
      } catch {
        setCurrentModel('GPT-4o Mini');
      }
    };
    fetchCurrentModel();
    const interval = setInterval(fetchCurrentModel, 30000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || conversations[0];

  useEffect(() => {
    scrollToBottom();
  }, [activeConversation?.messages?.length, isGenerating]);

  // Toast Helper
  const showToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    setToasts((prev) => [...prev, { id, ...toast }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Conversation Management Handlers
  const handleNewChat = () => {
    const newId = `chat_${Date.now()}`;
    const newConv: Conversation = {
      id: newId,
      title: 'New Conversation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveConversationId(newId);
  };

  const handleDeleteConversation = (id: string) => {
    setConversations((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      if (filtered.length === 0) {
        const freshId = `chat_${Date.now()}`;
        return [
          {
            id: freshId,
            title: 'New Conversation',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: [],
          },
        ];
      }
      return filtered;
    });

    if (activeConversationId === id) {
      const remaining = conversations.filter((c) => c.id !== id);
      if (remaining.length > 0) {
        setActiveConversationId(remaining[0].id);
      }
    }
    showToast({ type: 'info', message: 'Percakapan berhasil dihapus.' });
  };

  const handleRenameConversation = (id: string, newTitle: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: newTitle, updatedAt: Date.now() } : c))
    );
  };

  const handlePinConversation = (id: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c))
    );
  };

  const handleClearAllChats = () => {
    const freshId = `chat_${Date.now()}`;
    setConversations([
      {
        id: freshId,
        title: 'New Conversation',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
      },
    ]);
    setActiveConversationId(freshId);
    showToast({ type: 'info', message: 'Semua riwayat percakapan telah dibersihkan.' });
  };

  // Direct Live Stream Response Engine
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isGenerating) return;

    const userMessageId = `msg_user_${Date.now()}`;
    const assistantMessageId = `msg_ai_${Date.now()}`;

    const userMsg: ChatMessageType = {
      id: userMessageId,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const currentMessages = activeConversation?.messages || [];
    const updatedMessages = [...currentMessages, userMsg];

    // Auto-update conversation title if it's the first message
    let updatedTitle = activeConversation.title;
    if (currentMessages.length === 0 || activeConversation.title === 'New Conversation') {
      updatedTitle = text.slice(0, 32) + (text.length > 32 ? '...' : '');
    }

    // Add placeholder for assistant response
    const assistantMsgPlaceholder: ChatMessageType = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      model: currentModel,
      isStreaming: true,
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversation.id
          ? {
              ...c,
              title: updatedTitle,
              updatedAt: Date.now(),
              messages: [...updatedMessages, assistantMsgPlaceholder],
            }
          : c
      )
    );

    setIsGenerating(true);
    const startTime = Date.now();

    const payloadMessages = updatedMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const updateLiveChunk = (accumulatedText: string) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversation.id
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, content: accumulatedText, isStreaming: true }
                    : m
                ),
              }
            : c
        )
      );
    };

    try {
      const result = await executeClientChatFallback(payloadMessages, {
        model: currentModel,
        apiKey: preferences.clientApiKey,
        onChunk: updateLiveChunk,
      });

      const latency = Date.now() - startTime;

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversation.id
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === assistantMessageId
                    ? {
                        ...m,
                        content: result.text,
                        isStreaming: false,
                        responseTimeMs: latency,
                        model: result.model || currentModel,
                      }
                    : m
                ),
              }
            : c
        )
      );

      // If Auto-Speak AI is enabled, speak the answer aloud
      if (preferences.autoSpeakAi && result.text) {
        ttsEngine.speak(result.text, assistantMessageId, {
          lang: preferences.voiceLanguage || 'id-ID',
        });
      }
    } catch (err: any) {
      console.error('[App] Generation Error:', err);
      const errorMsg = err?.message || 'Gagal memproses respons dari model AI.';
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversation.id
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === assistantMessageId
                    ? {
                        ...m,
                        isStreaming: false,
                        error: true,
                        content: `**Kendala Layanan:** ${errorMsg}\n\nSilakan periksa koneksi atau ulangi pertanyaan Anda.`,
                      }
                    : m
                ),
              }
            : c
        )
      );
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsGenerating(false);
  };

  const handleRegenerate = () => {
    const msgs = activeConversation?.messages || [];
    if (msgs.length === 0 || isGenerating) return;

    const lastUserIndex = msgs.map((m) => m.role).lastIndexOf('user');
    if (lastUserIndex === -1) return;

    const lastUserMessage = msgs[lastUserIndex];
    const truncated = msgs.slice(0, lastUserIndex);

    setConversations((prev) =>
      prev.map((c) => (c.id === activeConversation.id ? { ...c, messages: truncated } : c))
    );

    handleSendMessage(lastUserMessage.content);
  };

  // Edit User Message & Resubmit / Repeat Answer
  const handleEditAndResubmit = (messageId: string, newText: string) => {
    const msgs = activeConversation?.messages || [];
    const targetIdx = msgs.findIndex((m) => m.id === messageId);
    if (targetIdx === -1 || isGenerating) return;

    // Truncate all messages starting from this user message
    const truncated = msgs.slice(0, targetIdx);

    setConversations((prev) =>
      prev.map((c) => (c.id === activeConversation.id ? { ...c, messages: truncated } : c))
    );

    // Send the updated prompt
    handleSendMessage(newText);
  };

  // 1. Initial Splash Screen (Very brief once)
  if (!hasCompletedInitialSplash) {
    return <LoadingScreen statusMessage="Memuat LYNXIEE Intelligence Gateway..." />;
  }

  // 2. Admin Panel (/openr) Route
  if (currentRoute === 'admin') {
    return (
      <div className="relative min-h-[100dvh] bg-[#07080c]">
        <ThreeBackground enabled={preferences.show3DBackground} />
        <AdminPanel onBackToChat={() => navigateTo('chat')} onShowToast={showToast} />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  // ------------------------------------------
  // MAIN APPLICATION VIEW (Accessible to all)
  // ------------------------------------------
  return (
    <div className="relative min-h-[100dvh] h-[100dvh] flex flex-col bg-[#07080c] text-white overflow-hidden font-sans select-text">
      {/* Dynamic Obsidian Star Field Background */}
      <ThreeBackground enabled={preferences.show3DBackground} />

      {/* Top Navbar */}
      <Navbar
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onNewChat={handleNewChat}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenAuth={() => setAuthModalOpen(true)}
        onNavigateToAdmin={() => navigateTo('admin')}
        currentModel={currentModel}
        isOnline={isOnline}
        currentUser={currentUser}
        onLogout={handleLogout}
        autoSpeakAi={preferences.autoSpeakAi}
        onToggleAutoSpeak={() =>
          setPreferences((prev) => ({ ...prev, autoSpeakAi: !prev.autoSpeakAi }))
        }
      />

      {/* Main Viewport Container */}
      <div className="flex-1 flex overflow-hidden relative z-10 min-h-0">
        {/* Sidebar */}
        <Sidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={(id) => setActiveConversationId(id)}
          onNewChat={handleNewChat}
          onDeleteConversation={handleDeleteConversation}
          onRenameConversation={handleRenameConversation}
          onPinConversation={handlePinConversation}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenAuth={() => setAuthModalOpen(true)}
          onNavigateToAdmin={() => navigateTo('admin')}
          isOpen={sidebarOpen}
          onCloseMobile={() => setSidebarOpen(false)}
          theme={preferences.theme}
          onToggleTheme={() =>
            setPreferences((prev) => ({
              ...prev,
              theme: prev.theme === 'dark' ? 'slate' : prev.theme === 'slate' ? 'light' : 'dark',
            }))
          }
          currentUser={currentUser}
          onLogout={handleLogout}
        />

        {/* Chat Area Content - Full responsive edge-to-edge coverage */}
        <main className="flex-1 flex flex-col min-w-0 lg:pl-72 h-full relative">
          {/* Chat Messages Viewport */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
            {activeConversation.messages.length === 0 ? (
              /* Obsidian Center Welcome Box */
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-xl mx-auto my-auto animate-in fade-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-2xl bg-[#0f121a] border border-white/15 flex items-center justify-center mb-4 shadow-2xl">
                  <Bot className="w-8 h-8 text-slate-200" />
                </div>

                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  LYNXIEE MARKET AI
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-md leading-relaxed">
                  Asisten kecerdasan buatan cerdas dengan sistem Voice AI, pengetikan real-time, dan arsitektur liquid glassmorphism.
                </p>
              </div>
            ) : (
              /* Message List */
              <div className="flex-1 py-3 sm:py-4">
                {activeConversation.messages.map((msg, index) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    isLast={index === activeConversation.messages.length - 1}
                    onRegenerate={handleRegenerate}
                    onEditAndResubmit={handleEditAndResubmit}
                    typewriterSpeed={preferences.typewriterSpeed}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Bar */}
          <ChatInput
            onSendMessage={handleSendMessage}
            onStopGeneration={handleStopGeneration}
            isGenerating={isGenerating}
            onSelectPrompt={(p) => handleSendMessage(p)}
            showSuggestions={activeConversation.messages.length === 0}
            autoSpeakAi={preferences.autoSpeakAi}
            onToggleAutoSpeak={() =>
              setPreferences((prev) => ({ ...prev, autoSpeakAi: !prev.autoSpeakAi }))
            }
          />
        </main>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        preferences={preferences}
        onUpdatePreferences={(partial) => setPreferences((prev) => ({ ...prev, ...partial }))}
        onClearAllChats={handleClearAllChats}
        onOpenAdmin={() => navigateTo('admin')}
        currentModel={currentModel}
        currentUser={currentUser}
      />

      {/* Auth Modal (Triggered on demand, non-blocking) */}
      {authModalOpen && (
        <AuthModal
          onSuccess={(user) => {
            setCurrentUser(user);
            setAuthModalOpen(false);
          }}
          onClose={() => setAuthModalOpen(false)}
          onShowToast={showToast}
        />
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
