import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MoreHorizontal, Pencil, Trash2, Download, Plus, Search, X, MessageSquare } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getConversations, createConversation, renameConversation, deleteConversation,
  searchConversations,
} from '../services/health.service';
import { cn } from '../lib/cn';
import Button from './ui/Button';
import EmptyState from './ui/EmptyState';
import Skeleton from './ui/Skeleton';
import toast from 'react-hot-toast';

export default function ConversationSidebar({ activeId, onSelect, onNew }) {
  const [conversations,  setConversations]  = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [search,         setSearch]         = useState('');
  const [searchMode,     setSearchMode]     = useState(false);   // global msg search vs local title filter
  const [searchResults,  setSearchResults]  = useState([]);
  const [searchLoading,  setSearchLoading]  = useState(false);
  const [editingId,      setEditingId]      = useState(null);
  const [editTitle,      setEditTitle]      = useState('');
  const editRef    = useRef(null);
  const debounceRef = useRef(null);

  const load = async () => {
    try {
      const res = await getConversations(1, 50);
      setConversations(res.data?.items || []);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (editingId && editRef.current) editRef.current.focus();
  }, [editingId]);

  // Debounced message search
  const handleSearchChange = useCallback((val) => {
    setSearch(val);
    clearTimeout(debounceRef.current);
    if (!val.trim()) { setSearchResults([]); setSearchLoading(false); return; }
    setSearchLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchConversations(val.trim());
        setSearchResults(res.data || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
  }, []);

  const clearSearch = () => { setSearch(''); setSearchResults([]); setSearchLoading(false); };

  const handleNew = async () => {
    try {
      const res = await createConversation({ firstMessage: 'New conversation', language: 'en' });
      const conv = res.data;
      setConversations((prev) => [conv, ...prev]);
      onNew?.(conv);
    } catch {
      toast.error('Could not create conversation');
    }
  };

  const startRename = (conv) => {
    setEditingId(conv._id);
    setEditTitle(conv.title);
  };

  const commitRename = async (id) => {
    if (!editTitle.trim()) { setEditingId(null); return; }
    try {
      await renameConversation(id, editTitle.trim());
      setConversations((prev) => prev.map((c) => c._id === id ? { ...c, title: editTitle.trim() } : c));
    } catch {
      toast.error('Rename failed');
    }
    setEditingId(null);
  };

  const handleDelete = async (id) => {
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c._id !== id));
      if (activeId === id) onNew?.();
      toast.success('Conversation deleted');
    } catch {
      toast.error('Delete failed');
    }
  };

  const handleExport = (conv) => {
    const blob = new Blob([JSON.stringify(conv, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `conversation-${conv._id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = conversations.filter((c) =>
    c.title?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <aside className="flex flex-col h-full bg-background dark:bg-background-dark border-r border-border dark:border-border-dark">
      {/* Header */}
      <div className="p-3 border-b border-border dark:border-border-dark">
        <Button onClick={handleNew} size="sm" className="w-full gap-2 justify-center">
          <Plus className="w-4 h-4" />
          New Chat
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-subtle" />
          <input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search messages…"
            className="w-full h-8 pl-8 pr-7 text-xs rounded bg-border/30 dark:bg-border-dark/40 border border-transparent focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 text-text-primary dark:text-text-dark placeholder:text-text-subtle transition-colors"
          />
          {search && (
            <button onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text-primary transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {search && (
          <p className="text-xs text-text-subtle mt-1.5 pl-1">
            {searchLoading ? 'Searching…' : `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''}`}
          </p>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-4">
        {loading && (
          <div className="space-y-2 px-1 pt-1">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
          </div>
        )}

        {/* Global message search results */}
        {search && !searchLoading && searchResults.length > 0 && (
          <div className="px-1 mb-2">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider px-1 mb-1">Messages</p>
            {searchResults.map((r) => (
              <button
                key={r.message_id}
                onClick={() => {
                  onSelect?.({ _id: r.conversation_id, title: r.conversation_title });
                  setTimeout(() => {
                    const el = document.getElementById(`msg-${r.message_id}`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 300);
                }}
                className="w-full text-left px-2 py-2 rounded-lg hover:bg-border/40 dark:hover:bg-border-dark/60 transition-colors mb-0.5"
              >
                <p className="text-xs font-medium text-primary truncate">{r.conversation_title}</p>
                <p className="text-xs text-text-muted mt-0.5 line-clamp-2 leading-relaxed">{r.content_snippet}</p>
              </button>
            ))}
            <div className="h-px bg-border dark:bg-border-dark my-2" />
          </div>
        )}

        {!loading && !search && conversations.length === 0 && (
          <EmptyState
            icon={MessageSquare}
            title="No conversations"
            description="Start a new chat to begin."
            className="py-12"
          />
        )}

        {!search && <AnimatePresence initial={false}>
          {filtered.map((conv) => (
            <motion.div
              key={conv._id}
              layout
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div
                onClick={() => editingId !== conv._id && onSelect?.(conv)}
                className={cn(
                  'group flex items-center gap-2 w-full px-2 py-2.5 rounded-lg cursor-pointer transition-colors mb-0.5',
                  activeId === conv._id
                    ? 'bg-primary/10 dark:bg-primary/15 border-l-2 border-primary'
                    : 'hover:bg-border/40 dark:hover:bg-border-dark/60 border-l-2 border-transparent',
                )}
              >
                <div className="flex-1 min-w-0">
                  {editingId === conv._id ? (
                    <input
                      ref={editRef}
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => commitRename(conv._id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(conv._id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full text-sm bg-white dark:bg-surface-dark border border-primary rounded px-1 py-0.5 focus:outline-none"
                    />
                  ) : (
                    <>
                      <p className={cn(
                        'text-sm truncate',
                        activeId === conv._id
                          ? 'text-primary font-medium'
                          : 'text-text-primary dark:text-text-dark',
                      )}>
                        {conv.title || 'New conversation'}
                      </p>
                      <p className="text-xs text-text-subtle mt-0.5 truncate">
                        {conv.last_message_at
                          ? formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true })
                          : ''}
                      </p>
                    </>
                  )}
                </div>

                {/* Kebab menu */}
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-border/60 dark:hover:bg-border-dark text-text-muted hover:text-text-primary dark:hover:text-text-dark transition-all"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      className="z-50 w-44 bg-white dark:bg-surface-dark border border-border dark:border-border-dark rounded-lg shadow-xl p-1 animate-fade-in"
                      sideOffset={4}
                      align="end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {[
                        { icon: Pencil,   label: 'Rename',   action: () => startRename(conv),    cls: '' },
                        { icon: Download, label: 'Export',   action: () => handleExport(conv),   cls: '' },
                        { icon: Trash2,   label: 'Delete',   action: () => handleDelete(conv._id), cls: 'text-danger hover:bg-danger/8 dark:hover:bg-danger/15' },
                      ].map(({ icon: Icon, label, action, cls }) => (
                        <DropdownMenu.Item
                          key={label}
                          onSelect={action}
                          className={cn(
                            'flex items-center gap-2 px-2.5 py-2 rounded text-sm cursor-pointer outline-none transition-colors',
                            cls || 'text-text-muted dark:text-slate-400 hover:text-text-primary dark:hover:text-text-dark hover:bg-border/40 dark:hover:bg-border-dark/50',
                          )}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {label}
                        </DropdownMenu.Item>
                      ))}
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>}
      </div>
    </aside>
  );
}
