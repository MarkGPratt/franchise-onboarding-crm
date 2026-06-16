import React, { useState } from 'react';
import { Modal, Field } from './LeadsPage';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, FileDown, Mail, Download } from 'lucide-react';

interface Props {
  franchiseeIds: string[];
  franchiseeNames: string[]; // for the summary line
  onClose: () => void;
}

type Mode = 'download' | 'email';

const BulkExportModal: React.FC<Props> = ({ franchiseeIds, franchiseeNames, onClose }) => {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>('download');
  const [recipients, setRecipients] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const downloadCombined = async () => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke(
        'export-franchisee-notes-pdf',
        {
          body: { franchisee_ids: franchiseeIds },
          headers: { Accept: 'application/pdf' },
        },
      );
      if (invokeErr) throw invokeErr;
      let blob: Blob;
      if (data instanceof Blob) blob = data;
      else if (data instanceof ArrayBuffer) blob = new Blob([data], { type: 'application/pdf' });
      else if (typeof data === 'string') blob = new Blob([data], { type: 'application/pdf' });
      else if (data && typeof data === 'object' && 'error' in data)
        throw new Error((data as { error: string }).error);
      else blob = new Blob([JSON.stringify(data)], { type: 'application/pdf' });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const today = new Date().toISOString().slice(0, 10);
      a.download = `notes-combined-${franchiseeIds.length}-${today}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSuccess(`Downloaded combined PDF for ${franchiseeIds.length} franchisees.`);
    } catch (err) {
      setError((err as Error).message || 'Failed to export');
    } finally {
      setBusy(false);
    }
  };

  const emailCombined = async () => {
    const emails = recipients
      .split(/[\s,;]+/)
      .map(s => s.trim())
      .filter(s => s.includes('@'));
    if (emails.length === 0) {
      setError('Please provide at least one valid recipient email.');
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke(
        'export-franchisee-notes-pdf',
        {
          body: {
            franchisee_ids: franchiseeIds,
            email_to: emails,
            message,
            from_name: user?.name || user?.email || 'A teammate',
          },
        },
      );
      if (invokeErr) throw invokeErr;
      const result = data as { ok?: boolean; error?: string; sent_to?: string[] } | null;
      if (!result || result.ok === false || result.error) {
        throw new Error(result?.error || 'Email failed');
      }
      setSuccess(`PDF emailed to ${(result.sent_to || emails).join(', ')}.`);
    } catch (err) {
      setError((err as Error).message || 'Failed to email PDF');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Export ${franchiseeIds.length} franchisee${franchiseeIds.length === 1 ? '' : 's'} to PDF`} onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
          <div className="font-semibold mb-1">Included franchisees ({franchiseeNames.length}):</div>
          <div className="max-h-24 overflow-y-auto leading-relaxed">
            {franchiseeNames.join(', ')}
          </div>
        </div>

        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setMode('download')}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-semibold flex items-center justify-center gap-1.5 transition ${mode === 'download' ? 'bg-white text-[#C41E3A] shadow' : 'text-gray-600'}`}
          >
            <Download className="h-4 w-4" /> Download
          </button>
          <button
            type="button"
            onClick={() => setMode('email')}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-semibold flex items-center justify-center gap-1.5 transition ${mode === 'email' ? 'bg-white text-[#C41E3A] shadow' : 'text-gray-600'}`}
          >
            <Mail className="h-4 w-4" /> Email
          </button>
        </div>

        {mode === 'download' ? (
          <div>
            <p className="text-sm text-gray-600">
              Generate a single PDF with a table of contents and all selected franchisees' internal notes back-to-back. The file will download to your computer.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="Recipient email(s)">
              <input
                value={recipients}
                onChange={e => setRecipients(e.target.value)}
                placeholder="alice@example.com, bob@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#C41E3A]"
              />
              <div className="text-[11px] text-gray-400 mt-1">Comma, semicolon or space separated.</div>
            </Field>
            <Field label="Optional message">
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={3}
                placeholder="Hi team, here's the bulk export of internal notes you asked for…"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#C41E3A] resize-y"
              />
            </Field>
          </div>
        )}

        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        {success && <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{success}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
          <button
            type="button"
            onClick={mode === 'download' ? downloadCombined : emailCombined}
            disabled={busy || franchiseeIds.length === 0}
            className="px-4 py-2 rounded-lg bg-[#C41E3A] hover:bg-[#a01830] disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'download' ? <FileDown className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
            {busy ? (mode === 'download' ? 'Generating…' : 'Sending…') : (mode === 'download' ? 'Download combined PDF' : 'Send email')}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default BulkExportModal;
