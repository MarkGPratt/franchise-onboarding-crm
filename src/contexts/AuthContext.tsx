import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/activity';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface DefaultUser {
  id: string;
  email: string;
  password?: string; // write-only — only used by admin forms, never stored
  name: string;
  role: 'admin' | 'sales' | 'franchisee';
  franchiseeId?: string;
}

interface AuthContextType {
  user: DefaultUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  users: DefaultUser[];
  addUser: (u: Omit<DefaultUser, 'id'>) => Promise<{ user: DefaultUser | null; error?: string }>;
  updateUser: (id: string, u: Partial<DefaultUser>) => Promise<{ ok: boolean; error?: string }>;
  deleteUser: (id: string) => Promise<{ ok: boolean; error?: string }>;
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mapProfile = (r: any): DefaultUser => ({
  id: r.id,
  email: r.email,
  name: r.name,
  role: (r.role || 'sales') as DefaultUser['role'],
  franchiseeId: r.franchisee_id || undefined,
});

// ---------------------------------------------------------------------------
// Best-effort login audit (never throws, never blocks)
// ---------------------------------------------------------------------------
const recordLoginAttempt = (params: {
  email: string;
  success: boolean;
  userId?: string | null;
  errorMessage?: string | null;
}) => {
  (async () => {
    try {
      await supabase.from('login_audit').insert({
        user_id: params.userId || null,
        email: params.email,
        ip: null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        success: params.success,
        error_message: params.errorMessage || null,
      });
    } catch {
      /* ignore */
    }
  })();
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<DefaultUser | null>(null);
  const [users, setUsers] = useState<DefaultUser[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) {
      console.warn('refreshUsers failed:', error.message);
      return;
    }
    if (data) setUsers(data.map(mapProfile));
  }, []);

  const loadProfile = useCallback(async (authUserId: string): Promise<DefaultUser | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUserId)
      .maybeSingle();
    if (error) {
      console.warn('loadProfile failed:', error.message);
      return null;
    }
    if (!data) {
      // Self-heal: if the auth user has no matching profile row (e.g. created
      // before the auto-trigger existed, or row was deleted), create one now
      // so the user can sign in. Defaults to the lowest-privilege role.
      const { data: authData } = await supabase.auth.getUser();
      const email = authData?.user?.email || '';
      const fallbackName =
        (authData?.user?.user_metadata as any)?.name ||
        (email ? email.split('@')[0] : 'User');
      const { data: inserted, error: insertErr } = await supabase
        .from('profiles')
        .insert({ id: authUserId, email, name: fallbackName, role: 'sales' })
        .select('*')
        .maybeSingle();
      if (insertErr || !inserted) {
        console.warn('loadProfile self-heal insert failed:', insertErr?.message);
        return null;
      }
      const profile = mapProfile(inserted);
      setUser(profile);
      return profile;
    }
    const profile = mapProfile(data);
    setUser(profile);
    return profile;
  }, []);


  // ---------------------------------------------------------------------
  // Bootstrap: just hydrate any existing session. No seeding, no repair.
  // ---------------------------------------------------------------------
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      if (session?.user) {
        await loadProfile(session.user.id);
        refreshUsers().catch(() => {});
      }
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        loadProfile(session.user.id).catch(() => {});
        refreshUsers().catch(() => {});
      } else {
        setUser(null);
        setUsers([]);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile, refreshUsers]);

  // ---------------------------------------------------------------------
  // Auth actions
  // ---------------------------------------------------------------------
  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    recordLoginAttempt({
      email,
      success: !error,
      userId: data?.user?.id || null,
      errorMessage: error?.message || null,
    });

    if (error) return { ok: false, error: error.message };
    if (!data?.user) return { ok: false, error: 'No user returned from sign-in.' };

    const profile = await loadProfile(data.user.id);
    if (!profile) {
      await supabase.auth.signOut().catch(() => {});
      return {
        ok: false,
        error: 'Sign-in succeeded but your profile could not be loaded. Please contact an administrator.',
      };
    }
    refreshUsers().catch(() => {});
    return { ok: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUsers([]);
  };

  // ---------------------------------------------------------------------
  // Admin actions (user management) — proxied through the edge function
  // so they run with the service-role key and bypass RLS.
  // ---------------------------------------------------------------------
  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) return { Authorization: `Bearer ${session.access_token}` };
    return {};
  };

  const addUser = async (
    u: Omit<DefaultUser, 'id'>,
  ): Promise<{ user: DefaultUser | null; error?: string }> => {
    const headers = await getAuthHeaders();
    const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const { data, error } = await supabase.functions.invoke('manage-users', {
      headers,
      body: {
        action: 'create',
        email: u.email,
        password: u.password,
        name: u.name,
        role: u.role,
        franchiseeId: u.franchiseeId || null,
        appUrl,
      },
    });

    const apiError = (data as any)?.error as string | undefined;
    if (error || apiError) {
      const msg = apiError || error?.message || 'Failed to create user.';
      console.error('addUser:', msg);
      return { user: null, error: msg };
    }

    const id = (data as any).id as string;
    await refreshUsers();

    logActivity({
      action: 'user.created',
      targetType: 'user',
      targetId: id,
      targetName: u.name,
      metadata: { email: u.email, role: u.role, franchiseeId: u.franchiseeId || null },
    });

    return {
      user: {
        id,
        email: u.email,
        name: u.name,
        role: u.role,
        franchiseeId: u.franchiseeId,
      },
    };
  };

  const updateUser = async (
    id: string,
    u: Partial<DefaultUser>,
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!id) return { ok: false, error: 'Missing user id.' };

    // ------------------------------------------------------------------
    // Step 1 — profile-only fields go directly to the `profiles` table
    // with an explicit WHERE clause so we can NEVER accidentally update
    // every row. (A previous version routed everything through the
    // `manage-users` edge function, which under some conditions would
    // overwrite multiple rows — symptom: "editing one user changed the
    // current user's name across all users".)
    // ------------------------------------------------------------------
    const profilePatch: Record<string, any> = {};
    if (u.name !== undefined) profilePatch.name = u.name;
    if (u.role !== undefined) profilePatch.role = u.role;
    if (u.franchiseeId !== undefined) profilePatch.franchisee_id = u.franchiseeId || null;
    // Mirror email into profiles only if it's being changed. The auth-level
    // email change happens through the edge function below.
    if (u.email !== undefined) profilePatch.email = u.email;

    if (Object.keys(profilePatch).length > 0) {
      const { error: profileErr } = await supabase
        .from('profiles')
        .update(profilePatch)
        .eq('id', id);
      if (profileErr) {
        console.error('updateUser profile patch failed:', profileErr.message);
        return { ok: false, error: profileErr.message };
      }
    }

    // ------------------------------------------------------------------
    // Step 2 — auth-level changes (email, password) still require the
    // service-role edge function. We only call it when actually needed.
    // ------------------------------------------------------------------
    const needsAuthUpdate = u.email !== undefined || !!u.password;
    if (needsAuthUpdate) {
      const payload: any = { action: 'update', id };
      if (u.email !== undefined) payload.email = u.email;
      if (u.password) payload.password = u.password;

      const headers = await getAuthHeaders();
      const { data, error } = await supabase.functions.invoke('manage-users', {
        headers,
        body: payload,
      });

      const apiError = (data as any)?.error as string | undefined;
      if (error || apiError) {
        const msg = apiError || error?.message || 'Failed to update user.';
        console.error('updateUser auth patch failed:', msg);
        return { ok: false, error: msg };
      }
    }

    await refreshUsers();
    if (user?.id === id) {
      setUser(prev => (prev ? { ...prev, ...u, password: undefined } : prev));
    }
    return { ok: true };
  };


  const deleteUser = async (id: string): Promise<{ ok: boolean; error?: string }> => {
    const target = users.find(x => x.id === id);
    const headers = await getAuthHeaders();
    const { data, error } = await supabase.functions.invoke('manage-users', {
      headers,
      body: { action: 'delete', id },
    });

    const apiError = (data as any)?.error as string | undefined;
    if (error || apiError) {
      const msg = apiError || error?.message || 'Failed to delete user.';
      console.error('deleteUser:', msg);
      return { ok: false, error: msg };
    }

    await refreshUsers();
    logActivity({
      action: 'user.deleted',
      targetType: 'user',
      targetId: id,
      targetName: target?.name,
      metadata: { email: target?.email, role: target?.role },
    });
    return { ok: true };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        users,
        addUser,
        updateUser,
        deleteUser,
        refreshUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
