import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import ParticlesBackground from "@/components/ParticlesBackground";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";

const LoginPage = () => {
  const { signIn, signUp } = useAuth();
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [isFirstUser, setIsFirstUser] = useState(false);
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [checkingFirst, setCheckingFirst] = useState(true);

  useEffect(() => {
    supabase.functions.invoke("check-setup").then(({ data, error }) => {
      if (error) {
        console.error("Check setup error:", error);
        setIsFirstUser(false);
      } else {
        setIsFirstUser(data?.needsSetup === true);
      }
      setCheckingFirst(false);
    });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !senha) { toast.error("Preencha todos os campos"); return; }
    setLoading(true);
    try {
      await signIn(nome, senha);
      toast.success("Login realizado!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFirstUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !senha || !confirmarSenha) { toast.error("Preencha todos os campos"); return; }
    if (senha !== confirmarSenha) { toast.error("Senhas não conferem"); return; }
    if (senha.length < 6) { toast.error("Senha mínima: 6 caracteres"); return; }
    setLoading(true);
    try {
      await signUp(nome, senha, "Master");
      toast.success("Administrador criado! Faça login.");
      setIsFirstUser(false);
      setSenha("");
      setConfirmarSenha("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (checkingFirst) return null;

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background">
      <ParticlesBackground />
      <div className="watermark" aria-hidden="true">GRANADO</div>

      {isFirstUser ? (
        <form onSubmit={handleFirstUser} className="relative z-10 w-full max-w-sm mx-4 p-8 rounded-xl border border-border bg-card/80 backdrop-blur-md space-y-6">
          <div className="flex flex-col items-center gap-3">
            <img src="/logo-granado-icon.png" alt="Granado Distribuidora" className="w-24 h-24 rounded-lg" />
            <h1 className="font-heading text-2xl neon-text tracking-wider">Granado Distribuidora</h1>
            <p className="text-muted-foreground text-sm text-center">Crie o primeiro usuário administrador</p>
          </div>
          <div className="space-y-4">
            <Input placeholder="Nome do Administrador" value={nome} onChange={e => setNome(e.target.value)} className="bg-secondary border-border" />
            <Input type="password" placeholder="Senha" value={senha} onChange={e => setSenha(e.target.value)} className="bg-secondary border-border" />
            <Input type="password" placeholder="Confirmar Senha" value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)} className="bg-secondary border-border" />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/80 font-heading text-lg">
            <UserPlus className="mr-2 h-5 w-5" /> {loading ? "Criando..." : "Criar Administrador"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleLogin} className="relative z-10 w-full max-w-sm mx-4 p-8 rounded-xl border border-border bg-card/80 backdrop-blur-md space-y-6">
          <div className="flex flex-col items-center gap-3">
            <img src="/logo-granado-icon.png" alt="Granado Distribuidora" className="w-24 h-24 rounded-lg" />
            <h1 className="font-heading text-2xl neon-text tracking-wider">Granado Distribuidora</h1>
            <p className="text-muted-foreground text-sm">Sistema de Agendamento e Recebimento</p>
          </div>
          <div className="space-y-4">
            <Input placeholder="Nome do Usuário" value={nome} onChange={e => setNome(e.target.value)} className="bg-secondary border-border" />
            <Input type="password" placeholder="Senha" value={senha} onChange={e => setSenha(e.target.value)} className="bg-secondary border-border" />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/80 font-heading text-lg tracking-wider">
            <LogIn className="mr-2 h-5 w-5" /> {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      )}
    </div>
  );
};

export default LoginPage;
