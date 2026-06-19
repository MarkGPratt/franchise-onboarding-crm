import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useData, Franchisee } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  Plus, Trash2, ArrowLeft, Mail, Phone, MapPin, Calendar, ListChecks,
  FolderOpen, StickyNote, Pin, CheckSquare, Square, FileDown, X,
} from 'lucide-react';
import { Modal, Field } from './LeadsPage';
import OnboardingFlow from './OnboardingFlow';
import DocumentsPage from './DocumentsPage';
import FranchiseeNotesPanel from './FranchiseeNotesPanel';
import BulkExportModal from './BulkExportModal';

type ViewMode = 'process' | 'documents' | 'notes';

interface FranchiseesPageProps {
  /** When provided (e.g. from Notes Search deep link), auto-open this franchisee's notes panel. */
  initialFranchiseeId?: string;
  initialNoteId?: string;
}

interface NoteCounts {
  total: number;
  pinned: number;
}

const FranchiseesPage: React.FC<FranchiseesPageProps> = ({ initialFranchiseeId, initialNoteId }) => {
  const { franchisees, addFranchisee, deleteFranchisee, progress, checklist, divisions } = useData();
  const { addUser, user } = useAuth();
  const [selected, setSelected] = useState<Franchisee | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [noteCounts, setNoteCounts] = useState<Record<string, NoteCounts>>({});
  // Track the note we want to scroll to when entering the notes panel.
  const [pendingNoteId, setPendingNoteId] = useState<string | undefined>(initialNoteId);
  // Bulk selection (admin-only PDF export)
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkExport, setShowBulkExport] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', territory: '',
    startDate: '', password: 'franchisee123', division: '',
  });

  const isStaff = user?.role === 'admin' || user?.role === 'sales';
  const isAdmin = user?.role === 'admin';

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelectedIds(new Set(franchisees.map(f => f.id)));
  const clearSelection = () => setSelectedIds(new Set());
  const exitSelectMode = () => { setSelectMode(false); clearSelection(); };

  const selectedFranchisees = useMemo(
    () => franchisees.filter(f => selectedIds.has(f.id)),
    [franchisees, selectedIds],
  );


  // Honour deep-link props: if a franchisee id is passed in, open notes view for them.
  useEffect(() => {
    if (!initialFranchiseeId) return;
    const f = franchisees.find(x => x.id === initialFranchiseeId);
    if (f) {
      setSelected(f);
      setViewMode('notes');
      setPendingNoteId(initialNoteId);
    }
  }, [initialFranchiseeId, initialNoteId, franchisees]);

  // Fetch the number of internal notes per franchisee (+ pinned count) once on
  // mount so we can render badges on each card. Only staff see notes.
  useEffect(() => {
    if (!isStaff) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('franchisee_notes')
        .select('franchisee_id, pinned');
      if (cancelled || error || !data) return;
      const counts: Record<string, NoteCounts> = {};
      data.forEach((row: any) => {
        const id = row.franchisee_id;
        if (!counts[id]) counts[id] = { total: 0, pinned: 0 };
        counts[id].total += 1;
        if (row.pinned) counts[id].pinned += 1;
      });
      setNoteCounts(counts);
    })();
    return () => { cancelled = true; };
  }, [isStaff, franchisees.length, selected, viewMode]);

  const totalTasks = checklist.reduce((sum, s) => sum + s.tasks.length, 0);
  const getProgress = (id: string) => {
    const fp = progress[id];
    if (!fp) return 0;
    const done = Object.values(fp.tasks).filter(t => t.completed).length;
    return totalTasks ? Math.round((done / totalTasks) * 100) : 0;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const newF = addFranchisee({
      name: form.name,
      email: form.email,
      phone: form.phone,
      territory: form.territory,
      startDate: form.startDate || new Date().toISOString().split('T')[0],
      status: 'active',
      division: form.division,
    });
    addUser({ email: form.email, password: form.password, name: form.name, role: 'franchisee', franchiseeId: newF.id });
    setForm({ name: '', email: '', phone: '', territory: '', startDate: '', password: 'franchisee123', division: '' });
    setShowForm(false);
  };

  const backToList = () => { setSelected(null); setViewMode(null); setPendingNoteId(undefined); };
  const backToChooser = () => { setViewMode(null); setPendingNoteId(undefined); };

  // When a franchisee is viewing this page themselves, skip the chooser and just show their flow
  if (selected && (!isStaff || viewMode === 'process')) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={isStaff ? backToChooser : backToList} className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-[#C41E3A]">
            <ArrowLeft className="h-4 w-4" /> {isStaff ? 'Back to options' : 'Back to Franchisees'}
          </button>
          {isStaff && (
            <span className="text-sm text-gray-500">
              Viewing process flow for <span className="font-semibold text-gray-900">{selected.name}</span>
            </span>
          )}
        </div>
        <OnboardingFlow franchiseeId={selected.id} />
      </div>
    );
  }

  if (selected && viewMode === 'documents') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={backToChooser} className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-[#C41E3A]">
            <ArrowLeft className="h-4 w-4" /> Back to options
          </button>
          <span className="text-sm text-gray-500">
            Viewing documents vault for <span className="font-semibold text-gray-900">{selected.name}</span>
          </span>
        </div>
        <DocumentsPage />
      </div>
    );
  }

  if (selected && viewMode === 'notes' && isStaff) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={backToChooser} className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-[#C41E3A]">
            <ArrowLeft className="h-4 w-4" /> Back to options
          </button>
          <span className="text-sm text-gray-500">
            Internal notes for <span className="font-semibold text-gray-900">{selected.name}</span>
          </span>
        </div>
        <FranchiseeNotesPanel
          franchiseeId={selected.id}
          franchiseeName={selected.name}
          focusNoteId={pendingNoteId}
        />
      </div>
    );
  }

  // Chooser screen — admin/sales picked a franchisee, now picks what to view
  if (selected && isStaff && !viewMode) {
    const pct = getProgress(selected.id);
    const counts = noteCounts[selected.id];
    return (
      <div className="space-y-6 max-w-4xl">
        <button onClick={backToList} className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-[#C41E3A]">
          <ArrowLeft className="h-4 w-4" /> Back to Franchisees
        </button>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[#C41E3A] to-[#1a1a1a] text-white flex items-center justify-center font-bold text-2xl">
              {selected.name.charAt(0)}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">{selected.name}</h1>
              <div className="flex flex-wrap gap-3 text-sm text-gray-500 mt-1">
                {selected.division && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700">{selected.division}</span>
                )}
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {selected.territory}</span>
                <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {selected.email}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 font-semibold">Onboarding</div>
              <div className="text-2xl font-bold text-[#C41E3A]">{pct}%</div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">What would you like to view?</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <button
              onClick={() => setViewMode('process')}
              className="text-left bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg hover:border-[#C41E3A] transition"
            >
              <div className="h-12 w-12 rounded-lg bg-red-50 text-[#C41E3A] flex items-center justify-center mb-4">
                <ListChecks className="h-6 w-6" />
              </div>
              <div className="font-bold text-gray-900 text-lg">Process Flow</div>
              <div className="text-sm text-gray-500 mt-1">View and update this franchisee's onboarding checklist, task progress and section completion.</div>
              <div className="mt-4 text-sm font-semibold text-[#C41E3A]">Open process flow →</div>
            </button>

            <button
              onClick={() => setViewMode('documents')}
              className="text-left bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg hover:border-[#C41E3A] transition"
            >
              <div className="h-12 w-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                <FolderOpen className="h-6 w-6" />
              </div>
              <div className="font-bold text-gray-900 text-lg">Documents Vault</div>
              <div className="text-sm text-gray-500 mt-1">Access the shared documents vault — contracts, training material, branding and franchisee resources.</div>
              <div className="mt-4 text-sm font-semibold text-[#C41E3A]">Open documents vault →</div>
            </button>

            <button
              onClick={() => setViewMode('notes')}
              className="text-left bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg hover:border-amber-500 transition relative"
            >
              {counts && counts.total > 0 && (
                <div className="absolute top-3 right-3 flex items-center gap-1">
                  {counts.pinned > 0 && (
                    <span
                      className="inline-flex items-center gap-1 px-2 h-6 rounded-full bg-amber-600 text-white text-[11px] font-bold shadow"
                      title={`${counts.pinned} pinned note${counts.pinned === 1 ? '' : 's'}`}
                    >
                      <Pin className="h-3 w-3" /> {counts.pinned}
                    </span>
                  )}
                  <span
                    className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-amber-500 text-white text-xs font-bold shadow"
                    title={`${counts.total} internal note${counts.total === 1 ? '' : 's'}`}
                  >
                    {counts.total}
                  </span>
                </div>
              )}
              <div className="h-12 w-12 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
                <StickyNote className="h-6 w-6" />
              </div>
              <div className="font-bold text-gray-900 text-lg">Internal Notes</div>
              <div className="text-sm text-gray-500 mt-1">Private notes visible only to admin and sales staff. Capture observations, follow-ups and context about this franchisee.</div>
              <div className="mt-4 text-sm font-semibold text-amber-600">Open notes →</div>
            </button>
          </div>
        </div>

      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Franchisees</h1>
          <p className="text-gray-500 mt-1">Manage active franchisees and view their onboarding progress.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && !selectMode && (
            <button
              onClick={() => setSelectMode(true)}
              className="border border-gray-200 hover:border-amber-400 hover:bg-amber-50 text-gray-700 hover:text-amber-700 px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2"
              title="Select multiple franchisees to export notes as a combined PDF"
            >
              <CheckSquare className="h-4 w-4" /> Select to export
            </button>
          )}
          {isAdmin && selectMode && (
            <>
              <button
                onClick={selectAll}
                className="text-xs font-semibold text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                Select all
              </button>
              <button
                onClick={clearSelection}
                disabled={selectedIds.size === 0}
                className="text-xs font-semibold text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
              >
                Clear
              </button>
              <button
                onClick={() => setShowBulkExport(true)}
                disabled={selectedIds.size === 0}
                className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2"
              >
                <FileDown className="h-4 w-4" />
                Export selected ({selectedIds.size})
              </button>
              <button
                onClick={exitSelectMode}
                className="text-gray-500 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100"
                title="Cancel selection"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          )}
          <button onClick={() => setShowForm(true)} className="bg-[#C41E3A] hover:bg-[#a01830] text-white px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Franchisee
          </button>
        </div>
      </div>

      {selectMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-900 flex items-center gap-2 flex-wrap">
          <CheckSquare className="h-4 w-4 flex-shrink-0" />
          <span>
            <strong>Selection mode.</strong> Tap a card to add/remove it from your bulk PDF export. The combined PDF will include a table of contents and each franchisee's notes back-to-back.
          </span>
        </div>
      )}

      {franchisees.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
          <p className="text-gray-500">No franchisees yet. Convert a lead from the Leads Pipeline or add one manually.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {franchisees.map(f => {
            const pct = getProgress(f.id);
            const counts = noteCounts[f.id];
            const hasNotes = isStaff && counts && counts.total > 0;
            const isChecked = selectedIds.has(f.id);
            const cardClick = () => {
              if (selectMode) toggleSelected(f.id);
              else { setSelected(f); setViewMode(null); }
            };
            return (
              <div
                key={f.id}
                className={`bg-white rounded-xl border p-5 transition cursor-pointer relative ${
                  selectMode
                    ? isChecked
                      ? 'border-amber-500 ring-2 ring-amber-300 shadow-md'
                      : 'border-gray-200 hover:border-amber-300'
                    : 'border-gray-200 hover:shadow-lg hover:border-[#C41E3A]'
                }`}
                onClick={cardClick}
              >
                {selectMode && (
                  <div className="absolute top-3 left-3">
                    {isChecked ? (
                      <CheckSquare className="h-5 w-5 text-amber-600" />
                    ) : (
                      <Square className="h-5 w-5 text-gray-300" />
                    )}
                  </div>
                )}
                {hasNotes && (
                  <div className="absolute top-3 right-3 flex items-center gap-1">
                    {counts.pinned > 0 && (
                      <span
                        className="inline-flex items-center gap-1 px-2 h-6 rounded-full bg-amber-600 text-white text-[11px] font-bold shadow"
                        title={`${counts.pinned} pinned note${counts.pinned === 1 ? '' : 's'}`}
                      >
                        <Pin className="h-3 w-3" /> {counts.pinned}
                      </span>
                    )}
                    <span
                      className="inline-flex items-center gap-1 px-2 h-6 rounded-full bg-amber-500 text-white text-[11px] font-bold shadow"
                      title={`${counts.total} internal note${counts.total === 1 ? '' : 's'}`}
                    >
                      <StickyNote className="h-3 w-3" /> {counts.total}
                    </span>
                  </div>
                )}
                <div className={`flex items-start justify-between ${selectMode ? 'pl-7' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#C41E3A] to-[#1a1a1a] text-white flex items-center justify-center font-bold text-lg">
                      {f.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">{f.name}</div>
                      <div className="text-xs text-gray-500 capitalize">{f.status}</div>
                    </div>
                  </div>
                  {!selectMode && (
                    <button onClick={async e => { e.stopPropagation(); if (confirm(`Delete ${f.name}? This removes all their onboarding data.`)) { const r = await deleteFranchisee(f.id); if (!r.ok) alert(`Could not delete franchisee.\n\n${r.error || 'Unknown error.'}`); } }} className={`text-gray-400 hover:text-red-600 ${hasNotes ? 'mt-7' : ''}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="mt-4 space-y-1.5 text-sm text-gray-600">
                  {f.division && (
                    <div><span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700">{f.division}</span></div>
                  )}
                  <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-gray-400" /> {f.territory}</div>
                  <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-gray-400" /> <span className="truncate">{f.email}</span></div>
                  <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-gray-400" /> {f.phone}</div>
                  <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-gray-400" /> Started {f.startDate}</div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-gray-500 font-semibold">Onboarding Progress</span>
                    <span className="font-bold text-[#C41E3A]">{pct}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#C41E3A]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <Modal title="Add New Franchisee" onClose={() => setShowForm(false)}>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Full Name"><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" /></Field>
            <Field label="Email (used for login)"><input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input" /></Field>
            <Field label="Login Password"><input required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="input" /></Field>
            <Field label="Phone"><input required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input" /></Field>
            <Field label="Territory"><input required value={form.territory} onChange={e => setForm({ ...form, territory: e.target.value })} className="input" /></Field>
            <Field label="Division">
              <select value={form.division} onChange={e => setForm({ ...form, division: e.target.value })} className="input">
                <option value="">— None —</option>
                {divisions.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Start Date"><input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="input" /></Field>
            <button type="submit" className="w-full bg-[#C41E3A] hover:bg-[#a01830] text-white font-bold py-3 rounded-lg">Create Franchisee + Login</button>
          </form>
          <style>{`.input { width: 100%; padding: 10px 14px; border: 1px solid #d1d5db; border-radius: 8px; outline: none; font-size: 14px; } .input:focus { border-color: #C41E3A; box-shadow: 0 0 0 3px rgba(196,30,58,0.1); }`}</style>
        </Modal>
      )}

      {showBulkExport && (
        <BulkExportModal
          franchiseeIds={selectedFranchisees.map(f => f.id)}
          franchiseeNames={selectedFranchisees.map(f => f.name)}
          onClose={() => setShowBulkExport(false)}
        />
      )}
    </div>
  );
};

export default FranchiseesPage;
