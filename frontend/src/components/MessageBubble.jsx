import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThumbsUp, ThumbsDown, Flag, ChevronDown, ChevronUp, Bot, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import MarkdownRenderer from './ui/MarkdownRenderer';
import ConfidenceBar from './ui/ConfidenceBar';
import RiskBadge from './ui/RiskBadge';
import CitationPopover from './ui/CitationPopover';
import { cn } from '../lib/cn';
import api from '../services/api';

/* ── Typing indicator ─────────────────────────────────────────── */
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-2 h-2 rounded-full bg-primary/60"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
        />
      ))}
    </div>
  );
}

/* ── User bubble ──────────────────────────────────────────────── */
function UserBubble({ content, timestamp }) {
  return (
    <div className="flex justify-end gap-2 mb-4">
      <div className="max-w-[75%]">
        <div className="bg-primary text-white rounded-2xl rounded-br-sm px-4 py-3 text-sm leading-relaxed shadow-sm">
          {content}
        </div>
        {timestamp && (
          <p className="text-xs text-text-subtle mt-1 text-right">
            {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
          </p>
        )}
      </div>
      <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-1">
        <User className="w-4 h-4 text-primary" />
      </div>
    </div>
  );
}

/* ── AI bubble ────────────────────────────────────────────────── */
function AIBubble({ messageId, content, metadata, isStreaming, timestamp }) {
  const [showContext, setShowContext] = useState(false);
  const [feedback,   setFeedback]    = useState(null); // -1 | 0 | 1 | null

  const citations   = metadata?.citations   || [];
  const riskLevel   = metadata?.riskLevel   || 'Low';
  const confidence  = metadata?.confidence  || 0;
  const followUps   = metadata?.follow_up_questions || [];
  const chunks      = metadata?.retrieved_chunks || [];

  const sendFeedback = async (rating) => {
    if (!messageId) return;
    try {
      await api.post(`/chat/messages/${messageId}/feedback`, { rating });
      setFeedback(rating);
      toast.success(rating === 1 ? 'Thanks for the feedback!' : 'Feedback recorded.');
    } catch {
      toast.error('Could not save feedback');
    }
  };

  return (
    <div className="flex gap-2 mb-4">
      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1 shadow-sm">
        <Bot className="w-4 h-4 text-white" />
      </div>

      <div className="flex-1 min-w-0 max-w-[85%]">
        <div className="bg-white dark:bg-surface-dark rounded-2xl rounded-tl-sm border border-border dark:border-border-dark shadow-sm px-4 py-3">

          {/* Content — streaming or complete */}
          {isStreaming && !content ? (
            <TypingDots />
          ) : (
            <MarkdownRenderer content={content} />
          )}

          {/* Metadata — appears after stream completes */}
          <AnimatePresence>
            {!isStreaming && metadata && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="mt-3 pt-3 border-t border-border/60 dark:border-border-dark/60 space-y-2.5"
              >
                {/* Risk + Confidence row */}
                <div className="flex items-center gap-3 flex-wrap">
                  <RiskBadge level={riskLevel} />
                  <ConfidenceBar confidence={confidence} riskLevel={riskLevel} className="flex-1 min-w-[140px]" />
                </div>

                {/* Citations */}
                {citations.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-xs text-text-muted">Sources:</span>
                    {citations.map((c) => (
                      <CitationPopover key={c.id} citation={c} />
                    ))}
                  </div>
                )}

                {/* "Why this answer?" accordion */}
                {chunks.length > 0 && (
                  <button
                    onClick={() => setShowContext((v) => !v)}
                    className="flex items-center gap-1.5 text-xs text-text-muted hover:text-primary transition-colors"
                  >
                    {showContext ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    Why this answer?
                  </button>
                )}

                <AnimatePresence>
                  {showContext && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-slate-50 dark:bg-slate-800/40 rounded-lg p-3 space-y-2">
                        {chunks.map((chunk, i) => (
                          <div key={i} className="text-xs text-text-muted leading-relaxed">
                            <span className="font-medium text-text-primary dark:text-text-dark">[{i+1}] {chunk.source}</span>
                            <p className="mt-0.5">{chunk.text?.slice(0, 160)}…</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Feedback buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-text-subtle">Was this helpful?</span>
                  <button
                    onClick={() => sendFeedback(1)}
                    disabled={feedback !== null}
                    className={cn(
                      'p-1.5 rounded transition-colors',
                      feedback === 1
                        ? 'text-success bg-success/15'
                        : 'text-text-muted hover:text-success hover:bg-success/10 disabled:opacity-40',
                    )}
                    aria-label="Thumbs up"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => sendFeedback(-1)}
                    disabled={feedback !== null}
                    className={cn(
                      'p-1.5 rounded transition-colors',
                      feedback === -1
                        ? 'text-danger bg-danger/15'
                        : 'text-text-muted hover:text-danger hover:bg-danger/10 disabled:opacity-40',
                    )}
                    aria-label="Thumbs down"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => sendFeedback(0)}
                    disabled={feedback !== null}
                    className="p-1.5 rounded text-text-muted hover:text-warning hover:bg-warning/10 disabled:opacity-40 transition-colors ml-1"
                    aria-label="Report"
                  >
                    <Flag className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Timestamp */}
        {timestamp && !isStreaming && (
          <p className="text-xs text-text-subtle mt-1 ml-1">
            {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
          </p>
        )}

        {/* Follow-up question chips */}
        {!isStreaming && followUps.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {followUps.map((q, i) => (
              <button
                key={i}
                className="text-xs px-3 py-1.5 rounded-full border border-primary/40 text-primary hover:bg-primary/10 transition-colors"
                onClick={() => {
                  const event = new CustomEvent('chat:followup', { detail: q });
                  window.dispatchEvent(event);
                }}
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MessageBubble({ message, isStreaming, streamContent, streamMetadata }) {
  if (message?.role === 'user' || (!isStreaming && message?.role === 'user')) {
    return <UserBubble content={message.content} timestamp={message.created_at} />;
  }

  const content  = isStreaming ? streamContent : (message?.content || '');
  const metadata = isStreaming ? streamMetadata : (message?.structured_output || null);

  return (
    <AIBubble
      messageId={message?._id}
      content={content}
      metadata={metadata}
      isStreaming={isStreaming}
      timestamp={message?.created_at}
    />
  );
}
