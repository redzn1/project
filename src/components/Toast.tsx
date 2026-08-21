import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { ToastMessage } from '../types';

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      <AnimatePresence>
        {toasts.map((toast) => {
          const getIcon = () => {
            switch (toast.type) {
              case 'success':
                return <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
              case 'warning':
                return <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />;
              case 'error':
                return <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />;
              default:
                return <Info className="w-5 h-5 text-indigo-400 shrink-0" />;
            }
          };

          const getBorderColor = () => {
            switch (toast.type) {
              case 'success':
                return 'border-emerald-500/30 bg-emerald-950/40 text-emerald-100 shadow-emerald-900/20';
              case 'warning':
                return 'border-amber-500/30 bg-amber-950/40 text-amber-100 shadow-amber-900/20';
              case 'error':
                return 'border-rose-500/30 bg-rose-950/40 text-rose-100 shadow-rose-900/20';
              default:
                return 'border-indigo-500/30 bg-indigo-950/40 text-indigo-100 shadow-indigo-900/20';
            }
          };

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border backdrop-blur-xl shadow-lg ${getBorderColor()}`}
            >
              {getIcon()}
              <div className="flex-1 text-sm">
                {toast.title && <div className="font-semibold text-xs tracking-wide uppercase mb-0.5 opacity-90">{toast.title}</div>}
                <div className="text-slate-200 leading-snug">{toast.message}</div>
              </div>
              <button
                onClick={() => onDismiss(toast.id)}
                className="text-slate-400 hover:text-slate-100 p-0.5 rounded transition-colors"
                aria-label="Close notification"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
