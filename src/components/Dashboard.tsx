import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Users, UserPlus, FileText, CheckCircle2, TrendingUp, Clock, Briefcase } from 'lucide-react';

interface DashboardProps {
  onNavigate: (page: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { leads, franchisees, documents, checklist, progress } = useData();
  if (!user) return null;

  const totalTasks = checklist.reduce((sum, s) => sum + s.tasks.length, 0);

  const franchiseeProgress = (fid: string) => {
    const fp = progress[fid];
    if (!fp) return 0;
    const done = Object.values(fp.tasks).filter(t => t.completed).length;
    return totalTasks ? Math.round((done / totalTasks) * 100) : 0;
  };

  // FRANCHISEE-specific dashboard
  if (user.role === 'franchisee' && user.franchiseeId) {
    const me = franchisees.find(f => f.id === user.franchiseeId);
    const myProgress = franchiseeProgress(user.franchiseeId);
    const fp = progress[user.franchiseeId];
    const completed = fp ? Object.values(fp.tasks).filter(t => t.completed).length : 0;
    const pending = totalTasks - completed;

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-[#1a1a1a] to-[#C41E3A] rounded-2xl p-8 text-white">
          <h1 className="text-3xl font-bold">Welcome, {user.name.split(' ')[0]}</h1>
          <p className="text-white/80 mt-2">{me?.territory} territory • Launch date: {me?.startDate}</p>
          <div className="mt-6 bg-white/10 backdrop-blur rounded-xl p-5 max-w-xl border border-white/20">
            <div className="flex justify-between text-sm mb-2">
              <span>Onboarding Progress</span>
              <span className="font-bold">{myProgress}%</span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all" style={{ width: `${myProgress}%` }} />
            </div>
            <div className="mt-3 text-xs text-white/70">{completed} of {totalTasks} tasks complete</div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Tasks" value={totalTasks} icon={<Briefcase className="h-5 w-5" />} color="bg-blue-50 text-blue-700" />
          <StatCard label="Completed" value={completed} icon={<CheckCircle2 className="h-5 w-5" />} color="bg-green-50 text-green-700" />
          <StatCard label="Pending" value={pending} icon={<Clock className="h-5 w-5" />} color="bg-amber-50 text-amber-700" />
          <StatCard label="Documents" value={documents.length} icon={<FileText className="h-5 w-5" />} color="bg-purple-50 text-purple-700" />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <button onClick={() => onNavigate('my-onboarding')} className="bg-white p-6 rounded-xl border border-gray-200 hover:shadow-lg hover:border-[#C41E3A] transition text-left">
            <Briefcase className="h-8 w-8 text-[#C41E3A] mb-3" />
            <h3 className="font-bold text-lg">Continue Onboarding</h3>
            <p className="text-gray-500 text-sm mt-1">View and complete your onboarding checklist tasks.</p>
          </button>
          <button onClick={() => onNavigate('documents')} className="bg-white p-6 rounded-xl border border-gray-200 hover:shadow-lg hover:border-[#C41E3A] transition text-left">
            <FileText className="h-8 w-8 text-[#C41E3A] mb-3" />
            <h3 className="font-bold text-lg">Document Vault</h3>
            <p className="text-gray-500 text-sm mt-1">Access franchise agreements, manuals & training materials.</p>
          </button>
        </div>
      </div>
    );
  }

  // SALES dashboard
  if (user.role === 'sales') {
    const myLeads = leads.filter(l => l.assignedTo === user.id || true);
    const newLeads = myLeads.filter(l => l.status === 'new').length;
    const qualified = myLeads.filter(l => l.status === 'qualified').length;
    const converted = myLeads.filter(l => l.status === 'converted').length;

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sales Dashboard</h1>
          <p className="text-gray-500 mt-1">Manage your franchise enquiry pipeline.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Leads" value={myLeads.length} icon={<UserPlus className="h-5 w-5" />} color="bg-blue-50 text-blue-700" />
          <StatCard label="New" value={newLeads} icon={<TrendingUp className="h-5 w-5" />} color="bg-amber-50 text-amber-700" />
          <StatCard label="Qualified" value={qualified} icon={<CheckCircle2 className="h-5 w-5" />} color="bg-green-50 text-green-700" />
          <StatCard label="Converted" value={converted} icon={<Briefcase className="h-5 w-5" />} color="bg-purple-50 text-purple-700" />
        </div>

        <button onClick={() => onNavigate('leads')} className="bg-[#C41E3A] text-white px-6 py-3 rounded-lg font-bold hover:bg-[#a01830] transition">
          Open Lead Pipeline
        </button>
      </div>
    );
  }

  // ADMIN dashboard
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Administrator Dashboard</h1>
        <p className="text-gray-500 mt-1">Full overview of your franchise network.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Franchisees" value={franchisees.length} icon={<Users className="h-5 w-5" />} color="bg-blue-50 text-blue-700" />
        <StatCard label="Active Leads" value={leads.filter(l => l.status !== 'converted' && l.status !== 'lost').length} icon={<UserPlus className="h-5 w-5" />} color="bg-amber-50 text-amber-700" />
        <StatCard label="Documents" value={documents.length} icon={<FileText className="h-5 w-5" />} color="bg-purple-50 text-purple-700" />
        <StatCard label="Checklist Tasks" value={totalTasks} icon={<CheckCircle2 className="h-5 w-5" />} color="bg-green-50 text-green-700" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Franchisee Onboarding Progress</h2>
        {franchisees.length === 0 ? (
          <p className="text-gray-500 text-sm">No franchisees yet. Convert a lead from the Leads Pipeline.</p>
        ) : (
          <div className="space-y-4">
            {franchisees.map(f => {
              const pct = franchiseeProgress(f.id);
              return (
                <div key={f.id} className="flex items-center gap-4 p-4 border border-gray-100 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => onNavigate('franchisees')}>
                  <div className="h-10 w-10 rounded-full bg-[#C41E3A] text-white flex items-center justify-center font-bold">
                    {f.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{f.name}</div>
                    <div className="text-xs text-gray-500">{f.territory} • Started {f.startDate}</div>
                  </div>
                  <div className="w-64">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">Progress</span>
                      <span className="font-bold text-gray-900">{pct}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#C41E3A] transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <QuickLink title="Manage Leads" desc="View enquiry pipeline" onClick={() => onNavigate('leads')} />
        <QuickLink title="Process Flow" desc="Edit shared onboarding steps" onClick={() => onNavigate('checklist-builder')} />

        <QuickLink title="Documents" desc="Upload central files" onClick={() => onNavigate('documents')} />
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number; icon: React.ReactNode; color: string }> = ({ label, value, icon, color }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5">
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm text-gray-500">{label}</div>
        <div className="text-3xl font-bold text-gray-900 mt-1">{value}</div>
      </div>
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${color}`}>{icon}</div>
    </div>
  </div>
);

const QuickLink: React.FC<{ title: string; desc: string; onClick: () => void }> = ({ title, desc, onClick }) => (
  <button onClick={onClick} className="bg-white p-5 rounded-xl border border-gray-200 hover:shadow-lg hover:border-[#C41E3A] transition text-left">
    <div className="font-bold text-gray-900">{title}</div>
    <div className="text-sm text-gray-500 mt-1">{desc}</div>
  </button>
);

export default Dashboard;
