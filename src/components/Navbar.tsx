import React from 'react';
import { Menu, Sparkles, Plus, Settings, LogOut, Terminal, User, Volume2, VolumeX } from 'lucide-react';
import { AuthUser } from '../types';

interface NavbarProps {
  onToggleSidebar: () => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onOpenAuth?: () => void;
  onNavigateToAdmin: () => void;
  currentModel: string;
  isOnline: boolean;
  isAdminActive?: boolean;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
  autoSpeakAi?: boolean;
  onToggleAutoSpeak?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleSidebar,
  onNewChat,
  onOpenSettings,
  onOpenAuth,
  onNavigateToAdmin,
  currentModel,
  isOnline = true,
  currentUser,
  onLogout,
  autoSpeakAi = false,
  onToggleAutoSpeak,
}) => {
  const isDevUser = Boolean(
    currentUser?.email === 'dev@lynxie.ai' ||
    currentUser?.isDev ||
    (typeof window !== 'undefined' && localStorage.getItem('lynxiee_dev_auth') === 'true')
  );

  return (
    <header className="h-14 border-b border-white/10 bg-[#090b10]/90 backdrop-blur-2xl px-3 sm:px-6 flex items-center justify-between z-20 shrink-0">
      {/* Left: Sidebar Toggle & Brand */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors lg:hidden cursor-pointer"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl overflow-hidden bg-[#101420] border border-white/15 flex items-center justify-center p-1 shadow-md">
            <img src="/logo.svg" alt="LYNXIEE MARKET AI" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="font-semibold text-xs sm:text-sm text-white tracking-tight flex items-center gap-2">
              <span>LYNXIEE MARKET AI</span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/10 text-slate-200 border border-white/15">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                ACTIVE
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Center/Right: Active Model indicator & Action Tools */}
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        {/* Model pill */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#101420]/80 border border-white/10 text-xs text-slate-300 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400 text-[11px]">Model:</span>
          <span className="font-medium text-white truncate max-w-[170px]">{currentModel}</span>
        </div>

        {/* Auto-Speak toggle */}
        {onToggleAutoSpeak && (
          <button
            onClick={onToggleAutoSpeak}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              autoSpeakAi
                ? 'bg-slate-200 text-slate-950 border-white font-medium'
                : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
            }`}
            title={autoSpeakAi ? 'Voice AI Auto-Baca: Aktif' : 'Voice AI Auto-Baca: Nonaktif'}
          >
            {autoSpeakAi ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        )}

        {/* New Chat */}
        <button
          onClick={onNewChat}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-white text-slate-950 text-xs font-semibold transition-all shadow-md cursor-pointer"
          title="Percakapan Baru"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Chat</span>
        </button>

        {/* Developer portal shortcut ONLY for dev@lynxie.ai */}
        {isDevUser && (
          <button
            onClick={onNavigateToAdmin}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-slate-200 text-xs font-mono transition-colors cursor-pointer"
            title="Secret Developer Console"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">/openr</span>
          </button>
        )}

        {/* User Profile or Guest Login Button */}
        {currentUser ? (
          <div className="flex items-center gap-2 pl-2 border-l border-white/10">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-white truncate max-w-[120px]">
                {currentUser.name}
              </span>
              <span className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                {currentUser.email}
              </span>
            </div>

            <div
              className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white text-xs font-bold uppercase shrink-0"
              title={`${currentUser.name} (${currentUser.email})`}
            >
              {currentUser.name ? currentUser.name.charAt(0) : 'U'}
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-white/10 transition-colors cursor-pointer"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          onOpenAuth && (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
              title="Masuk Akun"
            >
              <User className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Masuk</span>
            </button>
          )
        )}

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Pengaturan"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
