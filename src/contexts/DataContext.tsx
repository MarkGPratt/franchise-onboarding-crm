import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  DEFAULT_CHECKLIST,
  ChecklistSection,
  ChecklistTask,
  ChecklistSubtask,
  TaskAttachment,
} from '@/lib/seedData';
import { supabase } from '@/lib/supabase';
import { uploadFile, deleteFile, UploadResult } from '@/lib/uploads';
import { logActivity } from '@/lib/activity';


export interface Division {
  id: string;
  name: string;
}

export interface Franchisee {
  id: string;
  name: string;
  email: string;
  phone: string;
  territory: string;
  startDate: string;
  status: string;
  division?: string;
}

export type LeadStatus =
  | 'new'
  | 'brand_education'
  | 'financial_qualification'
  | 'formal_application'
  | 'disclosure'
  | 'agreement_review'
  | 'lost'
  | 'converted';

export interface Lead {
  id: string;
  contactName: string;
  email: string;
  phone: string;
  area: string;
  division?: string;
  status: LeadStatus;
  lostReason?: string;
  createdAt: string;
  assignedTo: string;
  interactions: { id: string; date: string; note: string; author: string }[];
}

export interface StageDocument {
  id: string;
  stage: string;
  name: string;
  url: string;
  filePath: string;
  size: string;
  fileType: string;
  uploadedAt: string;
  uploadedBy: string;
}


export type DocumentVisibility = 'all' | 'staff' | 'franchisee';

export interface DocumentItem {
  id: string;
  name: string;
  category: string;
  size: string;
  uploadedAt: string;
  uploadedBy: string;
  url: string;
  filePath: string;
  fileType: string;
  visibility: DocumentVisibility;
  franchiseeId?: string;        // null/undefined => global; set => only that franchisee
  parentDocumentId?: string;    // set when this row is an edited copy of another doc
}


export interface TaskUpload {
  id: string;
  name: string;
  date: string;
  url: string;
  filePath: string;
  size: string;
  fileType: string;
}

export interface TaskState {
  taskId: string;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
  comments: { id: string; author: string; role: string; text: string; date: string }[];
  uploads: TaskUpload[];
}

export interface FranchiseeProgress {
  franchiseeId: string;
  tasks: Record<string, TaskState>;
}

interface DataContextType {
  checklist: ChecklistSection[];
  setChecklist: (c: ChecklistSection[]) => void;
  addSection: (title: string) => void;
  updateSection: (id: string, title: string) => void;
  deleteSection: (id: string) => void;
  moveSection: (id: string, direction: 'up' | 'down') => void;
  addTask: (sectionId: string, text: string, responsible: ChecklistTask['responsible']) => void;
  updateTask: (sectionId: string, taskId: string, text: string, responsible: ChecklistTask['responsible']) => void;
  deleteTask: (sectionId: string, taskId: string) => void;
  moveTask: (sectionId: string, taskId: string, direction: 'up' | 'down') => void;
  moveTaskToSection: (fromSectionId: string, taskId: string, toSectionId: string) => void;
  addTaskAttachment: (sectionId: string, taskId: string, file: File, uploadedBy: string) => Promise<void>;
  removeTaskAttachment: (sectionId: string, taskId: string, attachmentId: string, filePath: string) => Promise<void>;
  addSubtask: (sectionId: string, taskId: string, text: string, responsible: ChecklistSubtask['responsible']) => void;
  updateSubtask: (sectionId: string, taskId: string, subtaskId: string, text: string, responsible: ChecklistSubtask['responsible']) => void;
  deleteSubtask: (sectionId: string, taskId: string, subtaskId: string) => void;
  moveSubtask: (sectionId: string, taskId: string, subtaskId: string, direction: 'up' | 'down') => void;
  divisions: Division[];
  addDivision: (name: string) => Promise<Division | null>;
  updateDivision: (id: string, name: string) => void;
  deleteDivision: (id: string) => void;

  franchisees: Franchisee[];
  addFranchisee: (f: Omit<Franchisee, 'id'>) => Franchisee;
  updateFranchisee: (id: string, f: Partial<Franchisee>) => void;
  deleteFranchisee: (id: string) => Promise<{ ok: boolean; error?: string }>;

  leads: Lead[];
  addLead: (l: Omit<Lead, 'id' | 'createdAt' | 'interactions'>) => void;
  updateLead: (id: string, l: Partial<Lead>) => void;
  deleteLead: (id: string) => void;
  addInteraction: (leadId: string, note: string, author: string) => void;
  convertLeadToFranchisee: (leadId: string) => Franchisee | null;

  documents: DocumentItem[];
  documentsLoading: boolean;
  uploadDocument: (file: File, category: string, uploadedBy: string, visibility: DocumentVisibility, franchiseeId?: string | null, parentDocumentId?: string | null) => Promise<void>;
  removeDocument: (id: string, filePath: string) => Promise<void>;

  stageDocuments: StageDocument[];
  uploadStageDocument: (stage: string, file: File, uploadedBy: string) => Promise<void>;
  removeStageDocument: (id: string, filePath: string) => Promise<void>;



