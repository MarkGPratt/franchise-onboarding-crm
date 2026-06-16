import React, { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { notify } from '@/lib/notify';
import { ChevronDown, ChevronRight, MessageSquare, Upload, Check, Paperclip, User, Download, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { ACCEPT_ATTR, MAX_FILE_SIZE_MB, downloadFile, validateFile } from '@/lib/uploads';

interface Props {
  franchiseeId: string;
}

const OnboardingFlow: React.FC<Props> = ({ franchiseeId }) => {
  const { checklist, progress, toggleTask, addTaskComment, uploadTaskFile, removeTaskUpload, franchisees } = useData();
  const { user, users } = useAuth();
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    if (checklist[0]) init[checklist[0].id] = true;
    return init;
  });
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [uploadingTask, setUploadingTask] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<{ taskId: string; message: string } | null>(null);

  if (!user) return null;
  const franchisee = franchisees.find(f => f.id === franchiseeId);
  const fp = progress[franchiseeId];

  // Find login account for the franchisee (so we can email them)
  const franchiseeUser = users.find(u => u.role === 'franchisee' && u.franchiseeId === franchiseeId);
  const adminUsers = users.filter(u => u.role === 'admin');
  const isStaff = user.role === 'admin' || user.role === 'sales';

  const findTaskText = (taskId: string) => {
    for (const s of checklist) {
      const t = s.tasks.find(t => t.id === taskId);
      if (t) return t.text;
    }
    return '';
  };

  const notifyFranchiseeOfTaskAction = (taskId: string, action: string, detail = '') => {
    if (!franchiseeUser) return;
    notify({
      event_type: 'task_updated',
      recipient_email: franchiseeUser.email,
      recipient_user_id: franchiseeUser.id,
      recipient_name: franchiseeUser.name,
      variables: {
        actor_name: user.name,
        actor_role: user.role,
        action,
        task_text: findTaskText(taskId),
        detail,
      },
    });
  };

  const notifyAdminsOfFranchiseeAction = (action: string, detail: string) => {
    adminUsers.forEach(admin => {
      notify({
        event_type: 'franchisee_progress',
        recipient_email: admin.email,
        recipient_user_id: admin.id,
        recipient_name: admin.name,
        variables: {
          franchisee_name: franchisee?.name || 'A franchisee',
          action,
          detail,
        },
      });
    });
  };

  const getTaskState = (taskId: string) => fp?.tasks[taskId];

  const sectionStats = (sectionId: string) => {
    const section = checklist.find(s => s.id === sectionId);
    if (!section) return { done: 0, total: 0 };
    const done = section.tasks.filter(t => getTaskState(t.id)?.completed).length;
    return { done, total: section.tasks.length };
  };

  const totalDone = checklist.reduce((sum, s) => sum + s.tasks.filter(t => getTaskState(t.id)?.completed).length, 0);
  const totalTasks = checklist.reduce((sum, s) => sum + s.tasks.length, 0);
  const overallPct = totalTasks ? Math.round((totalDone / totalTasks) * 100) : 0;

  const handleToggle = (taskId: string) => {
    const wasCompleted = getTaskState(taskId)?.completed || false;
    toggleTask(franchiseeId, taskId, user.name);
    const taskText = findTaskText(taskId);
    if (!wasCompleted) {
      if (user.role === 'franchisee') {
        notifyAdminsOfFranchiseeAction('completed an onboarding task', `Task: "${taskText}"`);
      } else if (isStaff) {
        notifyFranchiseeOfTaskAction(taskId, 'marked complete', '');
      }
    }
  };

  const handleAddComment = (taskId: string) => {
    if (!commentText.trim()) return;
    const txt = commentText;
    addTaskComment(franchiseeId, taskId, user.name, user.role, txt);
    setCommentText('');
    if (isStaff) {
      notifyFranchiseeOfTaskAction(taskId, 'commented', `Comment: "${txt}"`);
    } else if (user.role === 'franchisee') {
      notifyAdminsOfFranchiseeAction('commented on an onboarding task', `Task: "${findTaskText(taskId)}"\nComment: "${txt}"`);
    }
  };

  const handleFileUpload = async (taskId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const v = validateFile(file);
    if (!v.ok) {
      setUploadError({ taskId, message: v.error || 'Invalid file' });
      return;
    }

    setUploadError(null);
    setUploadingTask(taskId);
    try {
      await uploadTaskFile(franchiseeId, taskId, file, user.name);
      if (user.role === 'franchisee') {
        notifyAdminsOfFranchiseeAction('uploaded a document', `Task: "${findTaskText(taskId)}"\nFile: ${file.name}`);
      } else if (isStaff) {
        notifyFranchiseeOfTaskAction(taskId, 'uploaded a document', `File: ${file.name}`);
      }
    } catch (err: any) {
      setUploadError({ taskId, message: err.message || 'Upload failed' });
    } finally {
      setUploadingTask(null);
    }
  };

  const handleDeleteUpload = async (taskId: string, uploadId: string, filePath: string, name: string) => {
    if (!confirm(`Delete ${name}? This permanently removes the file.`)) return;
    try {
      await removeTaskUpload(franchiseeId, taskId, uploadId, filePath);
    } catch (err: any) {
      alert('Delete failed: ' + (err.message || 'Unknown error'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#1a1a1a] to-[#C41E3A] rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold">{franchisee?.name}'s Onboarding</h2>
            <p className="text-white/70 text-sm">{franchisee?.territory} • Launch: {franchisee?.startDate}</p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-extrabold">{overallPct}%</div>
            <div className="text-xs text-white/70">{totalDone}/{totalTasks} tasks</div>
          </div>
        </div>
        <div className="mt-4 h-2 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white" style={{ width: `${overallPct}%` }} />
        </div>
      </div>

      <div className="space-y-3">
        {checklist.map(section => {
          const { done, total } = sectionStats(section.id);
          const pct = total ? Math.round((done / total) * 100) : 0;
          const isOpen = expanded[section.id];
          return (
            <div key={section.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setExpanded({ ...expanded, [section.id]: !isOpen })}
                className="w-full p-5 flex items-center gap-4 hover:bg-gray-50 transition text-left"
              >
                {isOpen ? <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" /> : <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900">{section.title}</h3>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex-1 max-w-xs h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#C41E3A]" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 font-medium">{done}/{total}</span>
                  </div>
                </div>
                {done === total && total > 0 && (
                  <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center gap-1">
                    <Check className="h-3 w-3" /> Complete
                  </span>
                )}
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 divide-y divide-gray-100">
                  {section.tasks.length === 0 && <div className="p-5 text-sm text-gray-500">No tasks in this section.</div>}
                  {section.tasks.map(task => {
                    const ts = getTaskState(task.id);
                    const isOpenTask = openTask === task.id;
                    const isUploading = uploadingTask === task.id;
                    const taskError = uploadError?.taskId === task.id ? uploadError.message : null;
                    return (
                      <div key={task.id} className="p-4 hover:bg-gray-50/50">
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => handleToggle(task.id)}
                            className={`mt-0.5 h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${
                              ts?.completed ? 'bg-[#C41E3A] border-[#C41E3A]' : 'border-gray-300 hover:border-[#C41E3A]'
                            }`}
                          >
                            {ts?.completed && <Check className="h-3.5 w-3.5 text-white" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm ${ts?.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                              {task.text}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                              <span className={`px-2 py-0.5 rounded-full font-semibold ${
                                task.responsible === 'franchisor' ? 'bg-blue-50 text-blue-700' :
                                task.responsible === 'franchisee' ? 'bg-amber-50 text-amber-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {task.responsible}
                              </span>
                              {ts?.completed && ts.completedAt && (
                                <span className="flex items-center gap-1"><Check className="h-3 w-3 text-green-600" /> {new Date(ts.completedAt).toLocaleString()} by {ts.completedBy}</span>
                              )}
                              {ts && ts.comments.length > 0 && <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {ts.comments.length}</span>}
                              {ts && ts.uploads.length > 0 && <span className="flex items-center gap-1"><Paperclip className="h-3 w-3" /> {ts.uploads.length}</span>}
                              {(task.attachments || []).length > 0 && (
                                <span className="flex items-center gap-1 text-indigo-700 font-semibold">
                                  <Paperclip className="h-3 w-3" /> {task.attachments!.length} reference{task.attachments!.length === 1 ? '' : 's'}
                                </span>
                              )}
                            </div>

                            {/* Sub-tasks (admin-defined). Tick-state is shared with task_progress
                                because each sub-task has a unique id we can pass to toggleTask. */}
                            {(task.subtasks || []).length > 0 && (
                              <ul className="mt-2 ml-1 space-y-1 border-l-2 border-indigo-100 pl-3">
                                {(task.subtasks || []).map(st => {
                                  const sts = getTaskState(st.id);
                                  return (
                                    <li key={st.id} className="flex items-center gap-2">
                                      <button
                                        onClick={() => handleToggle(st.id)}
                                        className={`h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${
                                          sts?.completed ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300 hover:border-indigo-500'
                                        }`}
                                      >
                                        {sts?.completed && <Check className="h-3 w-3 text-white" />}
                                      </button>
                                      <span className={`text-xs ${sts?.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                                        {st.text}
                                      </span>
                                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                        st.responsible === 'franchisor' ? 'bg-blue-50 text-blue-700' :
                                        st.responsible === 'franchisee' ? 'bg-amber-50 text-amber-700' :
                                        'bg-gray-100 text-gray-700'
                                      }`}>{st.responsible}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                          <button
                            onClick={() => { setOpenTask(isOpenTask ? null : task.id); setCommentText(''); setUploadError(null); }}
                            className="text-xs font-semibold text-[#C41E3A] hover:underline"
                          >
                            {isOpenTask ? 'Close' : 'Details'}
                          </button>
                        </div>

                        {isOpenTask && (
                          <div className="mt-4 ml-8 space-y-3 bg-gray-50 rounded-lg p-4 border border-gray-100">
                            {/* Admin-provided reference attachments (read-only for everyone) */}
                            {(task.attachments || []).length > 0 && (
                              <div>
                                <div className="text-xs font-bold text-indigo-700 uppercase mb-2 flex items-center gap-1.5">
                                  <Paperclip className="h-3 w-3" /> Reference Files from Admin
                                </div>
                                <div className="space-y-1">
                                  {(task.attachments || []).map(att => (
                                    <div key={att.id} className="flex items-center gap-2 text-sm bg-indigo-50 border border-indigo-100 px-3 py-2 rounded">
                                      <Paperclip className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
                                      <span className="flex-1 truncate" title={att.name}>{att.name}</span>
                                      {att.size && <span className="text-xs text-gray-500">{att.size}</span>}
                                      <span className="text-xs text-gray-500 hidden sm:inline">{new Date(att.uploadedAt).toLocaleDateString()}</span>
                                      <button
                                        onClick={() => downloadFile(att.url, att.name)}
                                        title="Download reference file"
                                        className="text-indigo-600 hover:text-indigo-800"
                                      >
                                        <Download className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Uploads (per-franchisee progress files) */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-gray-600 uppercase">Your Uploads</span>
                                <label className={`text-xs font-semibold text-[#C41E3A] hover:underline flex items-center gap-1 ${isUploading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}>
                                  {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                                  {isUploading ? 'Uploading...' : 'Upload File'}
                                  <input
                                    type="file"
                                    accept={ACCEPT_ATTR}
                                    className="hidden"
                                    onChange={e => handleFileUpload(task.id, e)}
                                    disabled={isUploading}
                                  />
                                </label>
                              </div>
                              <p className="text-[11px] text-gray-400 mb-2">Max {MAX_FILE_SIZE_MB} MB. PDF, Office, images & archives accepted.</p>
                              {taskError && (
                                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded p-2 mb-2 flex items-start gap-1.5">
                                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                                  <span>{taskError}</span>
                                </div>
                              )}
                              {ts?.uploads.length ? (
                                <div className="space-y-1">
                                  {ts.uploads.map(u => (
                                    <div key={u.id} className="flex items-center gap-2 text-sm bg-white px-3 py-2 rounded border border-gray-100">
                                      <Paperclip className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                                      <span className="flex-1 truncate" title={u.name}>{u.name}</span>
                                      {u.size && <span className="text-xs text-gray-400">{u.size}</span>}
                                      <span className="text-xs text-gray-400">{new Date(u.date).toLocaleDateString()}</span>
                                      <button
                                        onClick={() => downloadFile(u.url, u.name)}
                                        title="Download"
                                        className="text-gray-400 hover:text-[#C41E3A]"
                                      >
                                        <Download className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteUpload(task.id, u.id, u.filePath, u.name)}
                                        title="Delete"
                                        className="text-gray-400 hover:text-red-600"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-400">No files uploaded yet.</p>
                              )}
                            </div>


                            {/* Comments */}
                            <div>
                              <div className="text-xs font-bold text-gray-600 uppercase mb-2">Discussion</div>
                              <div className="space-y-2 max-h-48 overflow-y-auto mb-2">
                                {ts?.comments.length ? ts.comments.map(c => (
                                  <div key={c.id} className="bg-white rounded p-2.5 border border-gray-100">
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="font-semibold text-gray-900 flex items-center gap-1"><User className="h-3 w-3" /> {c.author} <span className="text-gray-400">({c.role})</span></span>
                                      <span className="text-gray-400">{new Date(c.date).toLocaleString()}</span>
                                    </div>
                                    <div className="text-sm text-gray-700 mt-1">{c.text}</div>
                                  </div>
                                )) : <p className="text-xs text-gray-400">No comments yet.</p>}
                              </div>
                              <div className="flex gap-2">
                                <input
                                  value={commentText}
                                  onChange={e => setCommentText(e.target.value)}
                                  placeholder="Add a comment..."
                                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-[#C41E3A]"
                                  onKeyDown={e => e.key === 'Enter' && handleAddComment(task.id)}
                                />
                                <button onClick={() => handleAddComment(task.id)} className="bg-[#1a1a1a] text-white px-3 py-2 rounded-lg text-sm font-semibold">Post</button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OnboardingFlow;
