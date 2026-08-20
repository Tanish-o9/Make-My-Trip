import React, { useState, useEffect, useRef } from 'react';
import { API_URL } from './config/api';

interface VerifyEmailPageProps {
  email: string;
  onNavigate: (path: string) => void;
}

export default function VerifyEmailPage({ email, onNavigate }: VerifyEmailPageProps) {
  useEffect(() => {
    if (onNavigate) {
      onNavigate('/');
    } else if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  }, [onNavigate]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#0a0f1d] p-4 z-50">
      <div className="text-center">
        <div className="text-6xl mb-4 animate-bounce">✅</div>
        <h2 className="text-2xl font-black text-white mb-2">Account Verified!</h2>
        <p className="text-slate-400 text-sm">Redirecting you to sign in...</p>
      </div>
    </div>
  );
}