  progress: Record<string, FranchiseeProgress>;
  toggleTask: (franchiseeId: string, taskId: string, by: string) => Promise<void>;
  addTaskComment: (franchiseeId: string, taskId: string, author: string, role: string, text: string) => Promise<void>;
  uploadTaskFile: (franchiseeId: string, taskId: string, file: File, uploadedBy: string) => Promise<void>;
  removeTaskUpload: (franchiseeId: string, taskId: string, uploadId: string, filePath: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const K = {
  progress: 'sg_progress',
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {}
  localStorage.setItem(key, JSON.stringify(fallback));
  return fallback;
}


const mapLead = (r: any, interactions: any[] = []): Lead => ({
  id: r.id,
  contactName: r.contact_name,
  email: r.email || '',
  phone: r.phone || '',
  area: r.area || '',
  division: r.division || '',
  status: (r.status || 'new') as Lead['status'],
  lostReason: r.lost_reason || undefined,
  createdAt: r.created_at,
  assignedTo: r.assigned_to || '',
  interactions: interactions
    .filter(i => i.lead_id === r.id)
    .map(i => ({ id: i.id, date: i.created_at, note: i.note, author: i.author || '' })),
});

const mapFranchisee = (r: any): Franchisee => ({
  id: r.id,
  name: r.name,
  email: r.email,
  phone: r.phone || '',
  territory: r.territory || '',
  startDate: r.start_date || '',
  status: r.status || 'active',
  division: r.division || '',
});

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [checklist, setChecklistState] = useState<ChecklistSection[]>([]);
  const [franchisees, setFranchisees] = useState<Franchisee[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [progress, setProgress] = useState<Record<string, FranchiseeProgress>>(() => load(K.progress, {}));

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [stageDocuments, setStageDocuments] = useState<StageDocument[]>([]);

  useEffect(() => { localStorage.setItem(K.progress, JSON.stringify(progress)); }, [progress]);

  const refreshStageDocuments = async () => {
    const { data, error } = await supabase.from('stage_documents').select('*').order('uploaded_at', { ascending: true });
    if (!error && data) setStageDocuments(data.map((d: any) => ({
      id: d.id, stage: d.stage, name: d.name, url: d.url, filePath: d.file_path,
      size: d.size || '', fileType: d.file_type || '', uploadedAt: d.uploaded_at, uploadedBy: d.uploaded_by || '',
    })));
  };
  useEffect(() => { refreshStageDocuments(); }, []);

  const uploadStageDocument = async (stage: string, file: File, uploadedBy: string) => {
    const result = await uploadFile(file, `stage-docs/${stage}`);
    const { data, error } = await supabase.from('stage_documents').insert({
      stage, name: file.name, url: result.url, file_path: result.path,
      size: result.size, file_type: result.fileType, uploaded_by: uploadedBy,
    }).select().single();
    if (error) { await deleteFile(result.path); throw new Error(error.message); }
    if (data) setStageDocuments(prev => [...prev, {
      id: data.id, stage: data.stage, name: data.name, url: data.url, filePath: data.file_path,
      size: data.size || '', fileType: data.file_type || '', uploadedAt: data.uploaded_at, uploadedBy: data.uploaded_by || '',
    }]);
  };
  const removeStageDocument = async (id: string, filePath: string) => {
    const { error } = await supabase.from('stage_documents').delete().eq('id', id);
    if (error) throw new Error(error.message);
    await deleteFile(filePath);
    setStageDocuments(prev => prev.filter(d => d.id !== id));
  };


  // ----- Checklist (DB-backed, realtime) -----
  // Loads sections + tasks + attachments from the database. On first run with
  // an empty database, seeds the DEFAULT_CHECKLIST so the app is usable.
  const refreshChecklist = async () => {
    const [secRes, taskRes, attRes, subRes] = await Promise.all([
      supabase.from('checklist_sections').select('*').order('position', { ascending: true }),
      supabase.from('checklist_tasks').select('*').order('position', { ascending: true }),
      supabase.from('checklist_task_attachments').select('*').order('uploaded_at', { ascending: true }),
      supabase.from('checklist_subtasks').select('*').order('position', { ascending: true }),
    ]);
    if (secRes.error || taskRes.error || attRes.error) {
      console.error('refreshChecklist:', secRes.error?.message || taskRes.error?.message || attRes.error?.message);
      return;
    }
    // subtasks table may not exist on older DBs — tolerate the error
    if (subRes.error) console.warn('refreshChecklist subtasks:', subRes.error.message);

    const sections = secRes.data || [];
    const tasks = taskRes.data || [];
    const atts = attRes.data || [];
    const subs = subRes.data || [];

    // Seed if empty
    if (sections.length === 0) {
      await seedDefaultChecklist();
      return refreshChecklist();
    }

    const attsByTask: Record<string, TaskAttachment[]> = {};
    atts.forEach((a: any) => {
      if (!attsByTask[a.task_id]) attsByTask[a.task_id] = [];
      attsByTask[a.task_id].push({
        id: a.id, name: a.name, url: a.url, filePath: a.file_path,
        size: a.size || '', fileType: a.file_type || '',
        uploadedAt: a.uploaded_at, uploadedBy: a.uploaded_by || '',
      });
    });

    const subsByTask: Record<string, ChecklistSubtask[]> = {};
    subs.forEach((s: any) => {
      if (!subsByTask[s.task_id]) subsByTask[s.task_id] = [];
      subsByTask[s.task_id].push({
        id: s.id, text: s.text,
        responsible: (s.responsible || 'both') as ChecklistSubtask['responsible'],
      });
    });

    const tasksBySection: Record<string, ChecklistTask[]> = {};
    tasks.forEach((t: any) => {
      if (!tasksBySection[t.section_id]) tasksBySection[t.section_id] = [];
      tasksBySection[t.section_id].push({
        id: t.id, text: t.text,
        responsible: (t.responsible || 'both') as ChecklistTask['responsible'],
        attachments: attsByTask[t.id] || [],
        subtasks: subsByTask[t.id] || [],
      });
    });

    const next: ChecklistSection[] = sections.map((s: any) => ({
      id: s.id, title: s.title, tasks: tasksBySection[s.id] || [],
    }));
    setChecklistState(next);
  };

  const seedDefaultChecklist = async () => {
    // Insert sections + tasks in a stable order
    const sectionRows = DEFAULT_CHECKLIST.map((s, i) => ({
      id: s.id, title: s.title, position: i,
    }));
    const { error: sErr } = await supabase.from('checklist_sections').insert(sectionRows);
    if (sErr) { console.error('seed sections:', sErr.message); return; }
    const taskRows: any[] = [];
    DEFAULT_CHECKLIST.forEach((s) => {
      s.tasks.forEach((t, i) => {
        taskRows.push({
          id: t.id, section_id: s.id, text: t.text,
          responsible: t.responsible, position: i,
        });
      });
    });
    if (taskRows.length) {
      const { error: tErr } = await supabase.from('checklist_tasks').insert(taskRows);
      if (tErr) console.error('seed tasks:', tErr.message);
    }
  };


  const refreshLeads = async () => {
    const [leadsRes, intRes] = await Promise.all([
      supabase.from('leads').select('*').order('created_at', { ascending: false }),
      supabase.from('lead_interactions').select('*').order('created_at', { ascending: true }),
    ]);
    if (!leadsRes.error && leadsRes.data) {
      const ints = intRes.data || [];
      setLeads(leadsRes.data.map(r => mapLead(r, ints)));
    }
  };
  const refreshFranchisees = async () => {
    const { data, error } = await supabase.from('franchisees').select('*').order('created_at', { ascending: true });
    if (!error && data) setFranchisees(data.map(mapFranchisee));
  };
  const refreshDivisions = async () => {
    const { data, error } = await supabase.from('divisions').select('*').order('name');
    if (!error && data) setDivisions(data.map((d: any) => ({ id: d.id, name: d.name })));
  };

  useEffect(() => {
    refreshLeads();
    refreshFranchisees();
    refreshDivisions();
    refreshChecklist();

    (async () => {
      setDocumentsLoading(true);
      const { data: docs, error: docErr } = await supabase
        .from('documents').select('*').order('uploaded_at', { ascending: false });
      if (!docErr && docs) {
        setDocuments(docs.map(d => ({
          id: d.id, name: d.name, category: d.category, size: d.size || '',
          uploadedAt: d.uploaded_at, uploadedBy: d.uploaded_by || '',
          url: d.url, filePath: d.file_path, fileType: d.file_type || '',
          visibility: (d.visibility as DocumentVisibility) || 'all',
          franchiseeId: d.franchisee_id || undefined,
          parentDocumentId: d.parent_document_id || undefined,
        })));
      }

      setDocumentsLoading(false);

      const { data: uploads } = await supabase.from('task_uploads').select('*').order('uploaded_at', { ascending: true });
      if (uploads) {
        setProgress(prev => {
          const next: Record<string, FranchiseeProgress> = JSON.parse(JSON.stringify(prev));
          Object.values(next).forEach(fp => { Object.values(fp.tasks).forEach(t => { t.uploads = []; }); });
          uploads.forEach((u: any) => {
            const fid = u.franchisee_id; const tid = u.task_id;
            if (!next[fid]) next[fid] = { franchiseeId: fid, tasks: {} };
            if (!next[fid].tasks[tid]) next[fid].tasks[tid] = { taskId: tid, completed: false, comments: [], uploads: [] };
            next[fid].tasks[tid].uploads.push({
              id: u.id, name: u.file_name, date: u.uploaded_at, url: u.url,
              filePath: u.file_path, size: u.file_size || '', fileType: u.file_type || '',
            });
          });
          return next;
        });
      }

      // Load task_progress + task_comments from DB (replaces localStorage)
      const [{ data: tp }, { data: tc }] = await Promise.all([
        supabase.from('task_progress').select('*'),
        supabase.from('task_comments').select('*').order('created_at', { ascending: true }),
      ]);
      setProgress(prev => {
        const next: Record<string, FranchiseeProgress> = JSON.parse(JSON.stringify(prev));
        Object.values(next).forEach(fp => Object.values(fp.tasks).forEach(t => { t.completed = false; t.completedAt = undefined; t.completedBy = undefined; t.comments = []; }));
        (tp || []).forEach((r: any) => {
          const fid = r.franchisee_id, tid = r.task_id;
          if (!next[fid]) next[fid] = { franchiseeId: fid, tasks: {} };
          if (!next[fid].tasks[tid]) next[fid].tasks[tid] = { taskId: tid, completed: false, comments: [], uploads: [] };
          next[fid].tasks[tid].completed = !!r.completed;
          next[fid].tasks[tid].completedAt = r.completed_at || undefined;
          next[fid].tasks[tid].completedBy = r.completed_by || undefined;
        });
        (tc || []).forEach((c: any) => {
          const fid = c.franchisee_id, tid = c.task_id;
          if (!next[fid]) next[fid] = { franchiseeId: fid, tasks: {} };
          if (!next[fid].tasks[tid]) next[fid].tasks[tid] = { taskId: tid, completed: false, comments: [], uploads: [] };
          next[fid].tasks[tid].comments.push({ id: c.id, author: c.author, role: c.role, text: c.text, date: c.created_at });
        });
        return next;
      });
    })();



    // NOTE: Supabase Realtime websocket has been throwing decode errors
    // ("TypeError: n is not iterable") against this backend when the socket
    // receives certain frames (e.g. heartbeats / presence) after the user
    // signs out and the auth context flips. Those errors propagate up out of
    // the phoenix client and crash the React tree. We rely on polling +
    // window focus refresh below instead of the realtime channel — the
    // dataset is small and 15s latency is acceptable for a CRM.
    //
    // If/when we re-enable realtime, wrap the subscribe() call's onMessage
    // path in a defensive try/catch at the supabase-js level.

    // Poll for updates as a safety net. Polling every 15s keeps multiple
    // admins/sales reps reasonably in sync.
    const POLL_MS = 15000;
    const pollId = window.setInterval(() => {
      refreshLeads();
      refreshFranchisees();
      refreshDivisions();
      refreshChecklist();
    }, POLL_MS);

    // Also refresh when the tab regains focus so users see fresh data immediately.
    const onFocus = () => {
      refreshLeads();
      refreshFranchisees();
      refreshDivisions();
      refreshChecklist();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      window.clearInterval(pollId);
      window.removeEventListener('focus', onFocus);
    };
  }, []);




  // ----- Checklist CRUD (DB-backed) -----
  // All mutations update local state optimistically AND persist to the
  // database. The realtime channel + 15s poll keep all admins/sales reps in
  // sync with each other automatically.
  const setChecklist = (c: ChecklistSection[]) => setChecklistState(c);

  const addSection = (title: string) => {
    const id = `s_${Date.now()}`;
    const position = checklist.length;
    setChecklistState(prev => [...prev, { id, title, tasks: [] }]);
    supabase.from('checklist_sections').insert({ id, title, position }).then(({ error }) => {
      if (error) console.error('addSection:', error.message);
    });
  };

  const updateSection = (id: string, title: string) => {
    setChecklistState(prev => prev.map(s => s.id === id ? { ...s, title } : s));
    supabase.from('checklist_sections').update({ title }).eq('id', id).then(({ error }) => {
      if (error) console.error('updateSection:', error.message);
    });
  };

  const deleteSection = (id: string) => {
    setChecklistState(prev => prev.filter(s => s.id !== id));
    // Cascades remove tasks + attachments via FK ON DELETE CASCADE
    supabase.from('checklist_sections').delete().eq('id', id).then(({ error }) => {
      if (error) console.error('deleteSection:', error.message);
    });
  };

  const moveSection = (id: string, direction: 'up' | 'down') => {
    const idx = checklist.findIndex(s => s.id === id);
    if (idx === -1) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= checklist.length) return;
    const arr = [...checklist];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    setChecklistState(arr);
    // Persist swapped positions
    const a = arr[idx], b = arr[newIdx];
    supabase.from('checklist_sections').update({ position: idx }).eq('id', a.id).then(({ error }) => {
      if (error) console.error('moveSection a:', error.message);
    });
    supabase.from('checklist_sections').update({ position: newIdx }).eq('id', b.id).then(({ error }) => {
      if (error) console.error('moveSection b:', error.message);
    });
  };

  const addTask = (sectionId: string, text: string, responsible: ChecklistTask['responsible']) => {
    const id = `t_${Date.now()}`;
    const section = checklist.find(s => s.id === sectionId);
    const position = section ? section.tasks.length : 0;
    setChecklistState(prev => prev.map(s => s.id === sectionId
      ? { ...s, tasks: [...s.tasks, { id, text, responsible, attachments: [] }] } : s));
    supabase.from('checklist_tasks').insert({
      id, section_id: sectionId, text, responsible, position,
    }).then(({ error }) => { if (error) console.error('addTask:', error.message); });
  };

  const updateTask = (sectionId: string, taskId: string, text: string, responsible: ChecklistTask['responsible']) => {
    setChecklistState(prev => prev.map(s => s.id === sectionId
      ? { ...s, tasks: s.tasks.map(t => t.id === taskId ? { ...t, text, responsible } : t) } : s));
    supabase.from('checklist_tasks').update({ text, responsible }).eq('id', taskId).then(({ error }) => {
      if (error) console.error('updateTask:', error.message);
    });
  };

  const deleteTask = (sectionId: string, taskId: string) => {
    setChecklistState(prev => prev.map(s => s.id === sectionId
      ? { ...s, tasks: s.tasks.filter(t => t.id !== taskId) } : s));
    // Cascades remove attachments via FK
    supabase.from('checklist_tasks').delete().eq('id', taskId).then(({ error }) => {
      if (error) console.error('deleteTask:', error.message);
    });
  };

  // Move a task up or down within its section (swap positions in DB)
  const moveTask = (sectionId: string, taskId: string, direction: 'up' | 'down') => {
    const section = checklist.find(s => s.id === sectionId);
    if (!section) return;
    const idx = section.tasks.findIndex(t => t.id === taskId);
    if (idx === -1) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= section.tasks.length) return;
    const newTasks = [...section.tasks];
    [newTasks[idx], newTasks[newIdx]] = [newTasks[newIdx], newTasks[idx]];
    setChecklistState(prev => prev.map(s => s.id === sectionId ? { ...s, tasks: newTasks } : s));
    const a = newTasks[idx], b = newTasks[newIdx];
    supabase.from('checklist_tasks').update({ position: idx }).eq('id', a.id).then(({ error }) => {
      if (error) console.error('moveTask a:', error.message);
    });
    supabase.from('checklist_tasks').update({ position: newIdx }).eq('id', b.id).then(({ error }) => {
      if (error) console.error('moveTask b:', error.message);
    });
  };

