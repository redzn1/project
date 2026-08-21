import React from 'react';
import { Database, ShieldCheck, Zap } from 'lucide-react';

interface LoadingScreenProps {
  statusMessage?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  statusMessage = 'Inisialisasi Firebase & AI Intelligence Gateway...',
}) => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#07080c] text-white select-none overflow-hidden">
      {/* Subtle Ambient Obsidian Depth */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-blue-950/15 rounded-full blur-[140px] pointer-events-none"></div>

      {/* Brand Icon Container */}
      <div className="relative flex items-center justify-center mb-6 z-10">
        <div className="w-18 h-18 rounded-2xl overflow-hidden shadow-2xl bg-[#121622] border border-white/10 p-3.5 flex items-center justify-center">
          <img
            src="/logo.svg"
            alt="LYNXIEE Logo"
            className="w-full h-full object-contain"
          />
        </div>
      </div>

      {/* Brand Title */}
      <div className="text-center space-y-2 z-10 px-4">
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            LYNXIEE MARKET
          </h1>
          <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            AI
          </span>
        </div>

        <p className="text-xs text-slate-400 tracking-wide flex items-center justify-center gap-2">
          <span className="pulsing-blue-dot"></span>
          Firebase Persistent Auth & Response Stream Active
        </p>
      </div>

      {/* Progress Bar & Status Text */}
      <div className="w-64 sm:w-72 mt-8 space-y-2.5 z-10">
        <div className="h-1 w-full bg-[#121622] rounded-full overflow-hidden border border-white/5">
          <div className="h-full bg-blue-500 rounded-full w-3/4 animate-pulse"></div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
          <span className="flex items-center gap-1.5 text-slate-300 truncate">
            <Zap className="w-3 h-3 text-blue-400" />
            {statusMessage}
          </span>
          <span className="text-slate-500 font-mono">v3.0</span>
        </div>
      </div>

      {/* Badges footer */}
      <div className="absolute bottom-6 flex items-center gap-4 text-[10px] text-slate-400 font-mono z-10">
        <span className="flex items-center gap-1">
          <Database className="w-3 h-3 text-blue-400" /> RTDB & Firestore
        </span>
        <span className="text-slate-600">•</span>
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-blue-400" /> Persistent Session
        </span>
      </div>
    </div>
  );
};
