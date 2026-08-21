import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bot,
  User,
  Copy,
  Check,
  CheckCheck,
  RotateCcw,
  Volume2,
  VolumeX,
  Sparkles,
  Clock,
  Pencil,
  X,
  Send,
  FastForward,
} from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import 'highlight.js/styles/atom-one-dark.css';
import katex from 'katex';
import { ChatMessage as ChatMessageType } from '../types';
import { ttsEngine } from '../lib/voiceAi';

interface ChatMessageProps {
  message: ChatMessageType;
  onRegenerate?: () => void;
  onEditAndResubmit?: (messageId: string, newText: string) => void;
  isLast?: boolean;
  typewriterSpeed?: number;
}

function cleanDisplayContent(content: string): string {
  if (!content) return '';
  const trimmed = content.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('{\n') && trimmed.endsWith('\n}'))) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed.result === 'string') return parsed.result;
      if (typeof parsed.response === 'string') return parsed.response;
      if (typeof parsed.message === 'string') return parsed.message;
      if (typeof parsed.data === 'string') return parsed.data;
      if (parsed.data && typeof parsed.data.result === 'string') return parsed.data.result;
      if (parsed.data && typeof parsed.data.response === 'string') return parsed.data.response;
    } catch {
      // not JSON
    }
  }
  return content;
}

/**
 * Parses LaTeX blocks ($$ ... $$) and inline math ($ ... $) with KaTeX
 */
