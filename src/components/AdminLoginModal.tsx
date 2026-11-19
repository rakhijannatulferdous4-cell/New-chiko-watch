import React, { useState } from 'react';
import { Lock, ShieldCheck, X } from 'lucide-react';
import { motion } from 'motion/react';

interface AdminLoginModalProps {
  onClose: () => void;
  onSuccess: (username: string, token: string) => void;
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
      onSuccess(data.username || username, data.token || '');
    } catch {
      setError('Unable to reach authentication server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{ perspective: 1200 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Admin Authentication"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.82, y: 40, rotateX: 20, rotateY: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0, rotateY: 0 }}
        exit={{ opacity: 0, scale: 0.86, y: 28, rotateX: 14 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        onClick={(e) => e.stopPropagation()}
        style={{ transformStyle: 'preserve-3d' }}
        className="w-full max-w-md rounded-2xl bg-white border border-zinc-200 p-6 shadow-[0_32px_64px_-16px_rgba(9,9,11,0.45)] space-y-5 will-change-transform"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-zinc-950 text-white flex items-center justify-center">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 className="font-display text-2xl font-semibold text-[#09090B]">
                Shopkeeper Access
              </h2>
              <p className="text-xs text-zinc-500">
                New Chiko Watch &amp; Electronics Console
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 transition-colors cursor-pointer"
            aria-label="Close login modal"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="admin-user" className="text-xs font-semibold text-zinc-700">
              Username
            </label>
            <input
              id="admin-user"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              required
              autoComplete="username"
              className="w-full min-h-[44px] rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 text-sm text-[#09090B] placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-950"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="admin-pass" className="text-xs font-semibold text-zinc-700">
              Password
            </label>
            <input
              id="admin-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="w-full min-h-[44px] rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 text-sm text-[#09090B] placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-950"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[46px] rounded-xl bg-[#09090B] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-zinc-800 disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer"
          >
            <Lock size={16} />
            <span>{loading ? 'Verifying...' : 'Sign In as Shopkeeper'}</span>
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