  // Move a task from one section to another (append to end of destination)
  const moveTaskToSection = (fromSectionId: string, taskId: string, toSectionId: string) => {
    if (fromSectionId === toSectionId) return;
    const dest = checklist.find(s => s.id === toSectionId);
    const newPosition = dest ? dest.tasks.length : 0;
    setChecklistState(prev => {
      const fromSec = prev.find(s => s.id === fromSectionId);
      const task = fromSec?.tasks.find(t => t.id === taskId);
      if (!task) return prev;
      return prev.map(s => {
        if (s.id === fromSectionId) return { ...s, tasks: s.tasks.filter(t => t.id !== taskId) };
        if (s.id === toSectionId) return { ...s, tasks: [...s.tasks, task] };
        return s;
      });
    });
    supabase.from('checklist_tasks')
      .update({ section_id: toSectionId, position: newPosition })
      .eq('id', taskId)
      .then(({ error }) => { if (error) console.error('moveTaskToSection:', error.message); });
  };

  // Upload an attachment for a master-checklist task
  const addTaskAttachment = async (sectionId: string, taskId: string, file: File, uploadedBy: string) => {
    const result = await uploadFile(file, `checklist/${sectionId}/${taskId}`);
    const id = `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const uploadedAt = new Date().toISOString();
    const att: TaskAttachment = {
      id, name: file.name, url: result.url, filePath: result.path,
      size: result.size, fileType: result.fileType, uploadedAt, uploadedBy,
    };
    const { error } = await supabase.from('checklist_task_attachments').insert({
      id, task_id: taskId, name: file.name, url: result.url, file_path: result.path,
      size: result.size, file_type: result.fileType, uploaded_by: uploadedBy, uploaded_at: uploadedAt,
    });
    if (error) {
      await deleteFile(result.path);
      throw new Error(error.message);
    }
    setChecklistState(prev => prev.map(s => s.id !== sectionId ? s : {
      ...s,
      tasks: s.tasks.map(t => t.id !== taskId ? t : { ...t, attachments: [...(t.attachments || []), att] }),
    }));
  };

  const removeTaskAttachment = async (sectionId: string, taskId: string, attachmentId: string, filePath: string) => {
    const { error } = await supabase.from('checklist_task_attachments').delete().eq('id', attachmentId);
    if (error) throw new Error(error.message);
    await deleteFile(filePath);
    setChecklistState(prev => prev.map(s => s.id !== sectionId ? s : {
      ...s,
      tasks: s.tasks.map(t => t.id !== taskId ? t : { ...t, attachments: (t.attachments || []).filter(a => a.id !== attachmentId) }),
    }));
  };

  // ----- Subtask CRUD (DB-backed) -----
  const addSubtask = (sectionId: string, taskId: string, text: string, responsible: ChecklistSubtask['responsible']) => {
    const id = `st_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const section = checklist.find(s => s.id === sectionId);
    const task = section?.tasks.find(t => t.id === taskId);
    const position = task ? (task.subtasks || []).length : 0;
    setChecklistState(prev => prev.map(s => s.id !== sectionId ? s : {
      ...s,
      tasks: s.tasks.map(t => t.id !== taskId ? t : {
        ...t, subtasks: [...(t.subtasks || []), { id, text, responsible }],
      }),
    }));
    supabase.from('checklist_subtasks').insert({
      id, task_id: taskId, text, responsible, position,
    }).then(({ error }) => { if (error) console.error('addSubtask:', error.message); });
  };

