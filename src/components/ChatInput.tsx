import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Square,
  Sparkles,
  Paperclip,
  CornerDownLeft,
  X,
  Code,
  BookOpen,
  FileText,
  Lightbulb,
  Mic,
  MicOff,
  Volume2,
} from 'lucide-react';
import { sttEngine } from '../lib/voiceAi';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  onStopGeneration?: () => void;
  isGenerating?: boolean;
  disabled?: boolean;
  onSelectPrompt?: (prompt: string) => void;
  showSuggestions?: boolean;
  autoSpeakAi?: boolean;
  onToggleAutoSpeak?: () => void;
}

export const SUGGESTED_PROMPTS = [
  {
    icon: Lightbulb,
    title: 'Jelaskan Konsep & Logika',
    text: 'Jelaskan konsep arsitektur microservices dan distributed system dengan analogi sederhana dan terstruktur.',
  },
  {
    icon: Code,
    title: 'Buatkan Kode & Solusi',
    text: 'Buatkan komponen React TypeScript modern dengan layout responsive Tailwind CSS dan clean code standard.',
  },
  {
    icon: FileText,
    title: 'Ringkas & Analisis Dokumen',
    text: 'Tolong buatkan ringkasan eksekutif, poin strategis, dan rekomendasi aksi dari teks berikut.',
  },
  {
    icon: BookOpen,
    title: 'Bantu Rumus Matematika / Sains',
    text: 'Jelaskan transformasi Fourier dan formulasi LaTeX \\int_{-\\infty}^{\\infty} f(x)e^{-2\\pi i \\xi x} dx secara bertahap.',
  },
];

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onStopGeneration,
  isGenerating = false,
  disabled = false,
  onSelectPrompt,
  showSuggestions = false,
  autoSpeakAi = false,
  onToggleAutoSpeak,
}) => {
  const [input, setInput] = useState('');
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceInterim, setVoiceInterim] = useState('');
  const [micSupported, setMicSupported] = useState(true);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setMicSupported(sttEngine.isSupported());
  }, []);

  // Auto-resize textarea height smoothly
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 220);
    textarea.style.height = `${Math.max(newHeight, 52)}px`;
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isGenerating || disabled) return;
    onSendMessage(trimmed);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '52px';
    }
    if (isListening) {
      sttEngine.stop();
      setIsListening(false);
    }
  };

  const handleQuickTemplate = (templateText: string) => {
    setInput(templateText);
    setShowAttachmentModal(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Toggle Voice Input / Microphone
  const handleToggleMic = () => {
    if (isListening) {
      sttEngine.stop();
      setIsListening(false);
      setVoiceInterim('');
    } else {
      setVoiceInterim('');
      sttEngine.start(
        (transcript, isFinal) => {
          setVoiceInterim(transcript);
          setInput((prev) => {
            if (isFinal) {
              const base = prev.trim() ? `${prev.trim()} ` : '';
              return `${base}${transcript}`;
            }
            return prev;
          });
        },
        (listening, error) => {
          setIsListening(listening);
          if (!listening) {
            setVoiceInterim('');
          }
        },
        'id-ID'
      );
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-2.5 sm:px-6 pb-3 sm:pb-6 relative z-10">
      {/* Suggested prompts on empty conversation */}
      {showSuggestions && (
        <div className="mb-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
          {SUGGESTED_PROMPTS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                onClick={() => {
                  if (onSelectPrompt) onSelectPrompt(item.text);
                  else setInput(item.text);
                }}
                className="group flex items-start gap-3 p-3 sm:p-3.5 rounded-2xl text-left bg-[#0f121a]/80 hover:bg-[#151924]/95 backdrop-blur-2xl border border-white/10 hover:border-white/20 transition-all text-xs sm:text-sm text-slate-300 shadow-xl cursor-pointer"
              >
                <div className="p-2 rounded-xl bg-[#07090f] text-slate-300 border border-white/10 group-hover:bg-white/10 group-hover:text-white transition-colors shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white group-hover:text-slate-100 transition-colors mb-0.5 text-xs sm:text-sm">
                    {item.title}
                  </div>
                  <div className="text-xs text-slate-400 line-clamp-1">
                    {item.text}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Voice Recognition Active Floating Indicator */}
      {isListening && (
        <div className="mb-2 p-2.5 sm:p-3 rounded-2xl bg-[#0e111a]/95 backdrop-blur-2xl border border-white/20 shadow-2xl flex items-center justify-between gap-3 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative flex items-center justify-center">
              <span className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-ping absolute"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 relative"></span>
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                <span>Voice AI Mendengarkan Suara...</span>
              </div>
              <div className="text-[11px] text-slate-300 truncate font-sans">
                {voiceInterim || 'Bicaralah sekarang melalui mikrofon Anda...'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleToggleMic}
              className="px-2.5 py-1 rounded-xl bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/30 text-xs font-medium transition-colors"
            >
              Hentikan
            </button>
          </div>
        </div>
      )}

      {/* Prompt Template Helper Modal */}
      {showAttachmentModal && (
        <div className="absolute bottom-20 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 p-4 rounded-2xl bg-[#0f121a]/95 backdrop-blur-2xl border border-white/15 shadow-2xl z-30 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/10">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-slate-300" />
              Template Prompt
            </span>
            <button
              onClick={() => setShowAttachmentModal(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2 text-xs">
            <button
              onClick={() => handleQuickTemplate('[CODE REVIEW & REFACTOR]\nTolong analisis dan optimasi kode berikut untuk clean architecture, performa tinggi, dan type safety:\n\n```typescript\n// Tempel kode Anda di sini\n```')}
              className="w-full text-left p-3 rounded-xl bg-[#07090f]/80 hover:bg-[#161a26] border border-white/5 text-slate-200 flex items-center gap-3 transition-colors cursor-pointer"
            >
              <Code className="w-4 h-4 text-slate-300 shrink-0" />
              <div>
                <div className="font-medium text-white">Review & Refactor Kode</div>
                <div className="text-[11px] text-slate-400">Optimasi performa & arsitektur TypeScript/JS</div>
              </div>
            </button>

            <button
              onClick={() => handleQuickTemplate('[RINGKASAN EKSEKUTIF]\nBuatkan ringkasan komprehensif, temuan utama, dan langkah strategis dari data/artikel berikut:\n\n')}
              className="w-full text-left p-3 rounded-xl bg-[#07090f]/80 hover:bg-[#161a26] border border-white/5 text-slate-200 flex items-center gap-3 transition-colors cursor-pointer"
            >
              <FileText className="w-4 h-4 text-slate-300 shrink-0" />
              <div>
                <div className="font-medium text-white">Ringkasan Eksekutif</div>
                <div className="text-[11px] text-slate-400">Rangkuman terstruktur & poin kunci</div>
              </div>
            </button>

            <button
              onClick={() => handleQuickTemplate('[STRATEGI & IDE INOVASI]\nBerikan 5 solusi kreatif, roadmap implementasi, dan strategi diferensiasi produk untuk topik:\n\n')}
              className="w-full text-left p-3 rounded-xl bg-[#07090f]/80 hover:bg-[#161a26] border border-white/5 text-slate-200 flex items-center gap-3 transition-colors cursor-pointer"
            >
              <Lightbulb className="w-4 h-4 text-slate-300 shrink-0" />
              <div>
                <div className="font-medium text-white">Brainstorming Inovasi</div>
                <div className="text-[11px] text-slate-400">Strategi produk, arsitektur & ide baru</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Main Glassmorphic Input Bar */}
      <div className="relative rounded-2xl bg-[#0f121a]/90 backdrop-blur-2xl border border-white/15 focus-within:border-white/30 focus-within:ring-2 focus-within:ring-white/10 shadow-2xl transition-all">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tanyakan apa pun kepada AI... (Shift + Enter untuk baris baru)"
          disabled={disabled || (isGenerating && !onStopGeneration)}
          rows={1}
          className="w-full bg-transparent px-4 py-3.5 pr-28 sm:pr-32 text-sm text-white placeholder-slate-500 focus:outline-none resize-none min-h-[52px] max-h-[220px] leading-relaxed"
        />

        {/* Action Buttons Toolbar */}
        <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1 sm:gap-1.5">
          {/* Template helper button */}
          <button
            type="button"
            onClick={() => setShowAttachmentModal(!showAttachmentModal)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Template Prompt"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Voice AI Microphone button */}
          {micSupported && (
            <button
              type="button"
              onClick={handleToggleMic}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                isListening
                  ? 'bg-rose-600 text-white shadow-lg animate-pulse'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
              title={isListening ? 'Hentikan merekam suara' : 'Bicara dengan Voice AI (Mikrofon)'}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}

          {/* Send or Stop button */}
          {isGenerating ? (
            <button
              type="button"
              onClick={onStopGeneration}
              className="p-2 rounded-xl bg-slate-200 hover:bg-white text-slate-950 shadow-lg transition-all flex items-center justify-center cursor-pointer"
              title="Hentikan jawaban"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!input.trim() || disabled}
              className={`p-2 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
                input.trim() && !disabled
                  ? 'bg-slate-100 hover:bg-white text-slate-950 shadow-lg shadow-white/10 font-semibold'
                  : 'bg-white/5 text-slate-600 cursor-not-allowed'
              }`}
              title="Kirim pesan (Enter)"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Footer Info & Auto-Speak Quick Toggle */}
      <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-slate-500 select-none">
        <div className="flex items-center gap-3">
          <span>LYNXIEE MARKET AI • Respon Real-Time & Voice Audio</span>
          {onToggleAutoSpeak && (
            <button
              type="button"
              onClick={onToggleAutoSpeak}
              className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] transition-colors cursor-pointer ${
                autoSpeakAi
                  ? 'bg-slate-200 text-slate-950 border-white font-medium'
                  : 'bg-white/5 text-slate-400 border-white/10 hover:text-slate-300'
              }`}
              title="Otomatis bacakan jawaban AI dengan suara"
            >
              <Volume2 className="w-3 h-3" />
              <span>{autoSpeakAi ? 'Voice Baca: ON' : 'Voice Baca: OFF'}</span>
            </button>
          )}
        </div>

        <span className="hidden sm:inline-flex items-center gap-1 font-mono text-slate-500">
          <CornerDownLeft className="w-3 h-3" /> Enter untuk kirim
        </span>
      </div>
    </div>
  );
};
