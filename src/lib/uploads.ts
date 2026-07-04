import { supabase } from '@/lib/supabase';

export const BUCKET = 'franchise-documents';
export const MAX_FILE_SIZE_MB = 50;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Whitelisted extensions
export const ALLOWED_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'txt', 'csv', 'rtf', 'html', 'htm',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'svg',
  'mp4', 'mov', 'avi', 'webm',
  'zip', 'rar', '7z',
];

export const ACCEPT_ATTR =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.html,.htm,' +
  '.png,.jpg,.jpeg,.gif,.webp,.heic,.svg,' +
  '.mp4,.mov,.avi,.webm,' +
  '.zip,.rar,.7z';

export function getExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : '';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

export function validateFile(file: File): ValidationResult {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: `File too large. Maximum size is ${MAX_FILE_SIZE_MB} MB (this file is ${formatBytes(file.size)}).` };
  }
  const ext = getExtension(file.name);
  if (!ext) {
    return { ok: false, error: 'File has no extension. Please rename and try again.' };
  }
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { ok: false, error: `File type ".${ext}" is not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` };
  }
  return { ok: true };
}

export interface UploadResult {
  path: string;
  url: string;
  size: string;
  fileType: string;
}

/**
 * Upload a file to the franchise-documents bucket.
 * @param file the file to upload
 * @param folder prefix folder ("vault", "tasks/<franchiseeId>/<taskId>", etc.)
 */
export async function uploadFile(file: File, folder: string): Promise<UploadResult> {
  const validation = validateFile(file);
  if (!validation.ok) throw new Error(validation.error);

  const ext = getExtension(file.name);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw new Error(error.message);

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return {
    path,
    url: pub.publicUrl,
    size: formatBytes(file.size),
    fileType: file.type || ext,
  };
}

export async function deleteFile(path: string): Promise<void> {
  if (!path) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.warn('Storage delete warning:', error.message);
}

/**
 * Trigger a real download by fetching the URL as a blob.
 * Falls back to opening in a new tab if the fetch fails (e.g. CORS).
 */
export async function downloadFile(url: string, fileName: string): Promise<void> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (e) {
    // Fallback: open in new tab
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
