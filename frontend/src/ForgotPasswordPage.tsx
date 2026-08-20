import React, { useState, useEffect, useRef } from 'react';
import { API_URL } from './config/api';

interface ForgotPasswordPageProps {
  onNavigate: (path: string) => void;
}

export default function ForgotPasswordPage({ onNavigate }: ForgotPasswordPageProps) {
  const [step, setStep] = useState<'request' | 'reset' | 'success'>('request');
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendMsg, setResendMsg] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cooldown countdown
  const startCooldown = (seconds: number = 60) => {
    setCooldown(seconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Password strength meter
  const getStrength = (pw: string): { score: number; label: string; color: string } => {
    if (!pw) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 2) return { score, label: 'Weak', color: '#ef4444' };
    if (score <= 4) return { score, label: 'Fair', color: '#f59e0b' };
    return { score, label: 'Strong', color: '#22c55e' };
  };
  const strength = getStrength(newPassword);

  // Step 1: Request reset code
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.detail || 'Unable to request password reset code.');
        return;
      }
      setStep('reset');
      startCooldown(60);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch {
      setError('Unable to connect. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  // OTP Box navigation
  const handleDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    setError('');

    if (digit && index < 5) {
      setTimeout(() => inputRefs.current[index + 1]?.focus(), 10);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  // Resend reset code
  const handleResend = async () => {
    if (cooldown > 0 || !email) return;
    setResendLoading(true);
    setResendMsg('');
    setError('');
    try {
      const resp = await fetch(`${API_URL}/auth/resend-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await resp.json();
      if (resp.status === 429) {
        setResendMsg(data.detail || 'Please wait before requesting another code.');
        startCooldown(60);
      } else {
        setResendMsg('A new password reset code has been sent to your email.');
        startCooldown(60);
        setDigits(['', '', '', '', '', '']);
        setTimeout(() => inputRefs.current[0]?.focus(), 50);
      }
    } catch {
      setResendMsg('Unable to resend. Please check your connection.');
    } finally {
      setResendLoading(false);
    }
  };

  // Step 2: Submit password reset
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const code = digits.join('') || '000000';
    const errs: Record<string, string> = {};

    // OTP verification requirement commented out as OTP system is disabled
    if (!newPassword) errs.newPassword = 'Password is required.';
    else if (newPassword.length < 8) errs.newPassword = 'Password must be at least 8 characters.';
    else if (!/[A-Z]/.test(newPassword)) errs.newPassword = 'Must contain an uppercase letter.';
    else if (!/[a-z]/.test(newPassword)) errs.newPassword = 'Must contain a lowercase letter.';
    else if (!/\d/.test(newPassword)) errs.newPassword = 'Must contain a number.';

    if (confirmPassword !== newPassword) errs.confirmPassword = 'Passwords do not match.';

    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const resp = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.detail || 'Password reset failed. Please try again.');
        return;
      }
      setStep('success');
      setTimeout(() => onNavigate('/'), 2500);
    } catch {
      setError('Unable to connect. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full bg-slate-50 border-2 border-black p-2.5 text-xs font-semibold placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none rounded-lg transition-colors';
  const errorCls = 'text-red-500 text-[10px] mt-1 font-semibold';

  // Success screen
  if (step === 'success') {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0a0f1d] p-4 z-50">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🔑</div>
          <h2 className="text-2xl font-black text-white mb-2">Password Reset Successful!</h2>
          <p className="text-slate-400 text-sm">Your password has been updated. Redirecting to sign in...</p>
          <div className="mt-4 w-40 h-1 bg-slate-700 rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-green-400 rounded-full animate-[grow_2.5s_linear]" style={{ width: '100%' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#0a0f1d] p-4 z-50 overflow-y-auto">
      <div className="absolute inset-0 bg-[radial-gradient(#d4af37_1px,transparent_1px)] [background-size:24px_24px] opacity-10" />

      <div className="bg-white text-black border-4 border-black p-8 max-w-md w-full relative z-10 shadow-[8px_8px_0px_0px_#000000] rounded-[24px] my-8">
        <div className="text-center mb-6">
          <span className="font-serif italic font-black text-2xl text-[var(--color-gold)] bg-black px-4 py-1.5 inline-block text-white shadow-[4px_4px_0px_0px_rgba(212,175,55,1)]">
            GHUMNE CHALE
          </span>
          <h2 className="text-xl font-extrabold uppercase mt-6 tracking-wide">
            {step === 'request' ? 'Reset Password' : 'Enter Reset Code'}
          </h2>
          <p className="text-xs text-slate-500 font-bold uppercase mt-1">
            {step === 'request'
              ? 'Enter your email to receive a 6-digit reset code'
              : `Code sent to ${email}`}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-500 p-3 rounded-lg mb-4 text-left">
            <p className="text-red-600 font-bold text-xs">⚠️ {error}</p>
          </div>
        )}

        {step === 'request' ? (
          <form onSubmit={handleRequestCode} className="space-y-4 text-left" noValidate>
            <div>
              <label className="text-[10px] uppercase font-black text-slate-600 block mb-1">Email Address *</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputCls}
                autoComplete="email"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-yellow-300 hover:bg-yellow-400 disabled:opacity-60 disabled:cursor-not-allowed text-black font-black uppercase text-xs p-3.5 border-3 border-black rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Sending Code...
                </span>
              ) : (
                'SEND RESET CODE →'
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4 text-left" noValidate>
            {/* OTP Boxes */}
            <div>
              <label className="text-[10px] uppercase font-black text-slate-600 block mb-2 text-center">
                6-Digit Reset Code *
              </label>
              <div className="flex gap-2 justify-center mb-2" onPaste={handlePaste}>
                {digits.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => {
                      inputRefs.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleDigitChange(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    disabled={loading}
                    className={`w-10 h-12 text-center text-lg font-black border-2 rounded-lg outline-none transition-all ${
                      digit ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 bg-slate-50'
                    } ${loading ? 'opacity-60' : 'focus:border-blue-600 focus:bg-white'}`}
                  />
                ))}
              </div>
              {fieldErrors.code && <p className={`${errorCls} text-center`}>{fieldErrors.code}</p>}
            </div>

            {/* New Password */}
            <div>
              <label className="text-[10px] uppercase font-black text-slate-600 block mb-1">New Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => {
                    setNewPassword(e.target.value);
                    setFieldErrors(p => ({ ...p, newPassword: '' }));
                  }}
                  placeholder="••••••••"
                  className={`${inputCls} pr-10 ${fieldErrors.newPassword ? 'border-red-500' : ''}`}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[11px] font-bold"
                  tabIndex={-1}
                >
                  {showPassword ? 'HIDE' : 'SHOW'}
                </button>
              </div>
              {fieldErrors.newPassword && <p className={errorCls}>{fieldErrors.newPassword}</p>}
              {newPassword && (
                <div className="mt-1.5">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <div
                        key={i}
                        className="h-1 flex-1 rounded-full transition-all"
                        style={{ background: i <= strength.score ? strength.color : '#e2e8f0' }}
                      />
                    ))}
                  </div>
                  {strength.label && (
                    <p className="text-[10px] font-bold" style={{ color: strength.color }}>
                      {strength.label} password
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="text-[10px] uppercase font-black text-slate-600 block mb-1">Confirm New Password *</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => {
                    setConfirmPassword(e.target.value);
                    setFieldErrors(p => ({ ...p, confirmPassword: '' }));
                  }}
                  placeholder="••••••••"
                  className={`${inputCls} pr-10 ${
                    fieldErrors.confirmPassword
                      ? 'border-red-500'
                      : confirmPassword && confirmPassword === newPassword
                      ? 'border-green-500'
                      : ''
                  }`}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[11px] font-bold"
                  tabIndex={-1}
                >
                  {showConfirm ? 'HIDE' : 'SHOW'}
                </button>
              </div>
              {fieldErrors.confirmPassword && <p className={errorCls}>{fieldErrors.confirmPassword}</p>}
              {!fieldErrors.confirmPassword && confirmPassword && confirmPassword === newPassword && (
                <p className="text-green-600 text-[10px] mt-1 font-semibold">✓ Passwords match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || digits.some(d => !d)}
              className="w-full bg-yellow-300 hover:bg-yellow-400 disabled:opacity-60 disabled:cursor-not-allowed text-black font-black uppercase text-xs p-3.5 border-3 border-black rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Updating Password...
                </span>
              ) : (
                'UPDATE PASSWORD →'
              )}
            </button>

            {/* Resend Section */}
            <div className="mt-4 text-center space-y-1">
              {resendMsg && (
                <p className={`text-[10px] font-semibold ${resendMsg.includes('sent') ? 'text-green-600' : 'text-amber-600'}`}>
                  {resendMsg}
                </p>
              )}
              <button
                type="button"
                disabled={cooldown > 0 || resendLoading}
                onClick={handleResend}
                className="text-blue-600 hover:text-blue-800 font-bold text-[10px] uppercase disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
              >
                {resendLoading ? 'Sending...' : cooldown > 0 ? `Resend Code in ${cooldown}s` : 'Resend Code'}
              </button>
            </div>
          </form>
        )}

        <div className="text-center mt-6 pt-4 border-t-2 border-black/10">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="text-[10px] uppercase font-extrabold text-blue-600 hover:underline cursor-pointer"
          >
            ← Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
