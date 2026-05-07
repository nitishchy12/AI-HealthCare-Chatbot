import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Menu, X, ChevronDown, MessageSquare, AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import useStreamingChat from '../hooks/useStreamingChat';
import { getConversation, createConversation } from '../services/health.service';
import ConversationSidebar from '../components/ConversationSidebar';
import MessageBubble from '../components/MessageBubble';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import { cn } from '../lib/cn';

const LAST_CONV_KEY = 'last_conversation_id';

/* ── Scroll-to-bottom button ─────────────────────────────────── */
function ScrollButton({ onClick }) {
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      onClick={onClick}
      className="absolute bottom-24 right-6 z-10 w-9 h-9 rounded-full bg-white dark:bg-surface-dark border border-border dark:border-border-dark shadow-md flex items-center justify-center text-text-muted hover:text-primary transition-colors"
    >
      <ChevronDown className="w-4 h-4" />
    </motion.button>
  );
}

export default function ChatbotPage() {
  const { token }   = useAuth();
  const { language, t } = useLanguage();

  /* ── Sidebar state ──────────────────────────────────────────── */
  const [sidebarOpen,     setSidebarOpen]     = useState(false);
  const [activeConv,      setActiveConv]      = useState(null); // full conversation object
  const [messages,        setMessages]        = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [question,        setQuestion]        = useState('');
  const [atBottom,        setAtBottom]        = useState(true);
  const submittingRef = useRef(false);

  const messagesEndRef = useRef(null);
  const messagesAreaRef = useRef(null);
  const textareaRef = useRef(null);

  const {
    streamedContent, streamMetadata, isStreaming, error: streamError,
    sendMessage, reset,
  } = useStreamingChat();

  /* ── Load conversation messages ─────────────────────────────── */
  const loadConversation = useCallback(async (conv) => {
    if (!conv?._id) return;
    setActiveConv(conv);
    setMessagesLoading(true);
    reset();
    try {
      const res = await getConversation(conv._id);
      setMessages(res.data?.messages || []);
      localStorage.setItem(LAST_CONV_KEY, conv._id);
    } catch {
      toast.error(t.couldNotLoadConversation);
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, [reset]);

  /* ── Restore last conversation on mount ─────────────────────── */
  useEffect(() => {
    const lastId = localStorage.getItem(LAST_CONV_KEY);
    if (lastId) {
      getConversation(lastId)
        .then((res) => { if (res.data) loadConversation(res.data); })
        .catch(() => {});
    }
  }, [loadConversation]);

  /* ── Follow-up question chips ────────────────────────────────── */
  useEffect(() => {
    const handler = (e) => {
      setQuestion(e.detail || '');
      textareaRef.current?.focus();
    };
    window.addEventListener('chat:followup', handler);
    return () => window.removeEventListener('chat:followup', handler);
  }, []);

  /* ── Auto-scroll ─────────────────────────────────────────────── */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (atBottom) scrollToBottom();
  }, [messages, streamedContent, atBottom, scrollToBottom]);

  const handleScroll = () => {
    const el = messagesAreaRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAtBottom(nearBottom);
  };

  /* ── Submit message ──────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e?.preventDefault();
    const q = question.trim();
    if (!q || isStreaming || submittingRef.current) return;
    submittingRef.current = true;

    try {
      setQuestion('');
      setAtBottom(true);

      // Optimistically add user message
      const userMsg = { _id: `tmp-${Date.now()}`, role: 'user', content: q, created_at: new Date().toISOString() };
      setMessages((prev) => [...prev, userMsg]);

      // Create conversation if none active
      let convId = activeConv?._id || '';
      if (!convId) {
        try {
          const res = await createConversation({ firstMessage: q, language });
          const conv = res.data;
          setActiveConv(conv);
          convId = conv._id;
          localStorage.setItem(LAST_CONV_KEY, convId);
        } catch {
          toast.error(t.couldNotStartConversation);
          setMessages((prev) => prev.filter((m) => m._id !== userMsg._id));
          return;
        }
      }

      await sendMessage(q, convId, language);
    } finally {
      submittingRef.current = false;
    }
  };

  /* ── After stream completes — add AI message to list ─────────── */
  useEffect(() => {
    if (!isStreaming && streamedContent && streamMetadata) {
      const aiMsg = {
        _id:              `ai-${Date.now()}`,
        role:             'assistant',
        content:          streamedContent,
        structured_output: streamMetadata,
        created_at:       new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      reset();
    }
  }, [isStreaming, streamedContent, streamMetadata, reset]);

  /* ── New conversation ─────────────────────────────────────────── */
  const handleNewConversation = (conv) => {
    setActiveConv(conv || null);
    setMessages([]);
    reset();
    if (conv) localStorage.setItem(LAST_CONV_KEY, conv._id);
    else localStorage.removeItem(LAST_CONV_KEY);
    setSidebarOpen(false);
  };

  /* ── Keyboard submit (Ctrl+Enter or Enter on desktop) ─────────── */
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden bg-background dark:bg-background-dark">

      {/* ── Sidebar — desktop always visible, mobile drawer ─────── */}
      <div className={cn(
        'w-72 shrink-0 transition-all duration-200',
        'hidden lg:flex flex-col',
      )}>
        <ConversationSidebar
          activeId={activeConv?._id}
          onSelect={loadConversation}
          onNew={handleNewConversation}
        />
      </div>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-14 bottom-0 z-50 w-72 lg:hidden"
            >
              <ConversationSidebar
                activeId={activeConv?._id}
                onSelect={(c) => { loadConversation(c); setSidebarOpen(false); }}
                onNew={handleNewConversation}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Main chat area ──────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Conversation header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border dark:border-border-dark bg-white/80 dark:bg-surface-dark/80 backdrop-blur-sm shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-border/40 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-text-primary dark:text-text-dark truncate">
              {activeConv?.title || t.healthChatbotHeader}
            </h2>
            <p className="text-xs text-text-muted">{t.aiHealthAwareness}</p>
          </div>
        </div>

        {/* Messages area */}
        <div
          ref={messagesAreaRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-6 space-y-0 scrollbar-thin relative"
        >
          {/* Loading state */}
          {messagesLoading && (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" className="text-primary" />
            </div>
          )}

          {/* Empty state */}
          {!messagesLoading && messages.length === 0 && !isStreaming && (
            <EmptyState
              icon={MessageSquare}
              title={t.startConversation}
              description={t.startConversationDesc}
              className="py-16"
            />
          )}

          {/* Rendered messages */}
          {!messagesLoading && messages.map((msg) => (
            <MessageBubble key={msg._id} message={msg} />
          ))}

          {/* Active streaming bubble */}
          {isStreaming && (
            <MessageBubble
              message={{ role: 'assistant', _id: 'streaming' }}
              isStreaming
              streamContent={streamedContent}
              streamMetadata={null}
            />
          )}

          {/* Stream error */}
          {streamError && !isStreaming && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2.5 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm mx-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{streamError}</span>
              <button
                onClick={() => reset()}
                className="ml-auto text-xs underline hover:no-underline"
              >
                {t.dismiss}
              </button>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Scroll-to-bottom button */}
        <AnimatePresence>
          {!atBottom && <ScrollButton onClick={scrollToBottom} />}
        </AnimatePresence>

        {/* Input area */}
        <div className="shrink-0 border-t border-border dark:border-border-dark bg-white/90 dark:bg-surface-dark/90 backdrop-blur-sm px-4 py-3">
          <form onSubmit={handleSubmit} className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={question}
                onChange={(e) => {
                  setQuestion(e.target.value);
                  // Auto-resize
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                }}
                onKeyDown={handleKeyDown}
                placeholder={t.askPlaceholder || 'Ask a health question… (Enter to send, Shift+Enter for new line)'}
                rows={1}
                disabled={isStreaming}
                className="w-full resize-none rounded-xl border border-border dark:border-border-dark bg-white dark:bg-surface-dark text-sm text-text-primary dark:text-text-dark placeholder:text-text-subtle px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors disabled:opacity-50 min-h-[48px] max-h-40 overflow-y-auto scrollbar-thin"
              />
            </div>
            <Button
              type="submit"
              onClick={handleSubmit}
              disabled={!question.trim() || isStreaming}
              loading={isStreaming}
              size="lg"
              className="shrink-0 h-12 w-12 !px-0 rounded-xl"
              aria-label="Send message"
            >
              {!isStreaming && <Send className="w-4 h-4" />}
            </Button>
          </form>
          <p className="text-center text-xs text-text-subtle mt-2">
            {t.chatDisclaimer}
          </p>
        </div>
      </div>
    </div>
  );
}
