import React, { useRef, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  Plus, Edit2, Trash2, Save, X, ChevronDown, ChevronRight,
  ArrowUp, ArrowDown, Paperclip, Download, Move, FileText, ListTree,
} from 'lucide-react';
import { ChecklistTask, ChecklistSubtask } from '@/lib/seedData';
import { ACCEPT_ATTR, downloadFile } from '@/lib/uploads';

const ChecklistBuilder: React.FC = () => {
  const {
    checklist, addSection, updateSection, deleteSection, moveSection,
    addTask, updateTask, deleteTask, moveTask, moveTaskToSection,
    addTaskAttachment, removeTaskAttachment,
    addSubtask, updateSubtask, deleteSubtask, moveSubtask,
  } = useData();
  const { user } = useAuth();

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [sectionTitle, setSectionTitle] = useState('');
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [showNewSection, setShowNewSection] = useState(false);

  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [taskEdit, setTaskEdit] = useState<{ text: string; responsible: ChecklistTask['responsible'] }>({ text: '', responsible: 'both' });

  const [addingTaskTo, setAddingTaskTo] = useState<string | null>(null);
  const [newTask, setNewTask] = useState<{ text: string; responsible: ChecklistTask['responsible'] }>({ text: '', responsible: 'both' });

  const [movingTask, setMovingTask] = useState<{ sectionId: string; taskId: string } | null>(null);
  const [showAttachmentsFor, setShowAttachmentsFor] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{ sectionId: string; taskId: string } | null>(null);

  // Subtask UI state
  const [expandedSubtasks, setExpandedSubtasks] = useState<Record<string, boolean>>({});
  const [addingSubtaskTo, setAddingSubtaskTo] = useState<string | null>(null);
  const [newSubtask, setNewSubtask] = useState<{ text: string; responsible: ChecklistSubtask['responsible'] }>({ text: '', responsible: 'both' });
  const [editingSubtask, setEditingSubtask] = useState<string | null>(null);
  const [subtaskEdit, setSubtaskEdit] = useState<{ text: string; responsible: ChecklistSubtask['responsible'] }>({ text: '', responsible: 'both' });

  const startEditSection = (id: string, title: string) => {
    setEditingSection(id);
    setSectionTitle(title);
  };

  const saveSection = (id: string) => {
    if (sectionTitle.trim()) updateSection(id, sectionTitle.trim());
    setEditingSection(null);
  };

  const startEditTask = (taskId: string, text: string, responsible: ChecklistTask['responsible']) => {
    setEditingTask(taskId);
    setTaskEdit({ text, responsible });
  };

  const saveTask = (sectionId: string, taskId: string) => {
    if (taskEdit.text.trim()) updateTask(sectionId, taskId, taskEdit.text.trim(), taskEdit.responsible);
    setEditingTask(null);
  };

  const submitNewTask = (sectionId: string) => {
    if (newTask.text.trim()) {
      addTask(sectionId, newTask.text.trim(), newTask.responsible);
      setNewTask({ text: '', responsible: 'both' });
      setAddingTaskTo(null);
    }
  };

  const submitNewSubtask = (sectionId: string, taskId: string) => {
    if (newSubtask.text.trim()) {
      addSubtask(sectionId, taskId, newSubtask.text.trim(), newSubtask.responsible);
      setNewSubtask({ text: '', responsible: 'both' });
      setAddingSubtaskTo(null);
      // Auto-expand the subtasks list so the user sees the newly-added subtask.
      setExpandedSubtasks(prev => ({ ...prev, [taskId]: true }));
    }
  };

  const startEditSubtask = (subtaskId: string, text: string, responsible: ChecklistSubtask['responsible']) => {
    setEditingSubtask(subtaskId);
    setSubtaskEdit({ text, responsible });
  };

  const saveSubtask = (sectionId: string, taskId: string, subtaskId: string) => {
    if (subtaskEdit.text.trim()) updateSubtask(sectionId, taskId, subtaskId, subtaskEdit.text.trim(), subtaskEdit.responsible);
    setEditingSubtask(null);
  };

  const triggerUpload = (sectionId: string, taskId: string) => {
    setPendingUpload({ sectionId, taskId });
    setUploadError('');
    setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !pendingUpload) return;
    const { sectionId, taskId } = pendingUpload;
    setUploadingFor(taskId);
    setUploadError('');
    try {
      await addTaskAttachment(sectionId, taskId, file, user?.name || 'Admin');
      setShowAttachmentsFor(taskId);
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploadingFor(null);
      setPendingUpload(null);
    }
  };

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={onFileSelected}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Process Flow</h1>
          <p className="text-gray-500 mt-1">The master onboarding process — shared across <span className="font-semibold text-gray-700">all franchisees</span>. Add sections, tasks and <span className="font-semibold text-gray-700">sub-tasks</span>, attach reference files. Changes propagate to every franchisee's onboarding checklist immediately.</p>
        </div>
        <button onClick={() => setShowNewSection(true)} className="bg-[#C41E3A] hover:bg-[#a01830] text-white px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Section
        </button>
      </div>


      {uploadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 flex items-center justify-between">
          <span>{uploadError}</span>
          <button onClick={() => setUploadError('')}><X className="h-4 w-4" /></button>
        </div>
      )}

      {showNewSection && (
        <div className="bg-white border border-[#C41E3A] rounded-xl p-4 flex gap-2">
          <input value={newSectionTitle} onChange={e => setNewSectionTitle(e.target.value)} placeholder="Section title..." className="flex-1 px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-[#C41E3A]" autoFocus />
          <button onClick={() => { if (newSectionTitle.trim()) { addSection(newSectionTitle.trim()); setNewSectionTitle(''); setShowNewSection(false); } }} className="bg-[#1a1a1a] text-white px-4 py-2 rounded-lg font-semibold">Add</button>
          <button onClick={() => { setShowNewSection(false); setNewSectionTitle(''); }} className="text-gray-500 px-3"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="space-y-3">
        {checklist.map((section, idx) => {
          const isOpen = expanded[section.id];
          const isFirst = idx === 0;
          const isLast = idx === checklist.length - 1;
          return (
            <div key={section.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-4 flex items-center gap-3">
                <button onClick={() => setExpanded({ ...expanded, [section.id]: !isOpen })} className="text-gray-400 hover:text-gray-700">
                  {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </button>
                {editingSection === section.id ? (
                  <>
                    <input value={sectionTitle} onChange={e => setSectionTitle(e.target.value)} className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg outline-none focus:border-[#C41E3A]" autoFocus />
                    <button onClick={() => saveSection(section.id)} className="text-green-600 hover:text-green-700"><Save className="h-4 w-4" /></button>
                    <button onClick={() => setEditingSection(null)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
                  </>
                ) : (
                  <>
                    <h3 className="flex-1 font-bold text-gray-900">{section.title}</h3>
                    <span className="text-xs text-gray-500">{section.tasks.length} tasks</span>
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => moveSection(section.id, 'up')}
                        disabled={isFirst}
                        title="Move section up"
                        className={`p-1.5 ${isFirst ? 'text-gray-200 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100 hover:text-[#C41E3A]'}`}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => moveSection(section.id, 'down')}
                        disabled={isLast}
                        title="Move section down"
                        className={`p-1.5 border-l border-gray-200 ${isLast ? 'text-gray-200 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100 hover:text-[#C41E3A]'}`}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </div>
                    <button onClick={() => startEditSection(section.id, section.title)} className="text-gray-400 hover:text-[#C41E3A]" title="Edit section title"><Edit2 className="h-4 w-4" /></button>
                    <button onClick={() => { if (confirm(`Delete "${section.title}" and all its tasks?`)) deleteSection(section.id); }} className="text-gray-400 hover:text-red-600" title="Delete section"><Trash2 className="h-4 w-4" /></button>
                  </>
                )}
              </div>

              {isOpen && (
                <div className="border-t border-gray-100">
                  {section.tasks.map((task, tIdx) => {
                    const isFirstTask = tIdx === 0;
                    const isLastTask = tIdx === section.tasks.length - 1;
                    const attachments = task.attachments || [];
                    const subtasks = task.subtasks || [];
                    const isMoving = movingTask?.taskId === task.id;
                    const showAttachments = showAttachmentsFor === task.id;
                    const subtasksOpen = !!expandedSubtasks[task.id];
                    const addingSub = addingSubtaskTo === task.id;
                    return (
                      <div key={task.id} className="border-b border-gray-50 last:border-0">
                        <div className="p-3 flex items-center gap-2 hover:bg-gray-50">
                          <div className="h-4 w-4 border-2 border-gray-300 rounded flex-shrink-0" />
                          {editingTask === task.id ? (
                            <>
                              <input value={taskEdit.text} onChange={e => setTaskEdit({ ...taskEdit, text: e.target.value })} className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded outline-none focus:border-[#C41E3A]" autoFocus />
                              <select value={taskEdit.responsible} onChange={e => setTaskEdit({ ...taskEdit, responsible: e.target.value as ChecklistTask['responsible'] })} className="text-xs border border-gray-300 rounded px-2 py-1">
                                <option value="franchisor">Franchisor</option>
                                <option value="franchisee">Franchisee</option>
                                <option value="both">Both</option>
                              </select>
                              <button onClick={() => saveTask(section.id, task.id)} className="text-green-600"><Save className="h-4 w-4" /></button>
                              <button onClick={() => setEditingTask(null)} className="text-gray-400"><X className="h-4 w-4" /></button>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 text-sm text-gray-800">{task.text}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                task.responsible === 'franchisor' ? 'bg-blue-50 text-blue-700' :
                                task.responsible === 'franchisee' ? 'bg-amber-50 text-amber-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>{task.responsible}</span>

                              {/* Up/Down within section */}
                              <div className="flex items-center border border-gray-200 rounded overflow-hidden">
                                <button
                                  onClick={() => moveTask(section.id, task.id, 'up')}
                                  disabled={isFirstTask}
                                  title="Move task up"
                                  className={`p-1 ${isFirstTask ? 'text-gray-200 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100 hover:text-[#C41E3A]'}`}
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => moveTask(section.id, task.id, 'down')}
                                  disabled={isLastTask}
                                  title="Move task down"
                                  className={`p-1 border-l border-gray-200 ${isLastTask ? 'text-gray-200 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100 hover:text-[#C41E3A]'}`}
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </button>
                              </div>

                              {/* Move to another section */}
                              <button
                                onClick={() => setMovingTask(isMoving ? null : { sectionId: section.id, taskId: task.id })}
                                title="Move to another section"
                                className={`p-1 rounded ${isMoving ? 'bg-[#C41E3A]/10 text-[#C41E3A]' : 'text-gray-400 hover:text-[#C41E3A]'}`}
                              >
                                <Move className="h-3.5 w-3.5" />
                              </button>

                              {/* Attach file */}
                              <button
                                onClick={() => triggerUpload(section.id, task.id)}
                                disabled={uploadingFor === task.id}
                                title="Add attachment"
                                className={`p-1 rounded ${uploadingFor === task.id ? 'text-gray-300' : 'text-gray-400 hover:text-[#C41E3A]'}`}
                              >
                                <Paperclip className="h-3.5 w-3.5" />
                              </button>

                              {/* Add subtask */}
                              <button
                                onClick={() => {
                                  setAddingSubtaskTo(addingSub ? null : task.id);
                                  setNewSubtask({ text: '', responsible: 'both' });
                                  setExpandedSubtasks(prev => ({ ...prev, [task.id]: true }));
                                }}
                                title="Add sub-task"
                                className={`p-1 rounded ${addingSub ? 'bg-[#C41E3A]/10 text-[#C41E3A]' : 'text-gray-400 hover:text-[#C41E3A]'}`}
                              >
                                <ListTree className="h-3.5 w-3.5" />
                              </button>

                              {/* Subtask count toggle */}
                              {subtasks.length > 0 && (
                                <button
                                  onClick={() => setExpandedSubtasks(prev => ({ ...prev, [task.id]: !subtasksOpen }))}
                                  title={`${subtasks.length} sub-task${subtasks.length === 1 ? '' : 's'}`}
                                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold"
                                >
                                  <ListTree className="h-3 w-3" />
                                  {subtasks.length}
                                </button>
                              )}

                              {/* Toggle attachments list */}
                              {attachments.length > 0 && (
                                <button
                                  onClick={() => setShowAttachmentsFor(showAttachments ? null : task.id)}
                                  title={`${attachments.length} attachment${attachments.length === 1 ? '' : 's'}`}
                                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold"
                                >
                                  <FileText className="h-3 w-3" />
                                  {attachments.length}
                                </button>
                              )}

                              <button onClick={() => startEditTask(task.id, task.text, task.responsible)} className="text-gray-400 hover:text-[#C41E3A]" title="Edit task"><Edit2 className="h-3.5 w-3.5" /></button>
                              <button onClick={() => { if (confirm('Delete this task and all its sub-tasks?')) deleteTask(section.id, task.id); }} className="text-gray-400 hover:text-red-600" title="Delete task"><Trash2 className="h-3.5 w-3.5" /></button>
                            </>
                          )}
                        </div>

                        {/* Move-to-section panel */}
                        {isMoving && (
                          <div className="px-3 pb-3 -mt-1 flex items-center gap-2 bg-red-50/40 border-t border-red-100">
                            <span className="text-xs text-gray-600 ml-6">Move to:</span>
                            <select
                              defaultValue=""
                              onChange={(e) => {
                                const dest = e.target.value;
                                if (dest && dest !== section.id) {
                                  moveTaskToSection(section.id, task.id, dest);
                                  setMovingTask(null);
                                }
                              }}
                              className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                            >
                              <option value="" disabled>Select destination section…</option>
                              {checklist.filter(s => s.id !== section.id).map(s => (
                                <option key={s.id} value={s.id}>{s.title}</option>
                              ))}
                            </select>
                            <button onClick={() => setMovingTask(null)} className="text-gray-500 text-xs px-2">Cancel</button>
                          </div>
                        )}

                        {/* Sub-tasks list */}
                        {subtasksOpen && subtasks.length > 0 && (
                          <div className="px-3 pb-2 ml-6 border-l-2 border-indigo-100 pl-3 mt-1 space-y-1">
                            {subtasks.map((st, sIdx) => {
                              const isFirstSub = sIdx === 0;
                              const isLastSub = sIdx === subtasks.length - 1;
                              const editingThis = editingSubtask === st.id;
                              return (
                                <div key={st.id} className="flex items-center gap-2 px-2 py-1.5 bg-indigo-50/40 hover:bg-indigo-50 rounded text-sm">
                                  <div className="h-3 w-3 border-2 border-indigo-300 rounded-sm flex-shrink-0" />
                                  {editingThis ? (
                                    <>
                                      <input
                                        value={subtaskEdit.text}
                                        onChange={e => setSubtaskEdit({ ...subtaskEdit, text: e.target.value })}
                                        className="flex-1 px-2 py-0.5 text-sm border border-gray-300 rounded outline-none focus:border-[#C41E3A]"
                                        autoFocus
                                        onKeyDown={e => e.key === 'Enter' && saveSubtask(section.id, task.id, st.id)}
                                      />
                                      <select
                                        value={subtaskEdit.responsible}
                                        onChange={e => setSubtaskEdit({ ...subtaskEdit, responsible: e.target.value as ChecklistSubtask['responsible'] })}
                                        className="text-xs border border-gray-300 rounded px-1.5 py-0.5"
                                      >
                                        <option value="franchisor">Franchisor</option>
                                        <option value="franchisee">Franchisee</option>
                                        <option value="both">Both</option>
                                      </select>
                                      <button onClick={() => saveSubtask(section.id, task.id, st.id)} className="text-green-600"><Save className="h-3.5 w-3.5" /></button>
                                      <button onClick={() => setEditingSubtask(null)} className="text-gray-400"><X className="h-3.5 w-3.5" /></button>
                                    </>
                                  ) : (
                                    <>
                                      <span className="flex-1 text-gray-800">{st.text}</span>
                                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                        st.responsible === 'franchisor' ? 'bg-blue-50 text-blue-700' :
                                        st.responsible === 'franchisee' ? 'bg-amber-50 text-amber-700' :
                                        'bg-gray-100 text-gray-700'
                                      }`}>{st.responsible}</span>
                                      <div className="flex items-center border border-gray-200 rounded overflow-hidden bg-white">
                                        <button
                                          onClick={() => moveSubtask(section.id, task.id, st.id, 'up')}
                                          disabled={isFirstSub}
                                          title="Move sub-task up"
                                          className={`p-0.5 ${isFirstSub ? 'text-gray-200 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100 hover:text-[#C41E3A]'}`}
                                        >
                                          <ArrowUp className="h-3 w-3" />
                                        </button>
                                        <button
                                          onClick={() => moveSubtask(section.id, task.id, st.id, 'down')}
                                          disabled={isLastSub}
                                          title="Move sub-task down"
                                          className={`p-0.5 border-l border-gray-200 ${isLastSub ? 'text-gray-200 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100 hover:text-[#C41E3A]'}`}
                                        >
                                          <ArrowDown className="h-3 w-3" />
                                        </button>
                                      </div>
                                      <button
                                        onClick={() => startEditSubtask(st.id, st.text, st.responsible)}
                                        className="text-gray-400 hover:text-[#C41E3A]"
                                        title="Edit sub-task"
                                      >
                                        <Edit2 className="h-3 w-3" />
                                      </button>
                                      <button
                                        onClick={() => { if (confirm('Delete this sub-task?')) deleteSubtask(section.id, task.id, st.id); }}
                                        className="text-gray-400 hover:text-red-600"
                                        title="Delete sub-task"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Inline new-subtask form */}
                        {addingSub && (
                          <div className="px-3 pb-3 ml-6 border-l-2 border-indigo-200 pl-3 mt-1 flex gap-2 items-center bg-indigo-50/30 py-2 rounded-r">
                            <ListTree className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
                            <input
                              value={newSubtask.text}
                              onChange={e => setNewSubtask({ ...newSubtask, text: e.target.value })}
                              placeholder="New sub-task..."
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded outline-none focus:border-[#C41E3A]"
                              autoFocus
                              onKeyDown={e => e.key === 'Enter' && submitNewSubtask(section.id, task.id)}
                            />
                            <select
                              value={newSubtask.responsible}
                              onChange={e => setNewSubtask({ ...newSubtask, responsible: e.target.value as ChecklistSubtask['responsible'] })}
                              className="text-xs border border-gray-300 rounded px-2 py-1"
                            >
                              <option value="franchisor">Franchisor</option>
                              <option value="franchisee">Franchisee</option>
                              <option value="both">Both</option>
                            </select>
                            <button
                              onClick={() => submitNewSubtask(section.id, task.id)}
                              className="bg-[#1a1a1a] text-white px-3 py-1 rounded text-xs font-semibold"
                            >
                              Add sub-task
                            </button>
                            <button onClick={() => setAddingSubtaskTo(null)} className="text-gray-500 px-1"><X className="h-3.5 w-3.5" /></button>
                          </div>
                        )}

                        {/* Attachments list */}
                        {showAttachments && attachments.length > 0 && (
                          <div className="px-3 pb-3 -mt-1 ml-6 space-y-1.5 bg-gray-50/60 border-t border-gray-100 pt-2">
                            {attachments.map(att => (
                              <div key={att.id} className="flex items-center gap-2 px-2 py-1.5 bg-white border border-gray-200 rounded text-xs">
                                <FileText className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                                <span className="flex-1 truncate text-gray-800">{att.name}</span>
                                <span className="text-gray-400">{att.size}</span>
                                <span className="text-gray-400 hidden sm:inline">{new Date(att.uploadedAt).toLocaleDateString()}</span>
                                <button
                                  onClick={() => downloadFile(att.url, att.name)}
                                  className="p-1 text-gray-500 hover:text-[#C41E3A]"
                                  title="Download"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => { if (confirm(`Delete attachment "${att.name}"?`)) removeTaskAttachment(section.id, task.id, att.id, att.filePath); }}
                                  className="p-1 text-gray-400 hover:text-red-600"
                                  title="Delete attachment"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {addingTaskTo === section.id ? (
                    <div className="p-3 bg-gray-50 flex gap-2">
                      <input value={newTask.text} onChange={e => setNewTask({ ...newTask, text: e.target.value })} placeholder="New task..." className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded outline-none focus:border-[#C41E3A]" autoFocus onKeyDown={e => e.key === 'Enter' && submitNewTask(section.id)} />
                      <select value={newTask.responsible} onChange={e => setNewTask({ ...newTask, responsible: e.target.value as ChecklistTask['responsible'] })} className="text-xs border border-gray-300 rounded px-2">
                        <option value="franchisor">Franchisor</option>
                        <option value="franchisee">Franchisee</option>
                        <option value="both">Both</option>
                      </select>
                      <button onClick={() => submitNewTask(section.id)} className="bg-[#1a1a1a] text-white px-3 py-1.5 rounded text-sm font-semibold">Add</button>
                      <button onClick={() => setAddingTaskTo(null)} className="text-gray-500 px-2"><X className="h-4 w-4" /></button>
                    </div>
                  ) : (
                    <button onClick={() => setAddingTaskTo(section.id)} className="w-full p-3 text-sm text-[#C41E3A] hover:bg-red-50 font-semibold flex items-center justify-center gap-2">
                      <Plus className="h-4 w-4" /> Add Task
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChecklistBuilder;
