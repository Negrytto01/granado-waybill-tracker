import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface UsuarioProfile {
  id: string;
  user_id: string;
  nome: string;
  cargo: string;
  data_criacao: string;
}

interface AuthContextType {
  user: User | null;
  profile: UsuarioProfile | null;
  loading: boolean;
  signIn: (nome: string, senha: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (nome: string, senha: string, cargo: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UsuarioProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("usuarios")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      setProfile(data as UsuarioProfile | null);
    } catch (e) {
      console.error("Error fetching profile:", e);
      setProfile(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    let loaded = false;

    // Safety timeout - never stay loading forever
    const timeout = setTimeout(() => {
      if (mounted && !loaded) {
        console.warn("Auth loading timeout - forcing load complete");
        setLoading(false);
      }
    }, 5000);

    // Initialize session first
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      loaded = true;
      setLoading(false);
    }).catch((err) => {
      console.error("getSession error:", err);
      if (mounted) { loaded = true; setLoading(false); }
    });

    // Then listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        setUser(session?.user ?? null);
        if (session?.user) {
          // Use setTimeout to avoid Supabase lock contention
          setTimeout(() => {
            if (mounted) fetchProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
        }
        loaded = true;
        setLoading(false);
      }
    );

    // Handle screen lock/unlock
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!mounted) return;
          setUser(session?.user ?? null);
          if (session?.user) {
            fetchProfile(session.user.id);
          } else {
            setProfile(null);
          }
        } catch (err) {
          console.error("Visibility change session error:", err);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const signIn = async (nome: string, senha: string) => {
    const email = `${nome.toLowerCase().replace(/\s+/g, '.')}@granado.local`;
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });
    if (error) throw new Error("Usuário ou senha inválidos");
    
    // Check if user is active
    const { data: userProfile } = await supabase
      .from("usuarios")
      .select("ativo")
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id || "")
      .maybeSingle();
    
    if (userProfile && userProfile.ativo === false) {
      await supabase.auth.signOut();
      throw new Error("Usuário desativado. Contate o administrador.");
    }
  };

  const signUp = async (nome: string, senha: string, cargo: string) => {
    const { data, error } = await supabase.functions.invoke("create-user", {
      body: { nome, senha, cargo },
    });
    if (error) throw new Error(error.message || "Erro ao criar usuário");
    if (data?.error) throw new Error(data.error);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut, signUp }}>
      {children}
    </AuthContext.Provider>
  );
};
