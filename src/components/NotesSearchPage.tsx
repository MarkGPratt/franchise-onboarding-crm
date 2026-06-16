import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Search, Loader2, StickyNote, AtSign, ArrowRight, Pin, Filter, X } from 'lucide-react';

interface Note {
  id: string;
  franchisee_id: string;
  author_id: string | null;
  author_name: string | null;
  text: string;
  created_at: string;
  updated_at: string | null;
  mentions: string[] | null;
  pinned: boolean;
}

interface Props {
  onJumpToNote: (franchiseeId: string, noteId: string) => void;
}

const NotesSearchPage: React.FC<Props> = ({ onJumpToNote }) => {
  const { user, users } = useAuth();
  const { franchisees } = useData();
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [query, setQuery] = useState('');
  const [authorId, setAuthorId] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [mentionsMe, setMentionsMe] = useState(false);

  const isStaff = user?.role === 'admin' || user?.role === 'sales';

  useEffect(() => {
    if (!isStaff) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('franchisee_notes')
        .select('*')
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) setError(error.message);
      else setAllNotes((data || []) as Note[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isStaff]);

  const franchiseeById = useMemo(() => {
    const m: Record<string, { id: string; name: string }> = {};
    franchisees.forEach(f => { m[f.id] = { id: f.id, name: f.name }; });
    return m;
  }, [franchisees]);

  // List of distinct authors who have written notes (for the author filter)
  const authors = useMemo(() => {
    const map = new Map<string, string>();
    allNotes.forEach(n => {
      if (n.author_id) {
        map.set(n.author_id, n.author_name || 'Unknown');
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [allNotes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromT = fromDate ? new Date(fromDate + 'T00:00:00').getTime() : null;
    const toT = toDate ? new Date(toDate + 'T23:59:59').getTime() : null;

    return allNotes.filter(n => {
      if (q) {
        const haystack = `${n.text} ${n.author_name || ''} ${franchiseeById[n.franchisee_id]?.name || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (authorId !== 'all' && n.author_id !== authorId) return false;
      if (fromT && new Date(n.created_at).getTime() < fromT) return false;
      if (toT && new Date(n.created_at).getTime() > toT) return false;
      if (mentionsMe && user) {
        if (!(n.mentions || []).includes(user.id)) return false;
      }
      return true;
    });
  }, [allNotes, query, authorId, fromDate, toDate, mentionsMe, user, franchiseeById]);

  const clearFilters = () => {
    setQuery(''); setAuthorId('all'); setFromDate(''); setToDate(''); setMentionsMe(false);
  };

  const hasActiveFilters =
    query.trim() !== '' || authorId !== 'all' || fromDate !== '' || toDate !== '' || mentionsMe;

  // Build a snippet around the first match, with the matched substring highlighted.
  const renderSnippet = (text: string, q: string) => {
    if (!q) {
      const short = text.length > 220 ? text.slice(0, 220) + '…' : text;
      return <span>{renderMentionHighlights(short)}</span>;
    }
    const lower = text.toLowerCase();
    const idx = lower.indexOf(q.toLowerCase());
    if (idx === -1) {
      const short = text.length > 220 ? text.slice(0, 220) + '…' : text;
      return <span>{renderMentionHighlights(short)}</span>;
    }
    const start = Math.max(0, idx - 60);
    const end = Math.min(text.length, idx + q.length + 120);
    const before = (start > 0 ? '… ' : '') + text.slice(start, idx);
    const match = text.slice(idx, idx + q.length);
    const after = text.slice(idx + q.length, end) + (end < text.length ? ' …' : '');
    return (
      <span>
        {renderMentionHighlights(before)}
        <mark className="bg-yellow-200 text-gray-900 rounded px-0.5 font-semibold">{match}</mark>
        {renderMentionHighlights(after)}
      </span>
    );
  };

  // Highlight @mentions inside a snippet fragment
  const renderMentionHighlights = (txt: string) => {
    const parts = txt.split(/(@[A-Za-z0-9_]+)/g);
    return parts.map((p, i) => {
      if (/^@[A-Za-z0-9_]+$/.test(p)) {
        const handle = p.slice(1).replace(/_/g, ' ').toLowerCase();
        const matched = users.find(u => (u.name || '').toLowerCase() === handle);
        if (matched) {
          return <span key={i} className="bg-amber-100 text-amber-800 font-semibold rounded px-1">@{matched.name}</span>;
        }
      }
      return <span key={i}>{p}</span>;
    });
  };

  if (!isStaff) {
    return (
      <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center text-gray-500">
        Internal notes search is only available to admin and sales staff.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Search className="h-7 w-7 text-amber-600" /> Internal Notes Search
        </h1>
        <p className="text-gray-500 mt-1">Search internal notes across every franchisee. Use filters to narrow by author, date, or mentions of you.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search note text, author or franchisee name…"
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 text-sm"
            autoFocus
          />
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Author</label>
            <select
              value={authorId}
              onChange={e => setAuthorId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-amber-500"
            >
              <option value="all">All authors</option>
              {authors.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">From date</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">To date</label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 cursor-pointer hover:bg-amber-50 text-sm w-full">
              <input
                type="checkbox"
                checked={mentionsMe}
                onChange={e => setMentionsMe(e.target.checked)}
                className="accent-amber-600"
              />
              <AtSign className="h-4 w-4 text-amber-600" />
              <span className="font-medium text-gray-700">Mentions me</span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="text-gray-500 flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" />
            {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
            {hasActiveFilters && ' (filtered)'}
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-amber-700 hover:text-amber-900 font-semibold flex items-center gap-1"
            >
              <X className="h-3.5 w-3.5" /> Clear filters
            </button>
          )}
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {loading ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 flex items-center justify-center text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading notes…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center text-sm text-gray-500">
          {allNotes.length === 0
            ? 'There are no internal notes yet. Add notes from a franchisee profile.'
            : 'No notes match your search and filters.'}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map(n => {
            const f = franchiseeById[n.franchisee_id];
            return (
              <li
                key={n.id}
                className={[
                  'rounded-xl p-5 transition hover:shadow-md',
                  n.pinned ? 'bg-amber-50/40 border-2 border-amber-400' : 'bg-white border border-gray-200',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#C41E3A] to-[#1a1a1a] text-white flex items-center justify-center font-bold flex-shrink-0">
                      {(f?.name || '?').charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-gray-900 truncate flex items-center gap-2">
                        {f?.name || 'Unknown franchisee'}
                        {n.pinned && (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                            <Pin className="h-3 w-3" /> Pinned
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        by <span className="font-semibold text-gray-700">{n.author_name || 'Unknown'}</span>
                        {' · '}
                        {new Date(n.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                        {n.updated_at && <span className="ml-1 text-[10px] uppercase tracking-wide font-bold text-gray-400">· edited</span>}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onJumpToNote(n.franchisee_id, n.id)}
                    className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg font-semibold flex items-center gap-1 flex-shrink-0"
                    disabled={!f}
                    title={f ? 'Open this note in the franchisee notes panel' : 'Franchisee no longer exists'}
                  >
                    Open <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-3 flex items-start gap-2 text-sm text-gray-700">
                  <StickyNote className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="whitespace-pre-wrap">{renderSnippet(n.text, query.trim())}</p>
                </div>

                {n.mentions && n.mentions.length > 0 && (
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-700 flex-wrap">
                    <AtSign className="h-3 w-3" />
                    <span className="font-semibold">Mentions:</span>
                    {n.mentions.map(uid => {
                      const u = users.find(x => x.id === uid);
                      if (!u) return null;
                      return (
                        <span key={uid} className="bg-amber-100 text-amber-800 font-semibold rounded-full px-2 py-0.5">
                          @{u.name || u.email}
                        </span>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default NotesSearchPage;
