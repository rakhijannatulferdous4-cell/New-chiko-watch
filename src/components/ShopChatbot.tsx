import React, { useEffect, useRef, useState } from 'react';
import { Loader2, MessageSquare, Send, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { ChatMessage, WatchItem } from '../types/watch';
import { formatBDT } from './TripleTapPrice';
import { WatchImage } from './WatchImage';

interface ShopChatbotProps {
  watches: WatchItem[];
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  onSelectWatch: (watch: WatchItem) => void;
}

const STARTER_PROMPTS = [
  'Casio er 2000 takar niche ki ghori ache?',
  '2000 takar moddhe TWS earbuds ba smartwatch ache?',
  'অরিজিনাল পাওয়ার ব্যাংক ও ঘড়ি দেখান',
];

export function ShopChatbot({
  watches,
  isOpen,
  onToggle,
  onSelectWatch,
}: ShopChatbotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      text: 'Assalamu Alaikum! Welcome to New Chiko Watch & Electronics. Ask me anything in Bangla, Banglish, or English—about watches, smartwatches, earbuds, power banks, chargers, or speakers.',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const sendMessage = async (textToSend?: string) => {
    const query = (textToSend ?? input).trim();
    if (!query || sending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: query,
      timestamp: new Date().toISOString(),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    if (!textToSend) setInput('');
    setSending(true);

    try {
      const lightCatalog = watches.map(({ image_url: _img, ...rest }) => rest);
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: nextHistory.map((m) => ({ role: m.role, text: m.text })),
          watches: lightCatalog,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === 'string' && !data.error.trim().startsWith('{')
            ? data.error
            : 'The concierge is temporarily unavailable. Please try again shortly.'
        );
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        text: data.reply || 'Here are the closest matches from our store:',
        recommendedWatchIds: Array.isArray(data.recommendedWatchIds)
          ? data.recommendedWatchIds
          : [],
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : '';
      const cleanMsg =
        rawMsg && !rawMsg.trim().startsWith('{')
          ? rawMsg
          : 'Sorry, the concierge could not respond right now. Please try again in a moment.';
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        text: cleanMsg,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setSending(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.97 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-20 md:bottom-6 right-3 left-3 md:left-auto md:right-6 md:w-[400px] z-50 rounded-2xl bg-white border border-zinc-200 shadow-2xl flex flex-col max-h-[72vh] overflow-hidden"
          role="dialog"
          aria-label="New Chiko Watch and Electronics Concierge"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-200 bg-[#09090B] text-white">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-white">
                <MessageSquare size={17} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Chiko Concierge
                </h3>
                <p className="text-[11px] text-zinc-400">
                  Bangla · Banglish · English
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onToggle(false)}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close concierge chat"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#FAFAFA]">
            {messages.map((msg) => {
              const matchedProducts = (msg.recommendedWatchIds || [])
                .map((id) => watches.find((w) => w.id === id))
                .filter((w): w is WatchItem => Boolean(w));

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#09090B] text-white font-medium'
                        : 'bg-white text-zinc-900 border border-zinc-200 shadow-2xs'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {matchedProducts.length > 0 && (
                    <div className="mt-2 w-full space-y-2">
                      {matchedProducts.map((w) => (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => onSelectWatch(w)}
                          className="w-full text-left rounded-xl bg-white border border-zinc-200 hover:border-zinc-900/40 hover:shadow-sm p-2.5 flex items-center gap-3 transition-all cursor-pointer"
                        >
                          <div className="w-12 h-10 rounded-lg overflow-hidden bg-zinc-100 shrink-0">
                            <WatchImage
                              src={w.image_url}
                              alt={w.model}
                              brand={w.brand}
                              model={w.model}
                              category={w.category}
                              iconSize={16}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-zinc-950 truncate">
                              {w.product_name || `${w.brand} ${w.model}`}
                            </p>
                            <p className="text-[11px] text-zinc-500 truncate">
                              {w.category} · {w.color}
                            </p>
                          </div>
                          <span className="font-mono-num text-xs font-bold text-zinc-950 shrink-0">
                            {formatBDT(w.min_selling_price)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {sending && (
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Loader2 size={14} className="animate-spin text-zinc-900" />
                <span>Checking stock...</span>
              </div>
            )}
            <div ref={scrollEndRef} />
          </div>

          {/* Starter Quick Prompts */}
          {messages.length <= 2 && (
            <div className="px-4 py-2 bg-[#FAFAFA] flex gap-2 overflow-x-auto no-scrollbar border-t border-zinc-100">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  className="shrink-0 rounded-lg bg-white border border-zinc-200 hover:border-zinc-900 px-3 py-1.5 text-xs text-zinc-700 hover:text-zinc-950 transition-colors cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={handleFormSubmit}
            className="p-3 border-t border-zinc-200 bg-white flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask in Bangla, Banglish, or English..."
              className="flex-1 min-h-[44px] rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 text-sm text-[#09090B] placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-950"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="min-h-[44px] min-w-[44px] rounded-xl bg-[#09090B] text-white flex items-center justify-center hover:bg-zinc-800 disabled:opacity-40 transition-all active:scale-95 cursor-pointer"
              aria-label="Send message"
            >
              <Send size={17} />
            </button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
