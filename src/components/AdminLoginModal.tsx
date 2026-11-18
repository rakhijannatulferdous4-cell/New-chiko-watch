import React, { useState } from 'react';
import { Lock, ShieldCheck, X } from 'lucide-react';
import { motion } from 'motion/react';

interface AdminLoginModalProps {
  onClose: () => void;
  onSuccess: (username: string) => void;
}

export function AdminLoginModal({ onClose, onSuccess }: AdminLoginModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || 'Authentication failed.');
        setLoading(false);
        return;
      }
      onSuccess(data.username || username);
    } catch {
      setError('Unable to reach authentication server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Admin Authentication"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-[#121216] border border-[#D4AF37]/30 p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#D4AF37]/15 border border-[#D4AF37]/35 flex items-center justify-center text-[#D4AF37]">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 className="font-display text-2xl font-semibold text-[#F8F9FA]">
                Shopkeeper Access
              </h2>
              <p className="text-xs text-[#9CA3AF]">
                New Chiko Watch &amp; Electronics Console
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#9CA3AF] hover:text-[#F8F9FA] hover:bg-white/[0.06]"
            aria-label="Close login modal"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="admin-user" className="text-xs font-medium text-[#D1D5DB]">
              Username
            </label>
            <input
              id="admin-user"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              required
              autoFocus
              className="w-full min-h-[44px] rounded-xl bg-[#0A0A0C] border border-white/[0.12] px-3.5 text-sm text-[#F8F9FA] placeholder:text-[#6B7280] focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="admin-pass" className="text-xs font-medium text-[#D1D5DB]">
              Password
            </label>
            <input
              id="admin-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full min-h-[44px] rounded-xl bg-[#0A0A0C] border border-white/[0.12] px-3.5 text-sm text-[#F8F9FA] placeholder:text-[#6B7280] focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-3.5 py-2.5 text-xs text-rose-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] rounded-xl bg-[#D4AF37] text-[#0A0A0C] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#E5C158] disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Lock size={16} />
            <span>{loading ? 'Verifying...' : 'Sign In to Admin Mode'}</span>
          </button>
        </form>
      </motion.div>
    </div>
  );
}