function renderMathInText(text: string): string {
  if (!text) return '';

  // 1. Render display math $$...$$
  let processed = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    try {
      return `<div class="katex-display">${katex.renderToString(math.trim(), { displayMode: true, throwOnError: false })}</div>`;
    } catch {
      return `$$${math}$$`;
    }
  });

  // 2. Render display math \[...\]
  processed = processed.replace(/\\\[([\s\S]+?)\\\]/g, (_, math) => {
    try {
      return `<div class="katex-display">${katex.renderToString(math.trim(), { displayMode: true, throwOnError: false })}</div>`;
    } catch {
      return `\\[${math}\\]`;
    }
  });

  // 3. Render inline math $...$
  processed = processed.replace(/(^|[^\\])\$([^\$\n]+?)\$/g, (_, prefix, math) => {
    try {
      const rendered = katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
      return `${prefix}${rendered}`;
    } catch {
      return `${prefix}$${math}$`;
    }
  });

  // 4. Render inline math \(...\)
  processed = processed.replace(/\\\(([\s\S]+?)\\\)/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return `\\(${math}\\)`;
    }
  });

  return processed;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  onRegenerate,
  onEditAndResubmit,
  isLast = false,
  typewriterSpeed = 10,
}) => {
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(message.content);
  const [skipTypewriter, setSkipTypewriter] = useState(false);
  const [displayedCharsCount, setDisplayedCharsCount] = useState<number>(() => {
    // If not streaming or not AI, display all instantly
    return message.role === 'user' || !message.isStreaming ? (message.content?.length || 0) : 0;
  });

  const isAI = message.role === 'assistant';
  const rawTargetContent = useMemo(() => cleanDisplayContent(message.content), [message.content]);

  // Subscribe to TTS status changes
  useEffect(() => {
    const unsub = ttsEngine.subscribe((activeId, speaking) => {
      if (activeId === message.id) {
        setIsSpeaking(speaking);
      } else if (isSpeaking) {
        setIsSpeaking(false);
      }
    });
    return () => unsub();
  }, [message.id, isSpeaking]);

  // ----------------------------------------------------
  // Per-Letter Typewriter Streaming Engine (like ChatGPT)
  // ----------------------------------------------------
  const targetLength = rawTargetContent.length;

  useEffect(() => {
    if (!isAI) {
      setDisplayedCharsCount(targetLength);
      return;
    }

    if (skipTypewriter) {
      setDisplayedCharsCount(targetLength);
      return;
    }

    // If message is already finished and we've caught up
    if (!message.isStreaming && displayedCharsCount >= targetLength) {
      return;
    }

    if (displayedCharsCount < targetLength) {
      const remaining = targetLength - displayedCharsCount;
      // Dynamic pacing: if behind by many chars, type faster batches
      const charsPerStep = remaining > 100 ? 6 : remaining > 40 ? 3 : remaining > 15 ? 2 : 1;
      const delay = Math.max(4, Math.min(25, typewriterSpeed));

      const timer = setTimeout(() => {
        setDisplayedCharsCount((prev) => Math.min(prev + charsPerStep, targetLength));
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [displayedCharsCount, targetLength, isAI, message.isStreaming, skipTypewriter, typewriterSpeed]);

  // When message changes from external source or completed stream
  useEffect(() => {
    if (!message.isStreaming && !isAI) {
      setDisplayedCharsCount(message.content?.length || 0);
    }
  }, [message.content, message.isStreaming, isAI]);

  // Computed displayed text with per-letter typing
  const activeContent = useMemo(() => {
    if (!isAI || skipTypewriter || (!message.isStreaming && displayedCharsCount >= targetLength)) {
      return rawTargetContent;
    }
    return rawTargetContent.slice(0, displayedCharsCount);
  }, [isAI, skipTypewriter, message.isStreaming, displayedCharsCount, targetLength, rawTargetContent]);

  // Format time (e.g. "14:25")
  const formattedTime = useMemo(() => {
    const d = message.timestamp ? new Date(message.timestamp) : new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [message.timestamp]);

  // Configure marked renderer for code blocks and links
  const parsedHtml = useMemo(() => {
    if (!activeContent) return '';

    const renderer = new marked.Renderer();

    renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
      const validLang = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
      let highlighted = '';
      try {
        highlighted = hljs.highlight(text, { language: validLang, ignoreIllegals: true }).value;
      } catch {
        highlighted = DOMPurify.sanitize(text);
      }

      const escapedCode = encodeURIComponent(text);
      const displayLang = lang || 'code';

      return `
        <div class="code-block-container my-3 rounded-xl overflow-hidden border border-white/10 bg-[#090b10] shadow-xl">
          <div class="flex items-center justify-between px-3.5 py-1.5 bg-[#0e111a] border-b border-white/10 text-xs text-slate-400 font-mono">
            <span class="flex items-center gap-1.5 text-slate-300 font-medium tracking-wide lowercase">
              <span class="w-2 h-2 rounded-full bg-slate-400"></span>
              ${displayLang}
            </span>
            <button
              class="copy-code-btn flex items-center gap-1 hover:text-white px-2.5 py-0.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 transition-all text-xs text-slate-300 font-sans cursor-pointer"
              data-code="${escapedCode}"
            >
              Salin Kode
            </button>
          </div>
          <pre class="p-4 overflow-x-auto text-xs sm:text-sm leading-relaxed text-slate-200"><code class="hljs ${validLang}">${highlighted}</code></pre>
        </div>
      `;
    };

    renderer.link = function ({ href, title, text }: { href: string; title?: string | null; text: string }) {
      return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-slate-100 hover:text-white underline font-semibold transition-colors" ${
        title ? `title="${title}"` : ''
      }>${text}</a>`;
    };

    marked.setOptions({
      renderer,
      breaks: true,
      gfm: true,
    });

    const mathRenderedText = renderMathInText(activeContent);
    const rawHtml = marked.parse(mathRenderedText) as string;

    return DOMPurify.sanitize(rawHtml, {
      ADD_ATTR: ['target', 'data-code', 'class', 'style', 'aria-hidden'],
      ADD_TAGS: ['button', 'span', 'div', 'math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'annotation'],
    });
  }, [activeContent]);

  // Handle delegated click for "Copy Code" inside rendered markdown
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const copyBtn = target.closest('.copy-code-btn');
    if (copyBtn) {
      const codeAttr = copyBtn.getAttribute('data-code');
      if (codeAttr) {
        const decoded = decodeURIComponent(codeAttr);
        navigator.clipboard.writeText(decoded);
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = `<span>Tersalin!</span>`;
        setTimeout(() => {
          copyBtn.innerHTML = originalText;
        }, 2000);
      }
    }
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(rawTargetContent || message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleSpeak = () => {
    if (isSpeaking) {
      ttsEngine.stop();
      setIsSpeaking(false);
    } else {
      ttsEngine.speak(rawTargetContent || message.content, message.id, {
        onEnd: () => setIsSpeaking(false),
      });
      setIsSpeaking(true);
    }
  };

  const handleStartEdit = () => {
    setEditedText(message.content);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditedText(message.content);
    setIsEditing(false);
  };

  const handleSaveAndResubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = editedText.trim();
    if (!trimmed) return;
    setIsEditing(false);
    if (onEditAndResubmit) {
      onEditAndResubmit(message.id, trimmed);
    }
  };

  const isCurrentlyStreaming = message.isStreaming && displayedCharsCount < targetLength;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={`w-full px-2.5 sm:px-6 my-2.5 flex ${isAI ? 'justify-start' : 'justify-end'}`}
    >
      <div
        className={`flex gap-2.5 sm:gap-3.5 max-w-[98%] sm:max-w-[88%] md:max-w-[80%] lg:max-w-[75%] ${
          isAI ? 'flex-row items-start' : 'flex-row-reverse items-end'
        }`}
      >
        {/* Avatar */}
        <div className="shrink-0 self-end mb-1">
          {isAI ? (
            <div className="w-8 h-8 rounded-xl bg-[#101420] border border-white/15 flex items-center justify-center shadow-lg shadow-black/40 text-slate-200">
              <Bot className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-gradient-to-b from-slate-700 to-slate-900 border border-white/20 flex items-center justify-center shadow-lg text-white text-xs font-semibold">
              <User className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Chat Bubble Container (Liquid Glassmorphism) */}
        <div
          className={`relative group rounded-2xl p-3.5 sm:p-4 shadow-xl transition-all ${
            isAI
              ? 'bg-[#0f121b]/90 backdrop-blur-2xl border border-white/10 text-slate-100'
              : 'bg-gradient-to-b from-slate-800 to-slate-900/95 backdrop-blur-2xl border border-white/15 text-white shadow-black/30'
          }`}
        >
          {/* Header for AI Bubble */}
          {isAI && (
            <div className="flex items-center justify-between gap-3 mb-2.5 pb-2 border-b border-white/10 text-xs">
              <span className="font-semibold text-white flex items-center gap-1.5 tracking-tight">
                <Sparkles className="w-3.5 h-3.5 text-slate-300" />
                LYNXIEE MARKET AI
              </span>
              <div className="flex items-center gap-1.5">
                {message.model && (
                  <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded-lg bg-[#07090e] border border-white/10">
                    {message.model}
                  </span>
                )}
                {isCurrentlyStreaming && (
                  <button
                    onClick={() => setSkipTypewriter(true)}
                    className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
                    title="Lewati efek mengetik"
                  >
                    <FastForward className="w-3 h-3" />
                    <span>Lewati</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* User Message: Edit Mode vs Normal Mode */}
          {!isAI && isEditing ? (
            <form onSubmit={handleSaveAndResubmit} className="space-y-2.5 min-w-[240px] sm:min-w-[320px]">
              <div className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
                <Pencil className="w-3 h-3 text-slate-400" />
                <span>Ubah Pesan & Ulangi Jawaban AI</span>
              </div>
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                autoFocus
                rows={3}
                className="w-full bg-[#07080e]/90 text-sm text-white rounded-xl p-2.5 border border-white/20 focus:outline-none focus:border-white/50 focus:ring-1 focus:ring-white/30 resize-y leading-relaxed font-sans"
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium transition-colors flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  <span>Batal</span>
                </button>
                <button
                  type="submit"
                  disabled={!editedText.trim()}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-white text-slate-950 font-medium text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-3 h-3" />
                  <span>Simpan & Kirim</span>
                </button>
              </div>
            </form>
          ) : (
            /* Message Content */
            <div>
              {activeContent ? (
                <div
                  onClick={handleContainerClick}
                  className={`markdown-content break-words leading-relaxed text-sm sm:text-[14.5px] ${
                    isAI ? 'text-slate-200' : 'text-slate-100'
                  }`}
                  dangerouslySetInnerHTML={{ __html: parsedHtml }}
                />
              ) : null}

              {/* ChatGPT-style Cursor when streaming */}
              {isCurrentlyStreaming && (
                <span className="inline-block w-2 h-4 ml-1 bg-slate-300 align-middle animate-pulse rounded-xs" />
              )}
            </div>
          )}

          {/* Streaming / Typing Indicator when waiting for first chunks */}
          {message.isStreaming && !activeContent && (
            <div className="flex items-center gap-2.5 py-2">
              <div className="flex items-center gap-1 bg-[#07080d] px-3 py-1.5 rounded-full border border-white/10">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"></span>
              </div>
              <span className="text-xs text-slate-400 font-mono italic">Memproses jawaban real-time...</span>
            </div>
          )}

          {/* Error Message */}
          {message.error && (
            <div className="mt-2.5 p-3 rounded-xl border border-rose-500/30 bg-rose-950/40 text-rose-200 text-xs leading-relaxed">
              {message.content || 'Terjadi kendala saat memproses permintaan AI. Silakan coba sesaat lagi.'}
            </div>
          )}

          {/* Bottom Toolbar: Voice AI, Edit, Copy, Latency, Timestamp */}
          {!isEditing && (
            <div className="flex items-center justify-between gap-3 mt-2.5 pt-2 border-t border-white/5 text-[11px] select-none">
              {/* Left Action Buttons */}
              <div className="flex items-center gap-1 text-slate-400">
                {message.content && !message.isStreaming && (
                  <>
                    <button
                      onClick={handleCopyMessage}
                      className="p-1 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
                      title="Salin teks"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>

                    {/* Voice AI Audio Player for AI & User */}
                    <button
                      onClick={handleToggleSpeak}
                      className={`p-1 rounded-lg transition-colors flex items-center gap-1 ${
                        isSpeaking
                          ? 'bg-slate-200 text-slate-950 font-medium'
                          : 'hover:bg-white/10 hover:text-white'
                      }`}
                      title={isSpeaking ? 'Hentikan suara' : 'Dengarkan Voice AI'}
                    >
                      {isSpeaking ? (
                        <>
                          <VolumeX className="w-3.5 h-3.5" />
                          <span className="flex items-center gap-0.5 px-1">
                            <span className="w-0.5 h-2.5 bg-slate-900 animate-pulse"></span>
                            <span className="w-0.5 h-3.5 bg-slate-900 animate-pulse [animation-delay:0.1s]"></span>
                            <span className="w-0.5 h-2 bg-slate-900 animate-pulse [animation-delay:0.2s]"></span>
                          </span>
                        </>
                      ) : (
                        <Volume2 className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Edit button for User Messages */}
                    {!isAI && onEditAndResubmit && (
                      <button
                        onClick={handleStartEdit}
                        className="p-1 rounded-lg hover:bg-white/10 hover:text-white transition-colors flex items-center gap-1 text-slate-300"
                        title="Ubah pesan dan ulangi jawaban"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span className="text-[10px] hidden sm:inline">Ubah</span>
                      </button>
                    )}

                    {/* Regenerate button for AI Messages */}
                    {isAI && onRegenerate && isLast && (
                      <button
                        onClick={onRegenerate}
                        className="p-1 rounded-lg hover:bg-white/10 hover:text-slate-200 transition-colors"
                        title="Buat ulang jawaban"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Right Side: Latency & Timestamp */}
              <div className="flex items-center gap-2 ml-auto text-[10px] text-slate-400 font-mono">
                {message.responseTimeMs && isAI && (
                  <span className="flex items-center gap-1 text-slate-400">
                    <Clock className="w-2.5 h-2.5 text-slate-400" />
                    {(message.responseTimeMs / 1000).toFixed(1)}s
                  </span>
                )}
                <span>{formattedTime}</span>
                {!isAI && <CheckCheck className="w-3.5 h-3.5 text-slate-400" />}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
