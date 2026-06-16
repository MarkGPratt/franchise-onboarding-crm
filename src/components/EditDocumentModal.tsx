import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle, Save, FileText } from 'lucide-react';
import { Modal, Field } from './LeadsPage';
import { useData, DocumentItem } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { getExtension } from '@/lib/uploads';

// Extensions whose contents we can safely fetch as text, show in a textarea,
// and re-upload as an edited Blob without corrupting the file.
const EDITABLE_EXTENSIONS = ['txt', 'csv', 'rtf', 'svg'];

export const isDocumentEditable = (doc: DocumentItem): boolean => {
  return EDITABLE_EXTENSIONS.includes(getExtension(doc.name));
};

interface Props {
  document: DocumentItem;
  onClose: () => void;
}

const EditDocumentModal: React.FC<Props> = ({ document, onClose }) => {
  const { uploadDocument } = useData();
  const { user } = useAuth();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState<string>('');

  const ext = getExtension(document.name);
  const baseName = document.name.replace(/\.[^.]+$/, '');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(document.url);
        if (!res.ok) throw new Error(`Failed to load document (HTTP ${res.status})`);
        const text = await res.text();
        setContent(text);
        // Default name: "<base> (edited).<ext>"
        setNewName(`${baseName} (edited).${ext}`);
      } catch (e: any) {
        setError(e.message || 'Failed to load document');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.id]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newName.trim()) {
      setError('Please enter a file name.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Build a new File from the edited contents
      const mime = ext === 'csv' ? 'text/csv'
        : ext === 'svg' ? 'image/svg+xml'
        : ext === 'rtf' ? 'application/rtf'
        : 'text/plain';
      const finalName = newName.match(/\.[^.]+$/) ? newName : `${newName}.${ext}`;
      const blob = new Blob([content], { type: mime });
      const file = new File([blob], finalName, { type: mime });

      // Franchisees save edits as their own franchisee-scoped copy.
      // Admins/sales saving an edit attach it to the same franchisee the
      // original was scoped to (or keep it global if the original was global).
      let franchiseeId: string | null = null;
      if (user.role === 'franchisee') {
        franchiseeId = user.franchiseeId || null;
      } else {
        franchiseeId = document.franchiseeId || null;
      }

      // Edited copies should be visible to the franchisee + admin
      const visibility = franchiseeId ? 'franchisee' : document.visibility;

      await uploadDocument(
        file,
        document.category,
        user.name || 'User',
        visibility,
        franchiseeId,
        document.id, // parent reference
      );
      onClose();
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Edit: ${document.name}`} onClose={() => { if (!saving) onClose(); }}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Save as">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="input"
            placeholder={`${baseName} (edited).${ext}`}
            disabled={saving}
          />
          <p className="text-xs text-gray-500 mt-1.5">
            A new file will be saved with these changes. The original is not modified.
          </p>
        </Field>

        <Field label="Document content">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading document...
            </div>
          ) : (
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              className="w-full font-mono text-sm border border-gray-200 rounded-lg p-3 outline-none focus:border-[#C41E3A] focus:ring-2 focus:ring-red-100"
              rows={18}
              disabled={saving}
              spellCheck={ext === 'txt'}
            />
          )}
          <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
            <FileText className="h-3.5 w-3.5" />
            <span>.{ext.toUpperCase()} file — {content.length.toLocaleString()} characters</span>
          </div>
        </Field>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-lg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || saving}
            className="flex-1 bg-[#C41E3A] hover:bg-[#a01830] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
          >
            {saving
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
              : <><Save className="h-4 w-4" /> Save as new version</>}
          </button>
        </div>
      </form>
      <style>{`.input { width: 100%; padding: 10px 14px; border: 1px solid #d1d5db; border-radius: 8px; outline: none; font-size: 14px; } .input:focus { border-color: #C41E3A; box-shadow: 0 0 0 3px rgba(196,30,58,0.1); }`}</style>
    </Modal>
  );
};

export default EditDocumentModal;
