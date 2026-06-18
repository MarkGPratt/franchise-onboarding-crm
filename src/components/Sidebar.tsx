import React, { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, Users, Briefcase, FileText, ListChecks, LogOut, UserPlus, Bell, Mail, ShieldCheck, Search, ChevronUp, Settings } from 'lucide-react';



import { useAuth } from '@/contexts/AuthContext';
import { LOGO_URL } from '@/lib/seedData';

interface SidebarProps {
  current: string;
  onChange: (page: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ current, onChange }) => {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  if (!user) return null;

  const items: { id: string; label: string; icon: any; roles: string[] }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'sales', 'franchisee'] },
    { id: 'leads', label: 'Leads Pipeline', icon: UserPlus, roles: ['admin', 'sales'] },
    { id: 'franchisees', label: 'Franchisees', icon: Users, roles: ['admin', 'sales'] },
    { id: 'checklist-builder', label: 'Process Flow', icon: ListChecks, roles: ['admin', 'franchisee'] },
    { id: 'documents', label: 'Document Vault', icon: FileText, roles: ['admin', 'sales', 'franchisee'] },
    { id: 'notes-search', label: 'Notes Search', icon: Search, roles: ['admin', 'sales'] },
    { id: 'email-templates', label: 'Email Templates', icon: Mail, roles: ['admin'] },
    { id: 'admin', label: 'Administration', icon: ShieldCheck, roles: ['admin'] },
    { id: 'notifications', label: 'Notifications', icon: Bell, roles: ['admin', 'sales', 'franchisee'] },
  ];


  const visible = items.filter(i => i.roles.includes(user.role));

  return (
    <aside className="w-64 bg-[#1a1a1a] text-white flex flex-col h-screen sticky top-0">
      <div className="p-5 border-b border-white/10">
        <div className="bg-white rounded-lg p-2 inline-block">
          <img src={LOGO_URL} alt="The Surgeon Group" className="h-10 w-auto" />
        </div>
        <div className="mt-3 text-xs text-white/60 uppercase tracking-wider">Onboarding CRM</div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {visible.map(item => {
          const Icon = item.icon;
          const active = current === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${
                active
                  ? 'bg-[#C41E3A] text-white shadow-lg'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10 relative" ref={menuRef}>
        {/* User menu pop-over */}
        {menuOpen && (
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-[#262626] border border-white/10 rounded-lg shadow-2xl overflow-hidden">
            <button
              onClick={() => { setMenuOpen(false); onChange('account-settings'); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-white hover:bg-white/10 transition text-left"
            >
              <Settings className="h-4 w-4" /> Account Settings
            </button>
            <button
              onClick={() => { setMenuOpen(false); logout(); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-white hover:bg-white/10 transition text-left border-t border-white/10"
            >
              <LogOut className="h-4 w-4" /> Sign Out
            </button>
          </div>
        )}

        <button
          onClick={() => setMenuOpen(v => !v)}
          className={`w-full flex items-center gap-3 p-2 rounded-lg transition ${menuOpen ? 'bg-white/5' : 'hover:bg-white/5'}`}
        >
          <div className="h-10 w-10 rounded-full bg-[#C41E3A] flex items-center justify-center font-bold flex-shrink-0">
            {user.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-sm font-semibold truncate">{user.name}</div>
            <div className="text-xs text-white/50 capitalize">{user.role}</div>
          </div>
          <ChevronUp className={`h-4 w-4 text-white/50 transition-transform ${menuOpen ? '' : 'rotate-180'}`} />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;

