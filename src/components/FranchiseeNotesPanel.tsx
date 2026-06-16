import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  Trash2, StickyNote, Send, Loader2, Pencil, X, Check, AtSign,
  Pin, PinOff, MessageSquare, CornerDownRight, FileDown, Mail,
} from 'lucide-react';
import MentionTextarea from './MentionTextarea';
import BulkExportModal from './BulkExportModal';

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
  pinned_at: string | null;
}

interface Reply {
  id: string;
  note_id: string;
  author_id: string | null;
  author_name: string | null;
  text: string;
  created_at: string;
  mentions: string[] | null;
}

interface Props {
  franchiseeId: string;
  franchiseeName: string;
  /** When provided, scroll/flash that note on mount (used by global notes-search deep link). */
  focusNoteId?: string;
}

const FranchiseeNotesPanel: React.FC<Props> = ({ franchiseeId, franchiseeName, focusNoteId }) => {
  const { user, users } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [text, setText] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [error, setError] = useState<string | null>(null);


  // Per-note edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editMentions, setEditMentions] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  // Reply composer state (per parent note)
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyMentions, setReplyMentions] = useState<string[]>([]);
  const [submittingReply, setSubmittingReply] = useState(false);

  // Refs for scroll-to-note deep linking
  const noteRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const [flashId, setFlashId] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  // Mentionable users = admin + sales (excluding franchisees and self)
  const mentionables = useMemo(
    () => users.filter(u => (u.role === 'admin' || u.role === 'sales') && u.id !== user?.id),
    [users, user?.id],
  );

  const load = async () => {
    setLoading(true);
    setError(null);
    const [notesRes, repliesRes] = await Promise.all([
      supabase
        .from('franchisee_notes')
        .select('*')
        .eq('franchisee_id', franchiseeId)
        .order('created_at', { ascending: false }),
      supabase
        .from('franchisee_note_replies')
        .select('*')
        .in(
          'note_id',
          // Use a subquery via RPC isn't available; instead we fetch by franchisee
          // by joining locally below. For simplicity here we fetch all replies whose
          // note_id matches one of this franchisee's notes — but we don't have the
          // ids yet. Re-fetch replies after notes arrive.
          [],
        ),
    ]);

    if (notesRes.error) {
      setError(notesRes.error.message);
      setLoading(false);
      return;
    }
    const loadedNotes = (notesRes.data || []) as Note[];
    setNotes(loadedNotes);

    if (loadedNotes.length > 0) {
      const { data: replyData, error: replyErr } = await supabase
        .from('franchisee_note_replies')
        .select('*')
        .in('note_id', loadedNotes.map(n => n.id))
        .order('created_at', { ascending: true });
      if (replyErr) setError(replyErr.message);
      else setReplies((replyData || []) as Reply[]);
    } else {
      setReplies([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [franchiseeId]);

  // After notes have loaded, optionally scroll to the focused note.
  useEffect(() => {
    if (!focusNoteId || loading) return;
    const el = noteRefs.current[focusNoteId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFlashId(focusNoteId);
      const t = setTimeout(() => setFlashId(null), 2500);
      return () => clearTimeout(t);
    }
  }, [focusNoteId, loading, notes.length]);

  // Fire-and-forget: email everyone in `mentionIds` about a note or reply.
  const notifyMentions = async (
    mentionIds: string[],
    noteText: string,
    opts: { isReply?: boolean } = {},
  ) => {
    if (!mentionIds.length) return;
    const appUrl = `${window.location.origin}/?franchisee=${franchiseeId}#notes`;
    for (const uid of mentionIds) {
      const u = users.find(x => x.id === uid);
      if (!u?.email) continue;
      try {
        await supabase.functions.invoke('send-notification', {
          body: {
            event_type: 'note_mention',
            recipient_email: u.email,
            recipient_user_id: u.id,
            recipient_name: u.name || u.email,
            variables: {
              franchisee_name: franchiseeName,
              author_name: user?.name || user?.email || 'A teammate',
              note_text: opts.isReply ? `(reply) ${noteText}` : noteText,
              app_url: appUrl,
            },
          },
        });
      } catch (err) {
        console.warn('note_mention email failed for', u.email, err);
      }
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    const { data, error } = await supabase
      .from('franchisee_notes')
      .insert({
        franchisee_id: franchiseeId,
        author_id: user?.id || null,
        author_name: user?.name || user?.email || 'Unknown',
        text: trimmed,
        mentions,
      })
      .select()
      .single();
    if (error) setError(error.message);
    else if (data) {
      setNotes(prev => [data as Note, ...prev]);
      setText('');
      const newMentions = [...mentions];
      setMentions([]);
      notifyMentions(newMentions, trimmed);
    }
    setSubmitting(false);
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this note? All replies will be deleted too.')) return;
    const prev = notes;
    setNotes(prev.filter(n => n.id !== id));
    setReplies(rs => rs.filter(r => r.note_id !== id));
    const { error } = await supabase.from('franchisee_notes').delete().eq('id', id);
    if (error) {
      setError(error.message);
      setNotes(prev);
    }
  };

  const beginEdit = (n: Note) => {
    setEditingId(n.id);
    setEditText(n.text);
    setEditMentions(n.mentions || []);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
    setEditMentions([]);
  };

  const saveEdit = async (n: Note) => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    setSavingEdit(true);
    setError(null);
    const updatedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from('franchisee_notes')
      .update({ text: trimmed, mentions: editMentions, updated_at: updatedAt })
      .eq('id', n.id)
      .select()
      .single();
    if (error) setError(error.message);
    else if (data) {
      setNotes(prev => prev.map(x => x.id === n.id ? (data as Note) : x));
      const previously = new Set(n.mentions || []);
      const newlyMentioned = editMentions.filter(id => !previously.has(id));
      notifyMentions(newlyMentioned, trimmed);
      cancelEdit();
    }
    setSavingEdit(false);
  };

  const togglePin = async (n: Note) => {
    const next = !n.pinned;
    const pinned_at = next ? new Date().toISOString() : null;
    // Optimistic
    setNotes(prev => prev.map(x => x.id === n.id ? { ...x, pinned: next, pinned_at } : x));
    const { error } = await supabase
      .from('franchisee_notes')
      .update({ pinned: next, pinned_at })
      .eq('id', n.id);
    if (error) {
      setError(error.message);
      // Revert
      setNotes(prev => prev.map(x => x.id === n.id ? n : x));
    }
  };

  // ----- Replies -----
  const beginReply = (noteId: string) => {
    setReplyingTo(noteId);
    setReplyText('');
    setReplyMentions([]);
  };
  const cancelReply = () => {
    setReplyingTo(null);
    setReplyText('');
    setReplyMentions([]);
  };
  const submitReply = async (noteId: string) => {
    const trimmed = replyText.trim();
    if (!trimmed) return;
    setSubmittingReply(true);
    const { data, error } = await supabase
      .from('franchisee_note_replies')
      .insert({
        note_id: noteId,
        author_id: user?.id || null,
        author_name: user?.name || user?.email || 'Unknown',
        text: trimmed,
        mentions: replyMentions,
      })
      .select()
      .single();
    if (error) setError(error.message);
    else if (data) {
      setReplies(prev => [...prev, data as Reply]);
      const mentioned = [...replyMentions];
      notifyMentions(mentioned, trimmed, { isReply: true });
      cancelReply();
    }
    setSubmittingReply(false);
  };
  const removeReply = async (r: Reply) => {
    if (!confirm('Delete this reply?')) return;
    const prev = replies;
    setReplies(prev.filter(x => x.id !== r.id));
    const { error } = await supabase.from('franchisee_note_replies').delete().eq('id', r.id);
    if (error) {
      setError(error.message);
      setReplies(prev);
    }
  };

  // Export all notes + replies for this franchisee as a print-ready PDF
  // via the export-franchisee-notes-pdf edge function.
  const exportPdf = async () => {
    setExporting(true);
    setError(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke(
        'export-franchisee-notes-pdf',
        {
          body: { franchisee_id: franchiseeId },
          // Critical: tell supabase-js to keep the response as a Blob,
          // otherwise it will try to JSON.parse the binary PDF and corrupt it.
          headers: { Accept: 'application/pdf' },
        },
      );
      if (invokeErr) throw invokeErr;
      // `data` may come back as Blob, ArrayBuffer, or already-parsed JSON
      // depending on supabase-js version — normalise to Blob.
      let blob: Blob;
      if (data instanceof Blob) {
        blob = data;
      } else if (data instanceof ArrayBuffer) {
        blob = new Blob([data], { type: 'application/pdf' });
      } else if (typeof data === 'string') {
        // Some setups return the raw PDF text — wrap it.
        blob = new Blob([data], { type: 'application/pdf' });
      } else if (data && typeof data === 'object' && 'error' in data) {
        throw new Error((data as { error: string }).error);
      } else {
        // Fallback: stringify so user at least gets something downloadable
        blob = new Blob([JSON.stringify(data)], { type: 'application/pdf' });
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safe = franchiseeName.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60) || 'franchisee';
      const today = new Date().toISOString().slice(0, 10);
      a.download = `notes-${safe}-${today}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('Export PDF failed:', err);
      setError(`Could not generate PDF: ${(err as Error).message || 'unknown error'}`);
    } finally {
      setExporting(false);
    }
  };


  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  };
  const canEditNote = (n: Note) =>
    user && (user.role === 'admin' || n.author_id === user.id);
  const canDeleteReply = (r: Reply) =>
    user && (user.role === 'admin' || r.author_id === user.id);

  // Render note/reply text with @mentions highlighted
  const renderText = (txt: string) => {
    const parts = txt.split(/(@[A-Za-z0-9_]+)/g);
    return parts.map((p, i) => {
      if (/^@[A-Za-z0-9_]+$/.test(p)) {
        const handle = p.slice(1).replace(/_/g, ' ').toLowerCase();
        const matched = users.find(u => (u.name || '').toLowerCase() === handle);
        if (matched) {
          return (
            <span key={i} className="bg-amber-100 text-amber-800 font-semibold rounded px-1">
              @{matched.name}
            </span>
          );
        }
      }
      return <span key={i}>{p}</span>;
    });
  };

  // Sort: pinned first (by pinned_at desc), then by created_at desc
  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.pinned && b.pinned) {
        return (b.pinned_at || '').localeCompare(a.pinned_at || '');
      }
      return b.created_at.localeCompare(a.created_at);
    });
  }, [notes]);

  const pinnedNotes = sortedNotes.filter(n => n.pinned);
  const otherNotes = sortedNotes.filter(n => !n.pinned);

  // ----- Render -----
  const renderNoteCard = (n: Note) => {
    const editing = editingId === n.id;
    const canModify = canEditNote(n);
    const isFlashing = flashId === n.id;
    const noteReplies = replies.filter(r => r.note_id === n.id);
    const isReplying = replyingTo === n.id;

    return (
      <li
        key={n.id}
        ref={el => { noteRefs.current[n.id] = el; }}
        className={[
          'rounded-xl p-4 transition',
          n.pinned ? 'bg-amber-50/40 border-2 border-amber-400' : 'bg-white border border-gray-200',
          isFlashing ? 'ring-4 ring-amber-300 shadow-lg' : '',
        ].join(' ')}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm">
              {(n.author_name || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                {n.author_name || 'Unknown'}
                {n.pinned && (
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    <Pin className="h-3 w-3" /> Pinned
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 flex items-center gap-2">
                {fmt(n.created_at)}
                {n.updated_at && (
                  <span
                    className="text-[10px] uppercase tracking-wide font-bold text-gray-400"
                    title={`Last edited ${fmt(n.updated_at)}`}
                  >
                    · edited
                  </span>
                )}
              </div>
            </div>
          </div>
          {!editing && (
            <div className="flex items-center gap-1">
              {isAdmin && (
                <button
                  onClick={() => togglePin(n)}
                  className={`hover:text-amber-600 ${n.pinned ? 'text-amber-600' : 'text-gray-300'}`}
                  title={n.pinned ? 'Unpin note' : 'Pin note to top'}
                >
                  {n.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                </button>
              )}
              {canModify && (
                <>
                  <button onClick={() => beginEdit(n)} className="text-gray-300 hover:text-amber-600" title="Edit note">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove(n.id)} className="text-gray-300 hover:text-red-600" title="Delete note">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {editing ? (
          <div className="mt-3 space-y-2">
            <MentionTextarea
              value={editText}
              onChange={(v, m) => { setEditText(v); setEditMentions(m); }}
              users={mentionables}
              rows={3}
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 text-sm resize-y"
            />
            <div className="flex items-center justify-end gap-2">
              <button onClick={cancelEdit} disabled={savingEdit} className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center gap-1">
                <X className="h-4 w-4" /> Cancel
              </button>
              <button onClick={() => saveEdit(n)} disabled={savingEdit || !editText.trim()} className="text-sm bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1">
                {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-700 whitespace-pre-wrap">{renderText(n.text)}</p>
        )}

        {/* Reply button + thread */}
        {!editing && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <button
                onClick={() => (isReplying ? cancelReply() : beginReply(n.id))}
                className="text-xs font-semibold text-amber-700 hover:text-amber-900 flex items-center gap-1"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                {isReplying ? 'Cancel reply' : 'Reply'}
                {noteReplies.length > 0 && (
                  <span className="ml-1 text-gray-500 font-normal">· {noteReplies.length} {noteReplies.length === 1 ? 'reply' : 'replies'}</span>
                )}
              </button>
            </div>

            {noteReplies.length > 0 && (
              <ul className="mt-3 space-y-2 pl-4 border-l-2 border-amber-200">
                {noteReplies.map(r => (
                  <li key={r.id} className="bg-white border border-gray-100 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CornerDownRight className="h-3 w-3 text-amber-500 flex-shrink-0" />
                        <div className="h-7 w-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                          {(r.author_name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 text-xs">{r.author_name || 'Unknown'}</div>
                          <div className="text-[11px] text-gray-500">{fmt(r.created_at)}</div>
                        </div>
                      </div>
                      {canDeleteReply(r) && (
                        <button onClick={() => removeReply(r)} className="text-gray-300 hover:text-red-600" title="Delete reply">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap pl-7">{renderText(r.text)}</p>
                  </li>
                ))}
              </ul>
            )}

            {isReplying && (
              <div className="mt-3 pl-4 border-l-2 border-amber-200 space-y-2">
                <MentionTextarea
                  value={replyText}
                  onChange={(v, m) => { setReplyText(v); setReplyMentions(m); }}
                  users={mentionables}
                  rows={2}
                  autoFocus
                  placeholder="Write a reply… Type @ to mention a teammate."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 text-sm resize-y"
                />
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-[11px] text-gray-400 flex items-center gap-2">
                    <AtSign className="h-3 w-3" /> Type @ to mention
                    {replyMentions.length > 0 && (
                      <span className="text-amber-700 font-semibold">
                        {replyMentions.length} mention{replyMentions.length === 1 ? '' : 's'} — emails will be sent
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={cancelReply} className="text-xs text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
                      Cancel
                    </button>
                    <button
                      onClick={() => submitReply(n.id)}
                      disabled={submittingReply || !replyText.trim()}
                      className="text-xs bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1"
                    >
                      {submittingReply ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Post reply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <StickyNote className="h-5 w-5 text-amber-600" />
          <h2 className="font-bold text-gray-900">Add an internal note about {franchiseeName}</h2>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <MentionTextarea
            value={text}
            onChange={(v, m) => { setText(v); setMentions(m); }}
            users={mentionables}
            placeholder="These notes are private to admin and sales staff. Type @ to mention a teammate."
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#C41E3A] focus:ring-2 focus:ring-[#C41E3A]/10 text-sm resize-y"
          />
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs text-gray-400 flex items-center gap-3">
              <span>{user ? `Posting as ${user.name || user.email} (${user.role})` : ''}</span>
              <span className="flex items-center gap-1 text-amber-600">
                <AtSign className="h-3 w-3" /> Type @ to mention
              </span>
              {mentions.length > 0 && (
                <span className="text-amber-700 font-semibold">
                  {mentions.length} mention{mentions.length === 1 ? '' : 's'} — emails will be sent
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={submitting || !text.trim()}
              className="bg-[#C41E3A] hover:bg-[#a01830] disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg font-semibold text-sm flex items-center gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Save Note
            </button>
          </div>
        </form>
        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-gray-900">Notes history</h3>
            <span className="text-xs text-gray-500">
              {notes.length} {notes.length === 1 ? 'note' : 'notes'}
              {pinnedNotes.length > 0 && <> · {pinnedNotes.length} pinned</>}
              {replies.length > 0 && <> · {replies.length} {replies.length === 1 ? 'reply' : 'replies'}</>}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportPdf}
              disabled={exporting || loading || notes.length === 0}
              title={notes.length === 0 ? 'No notes to export yet' : 'Download a print-ready PDF of all notes and replies'}
              className="inline-flex items-center gap-2 text-xs font-semibold border border-gray-200 hover:border-amber-400 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 hover:text-amber-700 px-3 py-2 rounded-lg transition"
            >
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
              {exporting ? 'Generating PDF…' : 'Export notes to PDF'}
            </button>
            <button
              type="button"
              onClick={() => setShowEmailModal(true)}
              disabled={loading || notes.length === 0}
              title={notes.length === 0 ? 'No notes to email yet' : 'Email the PDF to teammates instead of downloading'}
              className="inline-flex items-center gap-2 text-xs font-semibold border border-gray-200 hover:border-amber-400 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 hover:text-amber-700 px-3 py-2 rounded-lg transition"
            >
              <Mail className="h-3.5 w-3.5" /> Email PDF
            </button>
          </div>
        </div>

        {showEmailModal && (
          <BulkExportModal
            franchiseeIds={[franchiseeId]}
            franchiseeNames={[franchiseeName]}
            onClose={() => setShowEmailModal(false)}
          />
        )}

        {loading ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 flex items-center justify-center text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading notes…
          </div>
        ) : notes.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center text-sm text-gray-500">
            No notes yet. Add the first one above.
          </div>
        ) : (
          <div className="space-y-5">
            {pinnedNotes.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2 text-xs uppercase tracking-wider font-bold text-amber-700">
                  <Pin className="h-3.5 w-3.5" /> Pinned
                </div>
                <ul className="space-y-3">{pinnedNotes.map(renderNoteCard)}</ul>
              </div>
            )}
            {otherNotes.length > 0 && (
              <div>
                {pinnedNotes.length > 0 && (
                  <div className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-2">All notes</div>
                )}
                <ul className="space-y-3">{otherNotes.map(renderNoteCard)}</ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FranchiseeNotesPanel;
