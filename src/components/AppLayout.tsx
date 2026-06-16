import React, { useState } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { DataProvider } from '@/contexts/DataContext';
import Login from './Login';
import Sidebar from './Sidebar';
import Dashboard from './Dashboard';
import LeadsPage from './LeadsPage';
import FranchiseesPage from './FranchiseesPage';
import DocumentsPage from './DocumentsPage';
import ChecklistBuilder from './ChecklistBuilder';
import OnboardingFlow from './OnboardingFlow';
import NotificationPreferences from './NotificationPreferences';
import EmailTemplatesPage from './EmailTemplatesPage';
import AdminPanel from './AdminPanel';
import NotesSearchPage from './NotesSearchPage';
import AccountSettingsPage from './AccountSettingsPage';
import { Menu, X } from 'lucide-react';

export interface NavOptions { franchiseeId?: string; noteId?: string }
export type NavigateFn = (page: string, opts?: NavOptions) => void;

const Shell: React.FC = () => {
  const { user } = useAuth();
  const [page, setPage] = useState('dashboard');
  const [pageData, setPageData] = useState<NavOptions | undefined>(undefined);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return <Login />;

  // Restrict access based on role. account-settings is open to everyone.
  const allowedPages: Record<string, string[]> = {
    admin: ['dashboard', 'leads', 'franchisees', 'documents', 'checklist-builder', 'email-templates', 'admin', 'notifications', 'notes-search', 'account-settings'],
    sales: ['dashboard', 'leads', 'franchisees', 'documents', 'notifications', 'notes-search', 'account-settings'],
    franchisee: ['dashboard', 'my-onboarding', 'documents', 'notifications', 'account-settings'],
  };

  const currentPage = allowedPages[user.role].includes(page) ? page : 'dashboard';

  const navigate: NavigateFn = (p, opts) => {
    setPage(p);
    setPageData(opts);
    setMobileOpen(false);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'leads': return <LeadsPage />;
      case 'franchisees':
        return <FranchiseesPage initialFranchiseeId={pageData?.franchiseeId} initialNoteId={pageData?.noteId} />;
      case 'documents': return <DocumentsPage />;
      case 'checklist-builder': return <ChecklistBuilder />;
      case 'email-templates': return <EmailTemplatesPage />;
      case 'admin': return <AdminPanel />;
      case 'notifications': return <NotificationPreferences />;
      case 'notes-search': return <NotesSearchPage onJumpToNote={(fid, nid) => navigate('franchisees', { franchiseeId: fid, noteId: nid })} />;
      case 'account-settings': return <AccountSettingsPage />;

      case 'my-onboarding':
        return user.franchiseeId ? <OnboardingFlow franchiseeId={user.franchiseeId} /> : <div>No onboarding flow assigned.</div>;
      default: return <Dashboard onNavigate={navigate} />;
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-30 p-2 bg-[#1a1a1a] text-white rounded-lg shadow-lg"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Sidebar - desktop */}
      <div className="hidden lg:block">
        <Sidebar current={currentPage} onChange={(p) => navigate(p)} />
      </div>

      {/* Sidebar - mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative">
            <button onClick={() => setMobileOpen(false)} className="absolute right-2 top-2 z-10 text-white p-2">
              <X className="h-5 w-5" />
            </button>
            <Sidebar current={currentPage} onChange={(p) => navigate(p)} />
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0">
        <div className="p-6 lg:p-8 pt-16 lg:pt-8 max-w-7xl mx-auto">
          {renderPage()}
        </div>
      </main>
    </div>
  );
};

const AppLayout: React.FC = () => {
  return (
    <AuthProvider>
      <DataProvider>
        <Shell />
      </DataProvider>
    </AuthProvider>
  );
};

export default AppLayout;
