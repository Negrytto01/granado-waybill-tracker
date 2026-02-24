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
    const { data } = await supabase
      .from("usuarios")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    setProfile(data as UsuarioProfile | null);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (nome: string, senha: string) => {
    const email = `${nome.toLowerCase().replace(/\s+/g, '.')}@granado.local`;
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });
    if (error) throw new Error("Usuário ou senha inválidos");
  };

  const signUp = async (nome: string, senha: string, cargo: string) => {
    const { data, error } = await supabase.functions.invoke("create-user", {
      body: { nome, senha, cargo },
    });
    if (error) throw new Error(error.message);
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