  const updateSubtask = (sectionId: string, taskId: string, subtaskId: string, text: string, responsible: ChecklistSubtask['responsible']) => {
    setChecklistState(prev => prev.map(s => s.id !== sectionId ? s : {
      ...s,
      tasks: s.tasks.map(t => t.id !== taskId ? t : {
        ...t, subtasks: (t.subtasks || []).map(st => st.id === subtaskId ? { ...st, text, responsible } : st),
      }),
    }));
    supabase.from('checklist_subtasks').update({ text, responsible }).eq('id', subtaskId).then(({ error }) => {
      if (error) console.error('updateSubtask:', error.message);
    });
  };

  const deleteSubtask = (sectionId: string, taskId: string, subtaskId: string) => {
    setChecklistState(prev => prev.map(s => s.id !== sectionId ? s : {
      ...s,
      tasks: s.tasks.map(t => t.id !== taskId ? t : {
        ...t, subtasks: (t.subtasks || []).filter(st => st.id !== subtaskId),
      }),
    }));
    supabase.from('checklist_subtasks').delete().eq('id', subtaskId).then(({ error }) => {
      if (error) console.error('deleteSubtask:', error.message);
    });
  };

  const moveSubtask = (sectionId: string, taskId: string, subtaskId: string, direction: 'up' | 'down') => {
    const section = checklist.find(s => s.id === sectionId);
    const task = section?.tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return;
    const idx = task.subtasks.findIndex(st => st.id === subtaskId);
    if (idx === -1) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= task.subtasks.length) return;
    const newSubs = [...task.subtasks];
    [newSubs[idx], newSubs[newIdx]] = [newSubs[newIdx], newSubs[idx]];
    setChecklistState(prev => prev.map(s => s.id !== sectionId ? s : {
      ...s,
      tasks: s.tasks.map(t => t.id !== taskId ? t : { ...t, subtasks: newSubs }),
    }));
    const a = newSubs[idx], b = newSubs[newIdx];
    supabase.from('checklist_subtasks').update({ position: idx }).eq('id', a.id).then(({ error }) => {
      if (error) console.error('moveSubtask a:', error.message);
    });
    supabase.from('checklist_subtasks').update({ position: newIdx }).eq('id', b.id).then(({ error }) => {
      if (error) console.error('moveSubtask b:', error.message);
    });
  };


  // ----- Divisions -----
  const addDivision = async (name: string) => {
    const id = `div_${Date.now()}`;
    const { data, error } = await supabase.from('divisions').insert({ id, name }).select().single();
    if (error) { console.error('addDivision:', error.message); return null; }
    const d: Division = { id: data.id, name: data.name };
    setDivisions(prev => [...prev, d].sort((a, b) => a.name.localeCompare(b.name)));
    return d;
  };
  const updateDivision = (id: string, name: string) => {
    setDivisions(prev => prev.map(d => d.id === id ? { ...d, name } : d));
    supabase.from('divisions').update({ name }).eq('id', id).then(({ error }) => { if (error) console.error(error.message); });
  };
  const deleteDivision = (id: string) => {
    setDivisions(prev => prev.filter(d => d.id !== id));
    supabase.from('divisions').delete().eq('id', id).then(({ error }) => { if (error) console.error(error.message); });
  };

  // ----- Franchisees (DB) -----
  const addFranchisee = (f: Omit<Franchisee, 'id'>) => {
    const id = `f_${Date.now()}`;
    const newF: Franchisee = { ...f, id };
    setFranchisees(prev => [...prev, newF]);
    supabase.from('franchisees').insert({
      id, name: f.name, email: f.email, phone: f.phone, territory: f.territory,
      start_date: f.startDate || null, status: f.status, division: f.division || null,
    }).then(({ error }) => { if (error) console.error('addFranchisee:', error.message); });
    logActivity({
      action: 'franchisee.created',
      targetType: 'franchisee',
      targetId: id,
      targetName: f.name,
      metadata: { territory: f.territory, division: f.division || null },
    });
    return newF;
  };
  const updateFranchisee = (id: string, f: Partial<Franchisee>) => {
    setFranchisees(prev => prev.map(x => x.id === id ? { ...x, ...f } : x));
    const patch: any = {};
    if (f.name !== undefined) patch.name = f.name;
    if (f.email !== undefined) patch.email = f.email;
    if (f.phone !== undefined) patch.phone = f.phone;
    if (f.territory !== undefined) patch.territory = f.territory;
    if (f.startDate !== undefined) patch.start_date = f.startDate || null;
    if (f.status !== undefined) patch.status = f.status;
    if (f.division !== undefined) patch.division = f.division || null;
    supabase.from('franchisees').update(patch).eq('id', id).then(({ error }) => { if (error) console.error(error.message); });
  };
  const deleteFranchisee = async (id: string): Promise<{ ok: boolean; error?: string }> => {
    const target = franchisees.find(x => x.id === id);

    // Clean up all related records first (no FK constraints so these won't block,
    // but we remove them for data hygiene)
    await supabase.from('task_uploads').delete().eq('franchisee_id', id);
    await supabase.from('task_comments').delete().eq('franchisee_id', id);
    await supabase.from('task_progress').delete().eq('franchisee_id', id);
    await supabase.from('franchisee_notes').delete().eq('franchisee_id', id);

    const { error } = await supabase.from('franchisees').delete().eq('id', id);
    if (error) {
      console.error('deleteFranchisee:', error.message);
      return { ok: false, error: error.message };
    }

    setFranchisees(prev => prev.filter(x => x.id !== id));
    setProgress(prev => { const n = { ...prev }; delete n[id]; return n; });
    logActivity({
      action: 'franchisee.deleted',
      targetType: 'franchisee',
      targetId: id,
      targetName: target?.name,
    });
    return { ok: true };
  };


  // ----- Leads (DB) -----
  const addLead = (l: Omit<Lead, 'id' | 'createdAt' | 'interactions'>) => {
    const id = `l_${Date.now()}`;
    const createdAt = new Date().toISOString();
    const newLead: Lead = { ...l, id, createdAt, interactions: [] };
    setLeads(prev => [newLead, ...prev]);
    supabase.from('leads').insert({
      id, contact_name: l.contactName, email: l.email, phone: l.phone, area: l.area,
      division: l.division || null,
      status: l.status, assigned_to: l.assignedTo || null, created_at: createdAt,
    }).then(({ error }) => { if (error) console.error('addLead:', error.message); });
    logActivity({
      action: 'lead.created',
      targetType: 'lead',
      targetId: id,
      targetName: l.contactName,
      metadata: { area: l.area, division: l.division || null, status: l.status },
    });
  };
  const updateLead = (id: string, l: Partial<Lead>) => {
    setLeads(prev => prev.map(x => x.id === id ? { ...x, ...l } : x));
    const patch: any = {};
    if (l.contactName !== undefined) patch.contact_name = l.contactName;
    if (l.email !== undefined) patch.email = l.email;
    if (l.phone !== undefined) patch.phone = l.phone;
    if (l.area !== undefined) patch.area = l.area;
    if (l.division !== undefined) patch.division = l.division || null;
    if (l.status !== undefined) patch.status = l.status;
    if (l.assignedTo !== undefined) patch.assigned_to = l.assignedTo || null;
    if (l.lostReason !== undefined) patch.lost_reason = l.lostReason || null;
    supabase.from('leads').update(patch).eq('id', id).then(({ error }) => { if (error) console.error(error.message); });
  };
  const deleteLead = (id: string) => {
    const target = leads.find(x => x.id === id);
    setLeads(prev => prev.filter(x => x.id !== id));
    supabase.from('leads').delete().eq('id', id).then(({ error }) => { if (error) console.error(error.message); });
    logActivity({
      action: 'lead.deleted',
      targetType: 'lead',
      targetId: id,
      targetName: target?.contactName,
    });
  };
  const addInteraction = (leadId: string, note: string, author: string) => {
    const id = `i_${Date.now()}`;
    const date = new Date().toISOString();
    setLeads(prev => prev.map(l => l.id === leadId
      ? { ...l, interactions: [...l.interactions, { id, date, note, author }] } : l));
    supabase.from('lead_interactions').insert({
      id, lead_id: leadId, note, author, created_at: date,
    }).then(({ error }) => { if (error) console.error(error.message); });
  };
  const convertLeadToFranchisee = (leadId: string): Franchisee | null => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return null;
    const newF = addFranchisee({
      name: lead.contactName, email: lead.email, phone: lead.phone, territory: lead.area,
      startDate: new Date().toISOString().split('T')[0], status: 'active',
      division: lead.division || '',
    });
    updateLead(leadId, { status: 'converted' });
    logActivity({
      action: 'lead.converted',
      targetType: 'lead',
      targetId: leadId,
      targetName: lead.contactName,
      metadata: { franchiseeId: newF.id },
    });
    return newF;
  };

  // ----- Documents -----
  // Admins can upload either a global (franchiseeId = null) document or one
  // tied to a specific franchisee. Franchisees only see global docs + docs
  // assigned to them. When a franchisee edits a doc, we save the edited copy
  // as a new row with franchiseeId = their id and parentDocumentId = original.
  const uploadDocument = async (
    file: File,
    category: string,
    uploadedBy: string,
    visibility: DocumentVisibility = 'all',
    franchiseeId?: string | null,
    parentDocumentId?: string | null,
  ) => {
    const folder = franchiseeId
      ? `vault/franchisee/${franchiseeId}/${category.toLowerCase()}`
      : `vault/${category.toLowerCase()}`;
    const result: UploadResult = await uploadFile(file, folder);
    const { data, error } = await supabase.from('documents').insert({
      name: file.name, category, size: result.size, file_path: result.path,
      url: result.url, file_type: result.fileType, uploaded_by: uploadedBy, visibility,
      franchisee_id: franchiseeId || null,
      parent_document_id: parentDocumentId || null,
    }).select().single();
    if (error) { await deleteFile(result.path); throw new Error(error.message); }
    if (data) {
      setDocuments(prev => [{
        id: data.id, name: data.name, category: data.category, size: data.size || '',
        uploadedAt: data.uploaded_at, uploadedBy: data.uploaded_by || '',
        url: data.url, filePath: data.file_path, fileType: data.file_type || '',
        visibility: (data.visibility as DocumentVisibility) || 'all',
        franchiseeId: data.franchisee_id || undefined,
        parentDocumentId: data.parent_document_id || undefined,
      }, ...prev]);
      logActivity({
        action: 'document.uploaded',
        targetType: 'document',
        targetId: data.id,
        targetName: data.name,
        metadata: {
          category: data.category, visibility: data.visibility, size: data.size,
          franchiseeId: data.franchisee_id || null,
          parentDocumentId: data.parent_document_id || null,
        },
      });
    }
  };
  const removeDocument = async (id: string, filePath: string) => {
    const target = documents.find(d => d.id === id);
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) throw new Error(error.message);
    await deleteFile(filePath);
    setDocuments(prev => prev.filter(d => d.id !== id));
    logActivity({
      action: 'document.deleted',
      targetType: 'document',
      targetId: id,
      targetName: target?.name,
      metadata: { category: target?.category },
    });
  };




  // ----- Progress -----
  const toggleTask = async (franchiseeId: string, taskId: string, by: string): Promise<void> => {
    let willComplete = false;
    let completedAt: string | undefined;

    setProgress(prev => {
      const fp = prev[franchiseeId] || { franchiseeId, tasks: {} };
      const existing = fp.tasks[taskId];
      willComplete = !(existing?.completed);
      completedAt = willComplete ? new Date().toISOString() : undefined;
      const newTask: TaskState = {
        taskId, completed: willComplete,
        completedAt,
        completedBy: willComplete ? by : undefined,
        comments: existing?.comments || [], uploads: existing?.uploads || [],
      };
      return { ...prev, [franchiseeId]: { ...fp, tasks: { ...fp.tasks, [taskId]: newTask } } };
    });

    // Persist to database
    await supabase.from('task_progress').upsert({
      franchisee_id: franchiseeId,
      task_id: taskId,
      completed: willComplete,
      completed_at: completedAt || null,
      completed_by: willComplete ? by : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'franchisee_id,task_id' });

    // Resolve task text + franchisee name for a more useful log entry
    let taskText: string | undefined;
    for (const section of checklist) {
      const t = section.tasks.find(t => t.id === taskId);
      if (t) { taskText = t.text; break; }
    }
    const franchiseeName = franchisees.find(f => f.id === franchiseeId)?.name;
    logActivity({
      action: willComplete ? 'task.completed' : 'task.reopened',
      targetType: 'task',
      targetId: taskId,
      targetName: taskText || taskId,
      metadata: { franchiseeId, franchiseeName, by },
    });
  };

  const addTaskComment = async (franchiseeId: string, taskId: string, author: string, role: string, text: string): Promise<void> => {
    const id = `c_${Date.now()}`;
    const date = new Date().toISOString();

    setProgress(prev => {
      const fp = prev[franchiseeId] || { franchiseeId, tasks: {} };
      const existing = fp.tasks[taskId] || { taskId, completed: false, comments: [], uploads: [] };
      const newTask: TaskState = {
        ...existing,
        comments: [...existing.comments, { id, author, role, text, date }],
      };
      return { ...prev, [franchiseeId]: { ...fp, tasks: { ...fp.tasks, [taskId]: newTask } } };
    });

    // Persist to database
    await supabase.from('task_comments').insert({
      id,
      franchisee_id: franchiseeId,
      task_id: taskId,
      author,
      role,
      text,
      created_at: date,
    });
  };
  const uploadTaskFile = async (franchiseeId: string, taskId: string, file: File, uploadedBy: string) => {
    const result = await uploadFile(file, `tasks/${franchiseeId}/${taskId}`);
    const { data, error } = await supabase.from('task_uploads').insert({
      franchisee_id: franchiseeId, task_id: taskId, file_name: file.name,
      file_path: result.path, url: result.url, file_size: result.size,
      file_type: result.fileType, uploaded_by: uploadedBy,
    }).select().single();
    if (error) { await deleteFile(result.path); throw new Error(error.message); }
    if (data) {
      const newUpload: TaskUpload = {
        id: data.id, name: data.file_name, date: data.uploaded_at, url: data.url,
        filePath: data.file_path, size: data.file_size || '', fileType: data.file_type || '',
      };
      setProgress(prev => {
        const fp = prev[franchiseeId] || { franchiseeId, tasks: {} };
        const existing = fp.tasks[taskId] || { taskId, completed: false, comments: [], uploads: [] };
        return { ...prev, [franchiseeId]: { ...fp, tasks: { ...fp.tasks, [taskId]: { ...existing, uploads: [...existing.uploads, newUpload] } } } };
      });
    }
  };
  const removeTaskUpload = async (franchiseeId: string, taskId: string, uploadId: string, filePath: string) => {
    const { error } = await supabase.from('task_uploads').delete().eq('id', uploadId);
    if (error) throw new Error(error.message);
    await deleteFile(filePath);
    setProgress(prev => {
      const fp = prev[franchiseeId]; if (!fp) return prev;
      const task = fp.tasks[taskId]; if (!task) return prev;
      return { ...prev, [franchiseeId]: { ...fp, tasks: { ...fp.tasks, [taskId]: { ...task, uploads: task.uploads.filter(u => u.id !== uploadId) } } } };
    });
  };

  return (
    <DataContext.Provider value={{
      checklist, setChecklist, addSection, updateSection, deleteSection, moveSection,
      addTask, updateTask, deleteTask, moveTask, moveTaskToSection,
      addTaskAttachment, removeTaskAttachment,
      addSubtask, updateSubtask, deleteSubtask, moveSubtask,
      divisions, addDivision, updateDivision, deleteDivision,
      franchisees, addFranchisee, updateFranchisee, deleteFranchisee,
      leads, addLead, updateLead, deleteLead, addInteraction, convertLeadToFranchisee,
      documents, documentsLoading, uploadDocument, removeDocument,
      stageDocuments, uploadStageDocument, removeStageDocument,
      progress, toggleTask, addTaskComment, uploadTaskFile, removeTaskUpload,
    }}>
      {children}
    </DataContext.Provider>
  );
};


export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
};
