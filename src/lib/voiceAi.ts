/**
 * Voice AI Intelligence Module (TTS & STT)
 * High-performance speech synthesis and voice recognition with Indonesian & English support.
 */

// Speech Recognition Type Definitions for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

/**
 * Text-to-Speech (TTS) Voice Engine
 */
class TextToSpeechEngine {
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private isSpeakingState = false;
  private currentId: string | null = null;
  private onStateChangeListeners: Array<(id: string | null, isSpeaking: boolean) => void> = [];

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      // Warm up voices
      window.speechSynthesis.onvoiceschanged = () => {
        // loaded
      };
    }
  }

  public subscribe(callback: (id: string | null, isSpeaking: boolean) => void) {
    this.onStateChangeListeners.push(callback);
    return () => {
      this.onStateChangeListeners = this.onStateChangeListeners.filter((cb) => cb !== callback);
    };
  }

  private notify(id: string | null, isSpeaking: boolean) {
    this.currentId = id;
    this.isSpeakingState = isSpeaking;
    this.onStateChangeListeners.forEach((cb) => cb(id, isSpeaking));
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public getIsSpeaking(id?: string): boolean {
    if (id) {
      return this.isSpeakingState && this.currentId === id;
    }
    return this.isSpeakingState;
  }

  public speak(
    text: string,
    id: string,
    options?: {
      lang?: string;
      rate?: number;
      pitch?: number;
      onEnd?: () => void;
    }
  ) {
    if (!this.isSupported()) return;

    this.stop();

    // Clean markdown code blocks and raw symbols for smooth speech
    const cleanText = text
      .replace(/```[\s\S]*?```/g, ' [blok kode program] ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\$\$[\s\S]*?\$\$/g, ' [formula matematika] ')
      .replace(/\$([^$]+)\$/g, '$1')
      .replace(/[#*_~>]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = options?.lang || (/[a-zA-Z]{5,}/.test(cleanText) ? 'id-ID' : 'id-ID');
    utterance.rate = options?.rate || 1.0;
    utterance.pitch = options?.pitch || 1.0;

    // Pick a natural voice if available
    const voices = window.speechSynthesis.getVoices();
    const indonesianVoice = voices.find((v) => v.lang.includes('id') || v.lang.includes('ID'));
    const englishVoice = voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Neural')));

    if (utterance.lang.startsWith('id') && indonesianVoice) {
      utterance.voice = indonesianVoice;
    } else if (englishVoice) {
      utterance.voice = englishVoice;
    }

    utterance.onstart = () => {
      this.notify(id, true);
    };

    utterance.onend = () => {
      this.notify(null, false);
      if (options?.onEnd) options.onEnd();
    };

    utterance.onerror = (e) => {
      console.warn('Speech synthesis error:', e);
      this.notify(null, false);
      if (options?.onEnd) options.onEnd();
    };

    this.activeUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  public stop() {
    if (this.isSupported()) {
      window.speechSynthesis.cancel();
    }
    this.activeUtterance = null;
    this.notify(null, false);
  }
}

export const ttsEngine = new TextToSpeechEngine();

/**
 * Speech-to-Text (STT) Voice Recognition Engine
 */
export class SpeechToTextEngine {
  private recognition: SpeechRecognitionInstance | null = null;
  private isListening = false;
  private onTranscriptCallback: ((text: string, isFinal: boolean) => void) | null = null;
  private onStatusChangeCallback: ((listening: boolean, error?: string) => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognitionClass) {
        this.recognition = new SpeechRecognitionClass();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'id-ID';

        this.recognition.onresult = (event: SpeechRecognitionEvent) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          if (this.onTranscriptCallback) {
            const combined = (finalTranscript || interimTranscript).trim();
            if (combined) {
              this.onTranscriptCallback(combined, Boolean(finalTranscript));
            }
          }
        };

        this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.warn('Speech recognition error:', event.error);
          this.isListening = false;
          if (this.onStatusChangeCallback) {
            this.onStatusChangeCallback(false, event.error);
          }
        };

        this.recognition.onend = () => {
          this.isListening = false;
          if (this.onStatusChangeCallback) {
            this.onStatusChangeCallback(false);
          }
        };

        this.recognition.onstart = () => {
          this.isListening = true;
          if (this.onStatusChangeCallback) {
            this.onStatusChangeCallback(true);
          }
        };
      }
    }
  }

  public isSupported(): boolean {
    return Boolean(this.recognition);
  }

  public start(
    onTranscript: (text: string, isFinal: boolean) => void,
    onStatusChange: (listening: boolean, error?: string) => void,
    lang: string = 'id-ID'
  ) {
    if (!this.recognition) {
      onStatusChange(false, 'Speech recognition not supported in this browser.');
      return;
    }

    if (this.isListening) {
      this.stop();
      return;
    }

    this.onTranscriptCallback = onTranscript;
    this.onStatusChangeCallback = onStatusChange;
    this.recognition.lang = lang;

    try {
      this.recognition.start();
    } catch (e: any) {
      console.error('Failed to start speech recognition:', e);
      onStatusChange(false, e?.message || 'Error starting microphone');
    }
  }

  public stop() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {}
    }
    this.isListening = false;
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(false);
    }
  }
}

export const sttEngine = new SpeechToTextEngine();
