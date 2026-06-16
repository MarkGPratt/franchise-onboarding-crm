import React, { useRef, useState } from 'react';
import { useData, DocumentVisibility, DocumentItem } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  Upload, Trash2, FileText, Download, Search, Loader2, AlertCircle,
  Users, Building2, Globe, Pencil, User as UserIcon, Library, Info,
} from 'lucide-react';
import { Modal, Field } from './LeadsPage';
import { ACCEPT_ATTR, MAX_FILE_SIZE_MB, downloadFile, validateFile } from '@/lib/uploads';
import EditDocumentModal, { isDocumentEditable } from './EditDocumentModal';


const VISIBILITY_LABELS: Record<DocumentVisibility, { label: string; description: string; color: string; icon: React.ReactNode }> = {
  all: {
    label: 'Everyone',
    description: 'Visible to admins, sales staff and all franchisees',
    color: 'bg-green-100 text-green-700 border-green-200',
    icon: <Globe className="h-3.5 w-3.5" />,
  },
  staff: {
    label: 'Admin & Sales only',
    description: 'Internal — only admin and sales staff can see this document',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: <Building2 className="h-3.5 w-3.5" />,
  },
  franchisee: {
    label: 'Franchisees only',
    description: 'Visible to admin and franchisees (not visible to sales)',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: <Users className="h-3.5 w-3.5" />,
  },
};

