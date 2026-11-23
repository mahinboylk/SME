import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { insforge, type Session, type User } from '@/lib/insforge';
import type { User as DBUser } from '@/types';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: DBUser | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<DBUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await insforge.database
        .from('users')
        .select('*')
        .eq('id', userId);

      if (error) {
        console.error('Error fetching user profile:', error);
      } else if (data && data.length > 0) {
        setProfile(data[0] as DBUser);
      }
    } catch (err) {
      console.error('Unexpected error fetching profile:', err);
    }
  }, []);

  const getInitialUser = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user: initialUser }, error } = await insforge.auth.getCurrentUser();

      if (error || !initialUser) {
        setSession(null);
        setUser(null);
        setProfile(null);
        return;
      }

      setUser(initialUser);
      setSession({ user: initialUser } as Session);
      await fetchProfile(initialUser.id);
    } catch {
      setSession(null);
      setUser(null);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, [fetchProfile]);

  useEffect(() => {
    // Restore the session on a full page reload. The SDK stores the refresh
    // token in a persisted httpOnly cookie (sent via credentials: "include"),
    // so getCurrentUser() transparently refreshes the session even though the
    // in-memory token is gone after a reload. On failure it returns a null
    // user (no throw), so this is safe to call unconditionally.
    getInitialUser();

    // Subscribe to auth changes
    const unsubscribe = insforge.auth.onAuthStateChange((event) => {
      if (event === 'signedIn' || event === 'tokenRefreshed') {
        getInitialUser();
      } else if (event === 'signedOut') {
        setSession(null);
        setUser(null);
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [getInitialUser]);

  const refreshProfile = useCallback(async () => {
    const userId = user?.id;
    if (userId) {
      await fetchProfile(userId);
      return;
    }
    // Fall back to the currently authenticated user if we don't have one yet
    const { data: { user: current } } = await insforge.auth.getCurrentUser();
    if (current) await fetchProfile(current.id);
  }, [user, fetchProfile]);

  const signOut = async () => {
    setIsLoading(true);
    await insforge.auth.signOut();
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, isLoading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
