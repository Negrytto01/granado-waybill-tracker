import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserPlus, Users, Trash2 } from "lucide-react";
import { formatDateTime } from "@/lib/helpers";
import { useRealtime } from "@/hooks/useRealtime";

const cargos = ["Administrador", "Recebimento", "Conferente", "Estoque", "Fiscal", "Compras", "Financeiro", "Faturamento"];

const UsuariosPage = () => {
  const { profile, signUp } = useAuth();
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({ nome: "", senha: "", confirmarSenha: "", cargo: "Recebimento" });
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    const { data } = await supabase.from("usuarios").select("*").order("data_criacao", { ascending: false });
    setUsuarios(data || []);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useRealtime("usuarios", fetchData);

  const handleCreate = async () => {
    if (!form.nome || !form.senha) { toast.error("Preencha todos os campos"); return; }
    if (form.senha !== form.confirmarSenha) { toast.error("Senhas não conferem"); return; }
    if (form.senha.length < 6) { toast.error("Senha deve ter pelo menos 6 caracteres"); return; }
    setLoading(true);
    try {
      await signUp(form.nome, form.senha, form.cargo);
      toast.success("Usuário cadastrado!");
      setOpenNew(false);
      setForm({ nome: "", senha: "", confirmarSenha: "", cargo: "Recebimento" });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar usuário");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (u: any) => {
    if (!confirm(`Remover o usuário ${u.nome}?`)) return;
    const { error } = await supabase.from("usuarios").delete().eq("id", u.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Usuário removido!");
    fetchData();
  };

  if (profile?.cargo !== "Administrador") {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Users className="mx-auto h-12 w-12 mb-3 opacity-30" />
        <p>Acesso restrito a administradores</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-heading text-3xl neon-text">Usuários</h1>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/80">
              <UserPlus className="mr-2 h-4 w-4" /> Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle className="font-heading neon-text">Cadastrar Usuário</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Nome *" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="bg-secondary" />
              <Input type="password" placeholder="Senha *" value={form.senha} onChange={e => setForm({...form, senha: e.target.value})} className="bg-secondary" />
              <Input type="password" placeholder="Confirmar Senha *" value={form.confirmarSenha} onChange={e => setForm({...form, confirmarSenha: e.target.value})} className="bg-secondary" />
              <Select value={form.cargo} onValueChange={v => setForm({...form, cargo: v})}>
                <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {cargos.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={handleCreate} disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/80">
                {loading ? "Cadastrando..." : "Cadastrar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {usuarios.map(u => (
          <div key={u.id} className="p-4 rounded-lg border border-border bg-card/60 flex items-center justify-between">
            <div>
              <p className="font-heading text-foreground">{u.nome}</p>
              <p className="text-xs text-muted-foreground">{u.cargo} · {formatDateTime(u.data_criacao)}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => handleDelete(u)} className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {usuarios.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Nenhum usuário cadastrado</p>
        )}
      </div>
    </div>
  );
};

export default UsuariosPage;