const DocumentsPage: React.FC = () => {
  const { documents, documentsLoading, uploadDocument, removeDocument, franchisees } = useData();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [filterVis, setFilterVis] = useState<'all' | DocumentVisibility>('all');
  const [filterFranchisee, setFilterFranchisee] = useState<string>('all'); // 'all' | 'global' | <franchiseeId>
  const [category, setCategory] = useState('Legal');
  const [visibility, setVisibility] = useState<DocumentVisibility>('all');
  const [targetFranchiseeId, setTargetFranchiseeId] = useState<string>(''); // empty = global
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingDoc, setEditingDoc] = useState<DocumentItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.role === 'admin';
  const role = user?.role;
  const categories = ['Legal', 'Operations', 'Marketing', 'Branding', 'Training', 'Finance'];

  const franchiseeById = (id?: string) => id ? franchisees.find(f => f.id === id) : undefined;

  // Role-based + franchisee-scoped access:
  //  - admin sees everything
  //  - sales sees 'all' + 'staff' (and only global, no franchisee-scoped docs)
  //  - franchisee sees docs that are global OR assigned to their franchisee id,
  //    AND visibility must allow them ('all' or 'franchisee')
  const canView = (d: DocumentItem): boolean => {
    if (role === 'admin') return true;
    if (role === 'sales') {
      if (d.franchiseeId) return false; // franchisee-specific docs hidden from sales
      return d.visibility === 'all' || d.visibility === 'staff';
    }
    if (role === 'franchisee') {
      const myId = user?.franchiseeId;
      // global doc OR a doc assigned to me
      const scopeOk = !d.franchiseeId || d.franchiseeId === myId;
      const visOk = d.visibility === 'all' || d.visibility === 'franchisee';
      return scopeOk && visOk;
    }
    return false;
  };

  const visible = documents.filter(canView);

  const filtered = visible.filter(d => {
    if (filterCat !== 'all' && d.category !== filterCat) return false;
    if (filterVis !== 'all' && d.visibility !== filterVis) return false;
    if (isAdmin && filterFranchisee !== 'all') {
      if (filterFranchisee === 'global') {
        if (d.franchiseeId) return false;
      } else if (d.franchiseeId !== filterFranchisee) {
        return false;
      }
    }
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const onFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const f = e.target.files?.[0] || null;
    if (f) {
      const v = validateFile(f);
      if (!v.ok) {
        setError(v.error || 'Invalid file');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }
    setSelectedFile(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please choose a file to upload.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      // If a franchisee is selected, force visibility to 'franchisee' so sales
      // can't see other franchisees' private docs.
      const finalVisibility: DocumentVisibility = targetFranchiseeId ? 'franchisee' : visibility;
      await uploadDocument(
        selectedFile,
        category,
        user?.name || 'Admin',
        finalVisibility,
        targetFranchiseeId || null,
        null,
      );
      setSelectedFile(null);
      setCategory('Legal');
      setVisibility('all');
      setTargetFranchiseeId('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setShowForm(false);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, filePath: string, name: string) => {
    if (!confirm(`Delete ${name}? This permanently removes the file from storage.`)) return;
    setDeletingId(id);
    try {
      await removeDocument(id, filePath);
    } catch (err: any) {
      alert('Delete failed: ' + (err.message || 'Unknown error'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (url: string, name: string) => {
    await downloadFile(url, name);
  };

  // A franchisee can edit any document they can see; staff can edit any doc.
  const canEdit = (d: DocumentItem): boolean => {
    if (!isDocumentEditable(d)) return false;
    if (role === 'admin') return true;
    if (role === 'franchisee') return true; // creates a personal edited copy
    if (role === 'sales') return false;
    return false;
  };

  // Counts for the master library banner (franchisee-facing)
  const masterDocsCount = visible.filter(d => !d.franchiseeId).length;
  const personalDocsCount = role === 'franchisee'
    ? visible.filter(d => d.franchiseeId === user?.franchiseeId).length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Document Vault</h1>
          <p className="text-gray-500 mt-1">
            {role === 'franchisee'
              ? 'Master documents from head office are automatically synced to your vault, plus any documents assigned just to you.'
              : 'Central repository with role-based access control. Master documents (not assigned to a franchisee) automatically sync to every franchisee\'s vault.'}
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => { setShowForm(true); setError(null); }} className="bg-[#C41E3A] hover:bg-[#a01830] text-white px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2">
            <Upload className="h-4 w-4" /> Upload Document
          </button>
        )}
      </div>

      {role === 'franchisee' && (
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Library className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Master Library</div>
              <div className="text-sm text-gray-700">
                <span className="font-bold text-gray-900">{masterDocsCount}</span> document{masterDocsCount === 1 ? '' : 's'} synced from head office
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-white border border-purple-200 rounded-xl p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
              <UserIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Assigned to you</div>
              <div className="text-sm text-gray-700">
                <span className="font-bold text-gray-900">{personalDocsCount}</span> document{personalDocsCount === 1 ? '' : 's'} for you specifically
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents..." className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:border-[#C41E3A]" />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:border-[#C41E3A]">
          <option value="all">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {isAdmin && (
          <>
            <select value={filterVis} onChange={e => setFilterVis(e.target.value as any)} className="px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:border-[#C41E3A]">
              <option value="all">All Access Levels</option>
              <option value="all">Everyone</option>
              <option value="staff">Admin &amp; Sales only</option>
              <option value="franchisee">Franchisees only</option>
            </select>
            <select
              value={filterFranchisee}
              onChange={e => setFilterFranchisee(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:border-[#C41E3A]"
              title="Filter by franchisee"
            >
              <option value="all">All Franchisees</option>
              <option value="global">Global (not franchisee-specific)</option>
              {franchisees.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Document</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Category</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Access</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Assigned to</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Size</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Uploaded</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {documentsLoading && (
              <tr><td colSpan={7} className="text-center py-12 text-gray-500"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Loading documents...</td></tr>
            )}
            {!documentsLoading && filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center py-12 text-gray-500">No documents found.</td></tr>
            )}
            {!documentsLoading && filtered.map(d => {
              const vis = VISIBILITY_LABELS[d.visibility] || VISIBILITY_LABELS.all;
              const fr = franchiseeById(d.franchiseeId);
              const editable = canEdit(d);
              return (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-red-50 text-[#C41E3A] flex items-center justify-center"><FileText className="h-5 w-5" /></div>
                      <div>
                        <div className="font-semibold text-gray-900 flex items-center gap-2">
                          {d.name}
                          {d.parentDocumentId && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wide">
                              Edited
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">by {d.uploadedBy}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4"><span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">{d.category}</span></td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${vis.color}`} title={vis.description}>
                      {vis.icon} {vis.label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {fr ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold">
                        <UserIcon className="h-3 w-3" /> {fr.name}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold" title="Master document — synced to every franchisee's vault">
                        <Library className="h-3 w-3" /> Master library
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-700">{d.size}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(d.uploadedAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {editable && (
                        <button
                          onClick={() => setEditingDoc(d)}
                          title={role === 'franchisee' ? 'Open & edit (saved as your own copy)' : 'Open & edit'}
                          className="text-gray-400 hover:text-[#C41E3A]"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      <button onClick={() => handleDownload(d.url, d.name)} title="Download" className="text-gray-400 hover:text-[#C41E3A]"><Download className="h-4 w-4" /></button>
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(d.id, d.filePath, d.name)}
                          disabled={deletingId === d.id}
                          title="Delete"
                          className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                        >
                          {deletingId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title="Upload Document" onClose={() => { if (!uploading) { setShowForm(false); setSelectedFile(null); setError(null); } }}>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Category">
              <select value={category} onChange={e => setCategory(e.target.value)} className="input" disabled={uploading}>
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>

            <Field label="Assign to a specific franchisee (optional)">
              <select
                value={targetFranchiseeId}
                onChange={e => setTargetFranchiseeId(e.target.value)}
                className="input"
                disabled={uploading}
              >
                <option value="">No — keep as a master document (synced to every franchisee's vault)</option>
                {franchisees.map(f => (
                  <option key={f.id} value={f.id}>{f.name}{f.territory ? ` — ${f.territory}` : ''}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1.5">
                {targetFranchiseeId
                  ? 'When a franchisee is selected, the document will only be visible to that franchisee and to admins. It will not appear in any other franchisee\'s vault.'
                  : 'Master documents (no franchisee selected) automatically appear in every franchisee\'s document vault — choose "Everyone" or "Franchisees only" below to control who can see it.'}
              </p>
            </Field>


            <Field label="Who can view this document?">
              <div className="space-y-2">
                {(Object.keys(VISIBILITY_LABELS) as DocumentVisibility[]).map(v => {
                  const meta = VISIBILITY_LABELS[v];
                  const active = visibility === v;
                  const lockedByFranchisee = !!targetFranchiseeId;
                  const disabled = uploading || lockedByFranchisee;
                  return (
                    <label
                      key={v}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${active && !lockedByFranchisee ? 'border-[#C41E3A] bg-red-50' : 'border-gray-200 hover:border-gray-300'} ${disabled ? 'opacity-60' : ''}`}
                    >
                      <input
                        type="radio"
                        name="visibility"
                        value={v}
                        checked={active}
                        onChange={() => setVisibility(v)}
                        disabled={disabled}
                        className="mt-1 accent-[#C41E3A]"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                          {meta.icon} {meta.label}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{meta.description}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
              {targetFranchiseeId && (
                <p className="text-xs text-amber-700 mt-2 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                  Access level is locked to <strong>Franchisee only</strong> when the document is assigned to a specific franchisee.
                </p>
              )}
            </Field>

            <Field label="File">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_ATTR}
                onChange={onFilePick}
                className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#1a1a1a] file:text-white hover:file:bg-[#333]"
                disabled={uploading}
              />
              <p className="text-xs text-gray-500 mt-1.5">Max {MAX_FILE_SIZE_MB} MB. PDF, Office, images, video, and archive formats accepted.</p>
              {selectedFile && (
                <div className="mt-2 px-3 py-2 bg-gray-50 rounded border border-gray-200 text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#C41E3A]" />
                  <span className="flex-1 truncate">{selectedFile.name}</span>
                  <span className="text-xs text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
              )}
            </Field>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className="w-full bg-[#C41E3A] hover:bg-[#a01830] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
            >
              {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</> : 'Upload to Vault'}
            </button>
          </form>
          <style>{`.input { width: 100%; padding: 10px 14px; border: 1px solid #d1d5db; border-radius: 8px; outline: none; font-size: 14px; } .input:focus { border-color: #C41E3A; box-shadow: 0 0 0 3px rgba(196,30,58,0.1); }`}</style>
        </Modal>
      )}

      {editingDoc && (
        <EditDocumentModal document={editingDoc} onClose={() => setEditingDoc(null)} />
      )}
    </div>
  );
};

export default DocumentsPage;
