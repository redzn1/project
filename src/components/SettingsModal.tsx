import React, { useState } from 'react';
import {
  X,
  Moon,
  Sun,
  Trash2,
  Sparkles,
  User,
  Key,
  Sliders,
  Eye,
  EyeOff,
  Terminal,
  Volume2,
  Activity,
  Type,
} from 'lucide-react';
import { UserPreferences, AuthUser } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: UserPreferences;
  onUpdatePreferences: (partial: Partial<UserPreferences>) => void;
  onClearAllChats: () => void;
  onOpenAdmin: () => void;
  currentModel: string;
  currentUser?: AuthUser | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  preferences,
  onUpdatePreferences,
  onClearAllChats,
  onOpenAdmin,
  currentUser,
}) => {
  const [showApiKey, setShowApiKey] = useState(false);

  if (!isOpen) return null;

  const isDevUser = Boolean(
    currentUser?.email === 'dev@lynxie.ai' ||
    currentUser?.isDev ||
    (typeof window !== 'undefined' && localStorage.getItem('lynxiee_dev_auth') === 'true')
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#0f121a]/95 border border-white/15 p-5 sm:p-6 rounded-3xl max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto text-white">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5 font-bold text-base">
            <div className="p-1.5 rounded-xl bg-white/10 text-slate-200 border border-white/15">
              <Sparkles className="w-4 h-4" />
            </div>
            <span>Pengaturan & Preferensi AI</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-sm text-slate-200">
          {/* User Profile */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-300" />
              Nama Tampilan
            </label>
            <input
              type="text"
              value={preferences.userName}
              onChange={(e) => onUpdatePreferences({ userName: e.target.value })}
              placeholder="Contoh: Explorer"
              className="w-full bg-[#07080e] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-white/40 transition-all shadow-inner"
            />
          </div>

          {/* Theme Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Moon className="w-3.5 h-3.5 text-slate-300" />
              Tema & Tampilan
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onUpdatePreferences({ theme: 'dark' })}
                className={`p-3 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                  preferences.theme === 'dark'
                    ? 'border-white/40 bg-white/15 text-white shadow-md'
                    : 'border-white/5 bg-[#07080e] text-slate-400 hover:text-white'
                }`}
              >
                <Moon className="w-4 h-4 text-slate-200" />
                <span>Obsidian Dark</span>
              </button>

              <button
                type="button"
                onClick={() => onUpdatePreferences({ theme: 'slate' })}
                className={`p-3 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                  preferences.theme === 'slate'
                    ? 'border-white/40 bg-white/15 text-white shadow-md'
                    : 'border-white/5 bg-[#07080e] text-slate-400 hover:text-white'
                }`}
              >
                <Sliders className="w-4 h-4 text-slate-200" />
                <span>Liquid Slate</span>
              </button>

              <button
                type="button"
                onClick={() => onUpdatePreferences({ theme: 'light' })}
                className={`p-3 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                  preferences.theme === 'light'
                    ? 'border-white/40 bg-white/15 text-white shadow-md'
                    : 'border-white/5 bg-[#07080e] text-slate-400 hover:text-white'
                }`}
              >
                <Sun className="w-4 h-4 text-slate-200" />
                <span>Monochrome Light</span>
              </button>
            </div>
          </div>

          {/* Voice AI & Typewriter Configurations */}
          <div className="space-y-3 pt-2 border-t border-white/10">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-slate-300" />
              Sistem Voice AI & Efek Ketik
            </div>

            {/* Auto Speak AI */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#07080e] border border-white/10">
              <div>
                <div className="font-medium text-xs text-white">Voice AI Auto-Readout</div>
                <div className="text-[11px] text-slate-400">
                  Otomatis membacakan respon jawaban AI menggunakan suara
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.autoSpeakAi || false}
                onChange={(e) => onUpdatePreferences({ autoSpeakAi: e.target.checked })}
                className="w-4 h-4 rounded text-slate-100 bg-[#07080e] border-white/20 accent-slate-300 cursor-pointer"
              />
            </div>

            {/* Voice Language */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#07080e] border border-white/10">
              <div>
                <div className="font-medium text-xs text-white">Bahasa Suara (TTS)</div>
                <div className="text-[11px] text-slate-400">Pilihan bahasa suara pengucapan AI</div>
              </div>
              <select
                value={preferences.voiceLanguage || 'id-ID'}
                onChange={(e) =>
                  onUpdatePreferences({ voiceLanguage: e.target.value as 'id-ID' | 'en-US' })
                }
                className="bg-[#121622] text-xs text-white border border-white/15 rounded-lg px-2.5 py-1 focus:outline-none focus:border-white/40"
              >
                <option value="id-ID">Bahasa Indonesia</option>
                <option value="en-US">English (US)</option>
              </select>
            </div>

            {/* Typewriter Speed */}
            <div className="p-3 rounded-xl bg-[#07080e] border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-medium text-xs text-white">
                  <Type className="w-3.5 h-3.5 text-slate-400" />
                  <span>Kecepatan Mengetik Karakter (ChatGPT Mode)</span>
                </div>
                <span className="text-xs font-mono text-slate-300">
                  {preferences.typewriterSpeed || 10} ms/huruf
                </span>
              </div>
              <input
                type="range"
                min="3"
                max="30"
                step="1"
                value={preferences.typewriterSpeed || 10}
                onChange={(e) =>
                  onUpdatePreferences({ typewriterSpeed: parseInt(e.target.value, 10) })
                }
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>
          </div>

          {/* OpenRouter Direct Key */}
          <div className="space-y-1.5 pt-2 border-t border-white/10">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-slate-300" />
                OpenRouter Key Client (Opsional)
              </span>
              <span className="text-[10px] font-mono text-slate-300 bg-white/10 px-2 py-0.5 rounded-md border border-white/15">
                Direct
              </span>
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={preferences.clientApiKey || ''}
                onChange={(e) => onUpdatePreferences({ clientApiKey: e.target.value })}
                placeholder="sk-or-v1-xxxxxxxxxxxx..."
                className="w-full bg-[#07080e] border border-white/10 rounded-xl pl-3.5 pr-10 py-2.5 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-white/40 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white cursor-pointer"
              >
                {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Action links */}
          <div className="pt-3 border-t border-white/10 space-y-2">
            {isDevUser && (
              <button
                onClick={() => {
                  onClose();
                  onOpenAdmin();
                }}
                className="w-full py-2.5 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 border border-white/20 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Terminal className="w-4 h-4 text-slate-300" />
                <span>Buka Developer Control Panel (/openr)</span>
              </button>
            )}

            <button
              onClick={() => {
                if (window.confirm('Yakin ingin menghapus seluruh riwayat percakapan?')) {
                  onClearAllChats();
                  onClose();
                }
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Semua Riwayat Percakapan</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
