import React, { useState, useEffect, useRef } from 'react';
import { API_URL } from './config/api';

interface VerifyEmailPageProps {
  email: string;
  onNavigate: (path: string) => void;
}

export default function VerifyEmailPage({ email, onNavigate }: VerifyEmailPageProps) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start cooldown timer
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
    // Focus first digit on mount
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const handleDigitChange = (index: number, value: string) => {
    // Only accept single digit
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    setError('');

    // Auto-advance
    if (digit && index < 5) {
      setTimeout(() => inputRefs.current[index + 1]?.focus(), 10);
    }
    // Auto-submit when all 6 digits entered
    if (digit && index === 5 && newDigits.every(d => d !== '')) {
      submitCode(newDigits.join(''));
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
      const newDigits = pasted.split('');
      setDigits(newDigits);
      inputRefs.current[5]?.focus();
      submitCode(pasted);
    }
  };

  const submitCode = async (code: string) => {
    if (code.length !== 6) { setError('Please enter the complete 6-digit code.'); return; }
    if (!email) { setError('Email address is missing. Please go back and try again.'); return; }
    setLoading(true);
    setError('');
    try {
      const resp = await fetch(`${API_URL}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.detail || 'Verification failed. Please try again.');
        // Clear digits on error
        setDigits(['', '', '', '', '', '']);
        setTimeout(() => inputRefs.current[0]?.focus(), 50);
      } else {
        setSuccess(true);
        setTimeout(() => onNavigate('/'), 2500);
      }
    } catch {
      setError('Unable to connect. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || !email) return;
    setResendLoading(true);
    setResendMsg('');
    setError('');
    try {
      const resp = await fetch(`${API_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        if (resp.status === 429) {
          setResendMsg(data.detail || 'Please wait before requesting another code.');
          startCooldown(60);
        } else {
          setError(data.detail || 'Unable to send the verification code right now. Please try again.');
        }
      } else {
        setResendMsg('Code sent successfully. Check your email.');
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

  if (success) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0a0f1d] p-4 z-50">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">✅</div>
          <h2 className="text-2xl font-black text-white mb-2">Email Verified!</h2>
          <p className="text-slate-400 text-sm">Redirecting you to sign in...</p>
          <div className="mt-4 w-40 h-1 bg-slate-700 rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-green-400 rounded-full animate-[grow_2.5s_linear]" style={{ width: '100%', animation: 'grow 2.5s linear forwards' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#0a0f1d] p-4 z-50 overflow-y-auto">
      <div className="absolute inset-0 bg-[radial-gradient(#d4af37_1px,transparent_1px)] [background-size:24px_24px] opacity-5" />

      <div className="bg-white border-4 border-black rounded-3xl shadow-[8px_8px_0px_0px_#000] p-8 max-w-md w-full relative z-10 my-8">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="font-serif italic font-black text-xl text-white bg-black px-3 py-1 inline-block shadow-[3px_3px_0px_0px_rgba(212,175,55,1)]">
            GHUMNE CHALE
          </span>
          <div className="mt-5 w-14 h-14 rounded-full bg-blue-50 border-2 border-blue-200 flex items-center justify-center mx-auto">
            <span className="text-2xl">✉️</span>
          </div>
          <h1 className="text-xl font-extrabold mt-4 text-gray-900">Verify your email</h1>
          <p className="text-slate-500 text-xs mt-2 leading-relaxed">
            We sent a 6-digit verification code to
          </p>
          <p className="font-black text-blue-600 text-sm mt-1 break-all">{email || 'your email address'}</p>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border-2 border-red-400 rounded-xl p-3 mb-5 text-center">
            <p className="text-red-600 font-bold text-xs">⚠️ {error}</p>
          </div>
        )}

        {/* OTP digit boxes */}
        <div className="flex gap-2 justify-center mb-6" onPaste={handlePaste}>
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={el => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleDigitChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              disabled={loading}
              className={`
                w-11 h-14 text-center text-xl font-black border-2 rounded-xl outline-none transition-all
                ${digit ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 bg-slate-50 text-slate-800'}
                ${loading ? 'opacity-60 cursor-not-allowed' : 'focus:border-blue-600 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.2)]'}
                ${error ? 'border-red-400 bg-red-50' : ''}
              `}
            />
          ))}
        </div>

        {/* Verify button */}
        <button
          type="button"
          disabled={loading || digits.some(d => !d)}
          onClick={() => submitCode(digits.join(''))}
          className="w-full bg-yellow-300 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black uppercase text-sm p-3.5 border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              Verifying...
            </span>
          ) : 'VERIFY EMAIL →'}
        </button>

        {/* Resend section */}
        <div className="mt-5 text-center space-y-2">
          {resendMsg && (
            <p className={`text-xs font-semibold ${resendMsg.includes('sent') ? 'text-green-600' : 'text-amber-600'}`}>
              {resendMsg}
            </p>
          )}
          <p className="text-slate-500 text-xs">Didn't receive the code?</p>
          <button
            type="button"
            disabled={cooldown > 0 || resendLoading || !email}
            onClick={handleResend}
            className="text-blue-600 hover:text-blue-800 font-black text-xs uppercase disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
          >
            {resendLoading ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'RESEND CODE'}
          </button>
        </div>

        {/* Back link */}
        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="text-slate-400 hover:text-slate-600 text-xs font-semibold uppercase transition-colors"
          >
            ← Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
