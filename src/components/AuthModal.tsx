import React, { useState } from 'react';
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  ShieldCheck,
  Database,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { registerWithFirebase, loginWithFirebase, AppUser } from '../lib/firebase';

interface AuthModalProps {
  onSuccess: (user: AppUser) => void;
  onClose?: () => void;
  onShowToast: (toast: { type: 'success' | 'error' | 'info'; title?: string; message: string }) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess, onClose, onShowToast }) => {
  const [tab, setTab] = useState<'login' | 'signup'>('login');

  // Login Form States
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Signup Form States
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPass, setSignupConfirmPass] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirm, setShowSignupConfirm] = useState(false);

  // Status & Loading
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Handle Login Submit
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!loginIdentifier.trim()) {
      setErrorMessage('Silakan masukkan Email atau Nama akun Anda.');
      return;
    }
    if (!loginPassword) {
      setErrorMessage('Silakan masukkan Password akun Anda.');
      return;
    }

    setLoading(true);
    try {
      const user = await loginWithFirebase({
        identifier: loginIdentifier.trim(),
        password: loginPassword,
      });

      setSuccessMessage(`Selamat datang kembali, ${user.name}!`);
      onShowToast({
        type: 'success',
        title: 'Login Berhasil',
        message: `Masuk sebagai ${user.name} (${user.email})`,
      });
      setTimeout(() => {
        onSuccess(user);
      }, 350);
    } catch (err: any) {
      console.error('Login error:', err);
      let msg = err?.message || 'Gagal login. Periksa kembali email/nama dan password Anda.';
      if (
        msg.includes('auth/invalid-credential') ||
        msg.includes('auth/wrong-password') ||
        msg.includes('auth/user-not-found')
      ) {
        msg = 'Email/Nama atau Password salah. Silakan coba lagi.';
      } else if (msg.includes('auth/invalid-email')) {
        msg = 'Format email tidak valid.';
      } else if (msg.includes('auth/too-many-requests')) {
        msg = 'Terlalu banyak percobaan gagal. Silakan tunggu beberapa menit.';
      }
      setErrorMessage(msg);
      onShowToast({
        type: 'error',
        title: 'Login Gagal',
        message: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle Signup Submit
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const name = signupName.trim();
    const email = signupEmail.trim();
    const password = signupPassword;
    const confirmPass = signupConfirmPass;

    if (!name || name.length < 2) {
      setErrorMessage('Nama minimal harus 2 karakter.');
      return;
    }
    if (!email || !email.includes('@') || !email.includes('.')) {
      setErrorMessage('Silakan masukkan alamat email yang valid.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage('Password minimal harus 6 karakter.');
      return;
    }
    if (password !== confirmPass) {
      setErrorMessage('Konfirmasi password tidak cocok dengan password yang dimasukkan.');
      return;
    }

    setLoading(true);
    try {
      const user = await registerWithFirebase({
        name,
        email,
        password,
      });

      setSuccessMessage(`Akun berhasil dibuat dan tersimpan di Firebase RTDB!`);
      onShowToast({
        type: 'success',
        title: 'Registrasi Berhasil',
        message: `Selamat datang di LYNXIEE MARKET AI, ${user.name}!`,
      });
      setTimeout(() => {
        onSuccess(user);
      }, 400);
    } catch (err: any) {
      console.error('Signup error:', err);
      let msg = err?.message || 'Gagal mendaftar akun.';
      if (msg.includes('auth/email-already-in-use')) {
        msg = 'Email ini sudah terdaftar. Silakan gunakan menu Masuk / Login.';
      } else if (msg.includes('auth/weak-password')) {
        msg = 'Kata sandi terlalu lemah. Gunakan minimal 6 karakter.';
      }
      setErrorMessage(msg);
      onShowToast({
        type: 'error',
        title: 'Registrasi Gagal',
        message: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#0f121a]/95 backdrop-blur-2xl border border-white/15 rounded-3xl p-5 sm:p-7 shadow-2xl text-white">
        {/* Header & Close */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#151a26] border border-white/15 flex items-center justify-center p-1 shadow-md">
              <img src="/logo.svg" alt="LYNXIEE" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                LYNXIEE MARKET AI
              </h2>
              <p className="text-[11px] text-slate-400">Akun & Sinkronisasi Cloud</p>
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 bg-[#07080e] rounded-xl border border-white/10 mb-4">
          <button
            onClick={() => {
              setTab('login');
              setErrorMessage(null);
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              tab === 'login'
                ? 'bg-white/15 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Masuk / Login
          </button>
          <button
            onClick={() => {
              setTab('signup');
              setErrorMessage(null);
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              tab === 'signup'
                ? 'bg-white/15 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Daftar Akun
          </button>
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div className="mb-3.5 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-3.5 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form: Login */}
        {tab === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Email atau Nama Pengguna
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="email@domain.com atau Nama"
                  className="w-full bg-[#07080e] border border-white/10 rounded-xl pl-9.5 pr-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Kata Sandi</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Masukkan kata sandi akun"
                  className="w-full bg-[#07080e] border border-white/10 rounded-xl pl-9.5 pr-10 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-white text-slate-950 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin"></div>
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Masuk Sekarang</span>
                </>
              )}
            </button>
          </form>
        ) : (
          /* Form: Signup */
          <form onSubmit={handleSignup} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Nama Lengkap</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  placeholder="Nama tampilan Anda"
                  className="w-full bg-[#07080e] border border-white/10 rounded-xl pl-9.5 pr-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="alamat@email.com"
                  className="w-full bg-[#07080e] border border-white/10 rounded-xl pl-9.5 pr-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showSignupPassword ? 'text' : 'password'}
                  required
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full bg-[#07080e] border border-white/10 rounded-xl pl-9.5 pr-10 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowSignupPassword(!showSignupPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                >
                  {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Konfirmasi Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <input
                  type={showSignupConfirm ? 'text' : 'password'}
                  required
                  value={signupConfirmPass}
                  onChange={(e) => setSignupConfirmPass(e.target.value)}
                  placeholder="Ulangi password"
                  className="w-full bg-[#07080e] border border-white/10 rounded-xl pl-9.5 pr-10 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowSignupConfirm(!showSignupConfirm)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                >
                  {showSignupConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-white text-slate-950 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin"></div>
                  <span>Mendaftarkan ke Firebase...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Daftar Sekarang</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Guest Continue action */}
        {onClose && (
          <div className="mt-3 pt-3 border-t border-white/10 text-center">
            <button
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Lanjutkan sebagai Pengguna Tamu (Tanpa Akun)
            </button>
          </div>
        )}

        {/* Database & Session status */}
        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span className="flex items-center gap-1.5 text-slate-400">
            <Database className="w-3.5 h-3.5" />
            <span>Firebase RTDB Sync</span>
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Persistent Session</span>
          </span>
        </div>
      </div>
    </div>
  );
};
