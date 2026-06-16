import React, { useRef, useState, useEffect } from 'react';
import { DefaultUser } from '@/contexts/AuthContext';

interface Props {
  value: string;
  onChange: (value: string, mentionIds: string[]) => void;
  users: DefaultUser[];           // candidate mentionable users (admin/sales)
  placeholder?: string;
  rows?: number;
  className?: string;
  autoFocus?: boolean;
}

/**
 * Textarea with @-mention autocomplete. Detects an @-token at the caret,
 * shows a dropdown of matching users, and reports the resolved set of
 * mentioned user IDs (by re-parsing the textarea for @<token> markers) to
 * the parent on every change.
 *
 * The token written into the text is the user's name with spaces replaced
 * by underscores, e.g. `@Alice_Smith`, so we can reliably round-trip parse.
 */
const MentionTextarea: React.FC<Props> = ({
  value, onChange, users, placeholder, rows = 3, className = '', autoFocus,
}) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null); // current @-token text, or null
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

  // Re-parse text -> list of mentioned user IDs (best-effort).
  const computeMentions = (text: string): string[] => {
    const ids = new Set<string>();
    const tokens = text.match(/@[A-Za-z0-9_]+/g) || [];
    tokens.forEach(tok => {
      const handle = tok.slice(1).replace(/_/g, ' ').toLowerCase();
      users.forEach(u => {
        if ((u.name || '').toLowerCase() === handle) ids.add(u.id);
      });
    });
    return Array.from(ids);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const caret = e.target.selectionStart || text.length;
    // Look back from caret for a token starting with @
    const upto = text.slice(0, caret);
    const m = upto.match(/(?:^|\s)@([A-Za-z0-9_]*)$/);
    setQuery(m ? m[1] : null);
    setActiveIdx(0);
    onChange(text, computeMentions(text));
  };

  const candidates = query == null
    ? []
    : users
        .filter(u => (u.name || u.email).toLowerCase().includes(query.toLowerCase()))
        .slice(0, 6);

  const insertMention = (u: DefaultUser) => {
    const ta = ref.current;
    if (!ta) return;
    const caret = ta.selectionStart || value.length;
    const upto = value.slice(0, caret);
    const after = value.slice(caret);
    const handle = (u.name || u.email).replace(/\s+/g, '_');
    const replaced = upto.replace(/(^|\s)@[A-Za-z0-9_]*$/, (_m, lead) => `${lead}@${handle} `);
    const next = replaced + after;
    onChange(next, computeMentions(next));
    setQuery(null);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = replaced.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (query == null || candidates.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => (i + 1) % candidates.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => (i - 1 + candidates.length) % candidates.length); }
    else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertMention(candidates[activeIdx]);
    } else if (e.key === 'Escape') {
      setQuery(null);
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKey}
        placeholder={placeholder}
        rows={rows}
        className={className}
      />
      {query != null && candidates.length > 0 && (
        <div className="absolute z-20 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden w-72 max-h-60 overflow-y-auto">
          <div className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-wide bg-gray-50 text-gray-500 border-b">
            Mention a teammate
          </div>
          {candidates.map((u, i) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={e => { e.preventDefault(); insertMention(u); }}
              className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm hover:bg-amber-50 ${i === activeIdx ? 'bg-amber-50' : ''}`}
            >
              <div className="h-7 w-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">
                {(u.name || u.email).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 truncate">{u.name || u.email}</div>
                <div className="text-[11px] text-gray-500 capitalize">{u.role}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MentionTextarea;
