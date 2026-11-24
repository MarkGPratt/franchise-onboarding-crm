import { supabase } from '@/lib/supabase';
import { BUCKET } from '@/lib/uploads';

export type SignKind = 'nda' | 'disclosure';

export interface SignatureRequest {
  id: string;
  token: string;
  lead_id: string | null;
  doc_kind: SignKind;
  division: string | null;
  signer_name: string | null;
  signer_email: string | null;
  document_id: string | null;
  source_name: string;
  source_path: string;
  status: 'sent' | 'opened' | 'signed' | 'cancelled';
  sent_by: string | null;
  sent_at: string;
  opened_at: string | null;
  signed_at: string | null;
  signed_name: string | null;
  signed_company: string | null;
  signed_capacity: string | null;
  signed_path: string | null;
  signed_url: string | null;
  franchisee_id: string | null;
  copied_document_id: string | null;
}

export const KIND_LABEL: Record<SignKind, string> = {
  nda: 'Confidentiality Agreement (NDA)',
  disclosure: 'Disclosure Document',
};

const DIVISION_KEYS: [RegExp, RegExp][] = [
  [/drain|plumb/i, /drain|plumb|\bTDS\b/i],
  [/electr/i, /electr|\bTES\b|\bTEC\b/i],
  [/air/i, /air|\bTAS\b/i],
];

/**
 * Pick the most likely vault document for this kind and division, by file name.
 * NDA: a name mentioning NDA / non-disclosure / confidentiality.
 * Disclosure: a name mentioning disclosure (but not "non-disclosure") and the lead's division.
 */
export function suggestDocument<T extends { id: string; name: string }>(docs: T[], kind: SignKind, division?: string): T | undefined {
  const isNda = (n: string) => /\bNDA\b|non[- ]?disclosure|confidential/i.test(n);
  if (kind === 'nda') return docs.find(d => isNda(d.name));
  const disc = docs.filter(d => /disclosure|\bFDD\b|prospectus/i.test(d.name) && !isNda(d.name));
  if (division) {
    const pair = DIVISION_KEYS.find(([lead]) => lead.test(division));
    const hit = pair && disc.find(d => pair[1].test(d.name));
    if (hit) return hit;
  }
  return disc.length === 1 ? disc[0] : undefined;
}

export async function signedCopyUrl(r: SignatureRequest): Promise<string | null> {
  if (!r.signed_path) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(r.signed_path, 60 * 30);
  return data?.signedUrl || r.signed_url || null;
}

/**
 * When a lead becomes a franchisee, copy each signed NDA / disclosure document
 * into that franchisee's Documents (category Legal). The franchisee row is
 * written in the background, so retry a few times if it is not there yet.
 */
export async function copySignedDocsToFranchisee(leadId: string, franchiseeId: string, uploadedBy: string) {
  const { data: reqs } = await supabase.from('signature_requests')
    .select('*').eq('lead_id', leadId).eq('status', 'signed').is('copied_document_id', null);
  for (const r of (reqs || []) as SignatureRequest[]) {
    if (!r.signed_path) continue;
    const fileName = r.signed_path.split('/').pop() || `${r.doc_kind}.pdf`;
    const dest = `vault/franchisee/${franchiseeId}/legal/${fileName}`;
    const { error: cpErr } = await supabase.storage.from(BUCKET).copy(r.signed_path, dest);
    if (cpErr && !/exists/i.test(cpErr.message)) { console.warn('copy signed doc:', cpErr.message); continue; }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(dest);
    const row = {
      name: `${KIND_LABEL[r.doc_kind]} – signed ${r.signed_at ? new Date(r.signed_at).toLocaleDateString('en-ZA') : ''}.pdf`,
      category: 'Legal', size: '', file_path: dest, url: pub.publicUrl, file_type: 'application/pdf',
      uploaded_by: uploadedBy || 'Signed online', visibility: 'all', franchisee_id: franchiseeId,
    };
    let docId: string | null = null;
    for (let attempt = 0; attempt < 4 && !docId; attempt++) {
      const { data, error } = await supabase.from('documents').insert(row).select('id').single();
      if (!error && data) docId = data.id;
      else await new Promise(res => setTimeout(res, 1500));
    }
    if (docId) await supabase.from('signature_requests').update({ franchisee_id: franchiseeId, copied_document_id: docId }).eq('id', r.id);
  }
}
