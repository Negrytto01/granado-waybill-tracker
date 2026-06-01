import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserPlus, Users, KeyRound, Trash2 } from "lucide-react";
import { formatDateTime } from "@/lib/helpers";
import { useRealtime } from "@/hooks/useRealtime";

const cargos = ["Master", "Agendamento/Conferente", "Estoque", "Faturamento", "Compra", "Financeiro", "Fiscal", "Portaria"];

const UsuariosPage = () => {
  const { user, profile, signUp } = useAuth();
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [openNew, setOpenNew] = useState(false);
  const [resetModal, setResetModal] = useState<any>(null);
  const [deleteModal, setDeleteModal] = useState<any>(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState("");
  const [form, setForm] = useState({ nome: "", senha: "", confirmarSenha: "", cargo: "Agendamento/Conferente" });
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
      setForm({ nome: "", senha: "", confirmarSenha: "", cargo: "Agendamento/Conferente" });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar usuário");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetModal) return;
    if (!novaSenha || novaSenha.length < 6) { toast.error("Senha deve ter pelo menos 6 caracteres"); return; }
    if (novaSenha !== confirmarNovaSenha) { toast.error("Senhas não conferem"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("reset-password", {
        body: { user_id: resetModal.user_id, nova_senha: novaSenha },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success(`Senha de ${resetModal.nome} redefinida com sucesso!`);
      setResetModal(null);
      setNovaSenha("");
      setConfirmarNovaSenha("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao redefinir senha");
    } finally {
      setLoading(false);
    }
  };

  const toggleAtivo = async (u: any) => {
    const newStatus = !(u.ativo ?? true);
    const { error } = await supabase.from("usuarios").update({ ativo: newStatus }).eq("id", u.id);
    if (error) { toast.error(error.message); return; }
    toast.success(newStatus ? "Usuário ativado!" : "Usuário desativado!");
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: deleteModal.user_id },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success(`Usuário ${deleteModal.nome} excluído!`);
      setDeleteModal(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir usuário");
    } finally {
      setLoading(false);
    }
  };

  if (profile?.cargo !== "Master") {
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
          <div key={u.id} className={`p-4 rounded-lg border border-border bg-card/60 flex items-center justify-between ${!(u.ativo ?? true) ? "opacity-50" : ""}`}>
            <div>
              <p className="font-heading text-foreground">{u.nome}</p>
              <p className="text-xs text-muted-foreground">{u.cargo} · {formatDateTime(u.data_criacao)}</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => { setResetModal(u); setNovaSenha(""); setConfirmarNovaSenha(""); }} title="Redefinir senha" className="text-muted-foreground hover:text-foreground">
                <KeyRound className="h-4 w-4" />
              </Button>
              {u.user_id !== user?.id && (
                <Button variant="ghost" size="icon" onClick={() => setDeleteModal(u)} title="Excluir usuário" className="text-muted-foreground hover:text-red-400">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <span className="text-xs text-muted-foreground">{(u.ativo ?? true) ? "Ativo" : "Inativo"}</span>
              <Switch checked={u.ativo ?? true} onCheckedChange={() => toggleAtivo(u)} />
            </div>
          </div>
        ))}
        {usuarios.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Nenhum usuário cadastrado</p>
        )}
      </div>

      {/* Reset password modal */}
      <Dialog open={!!resetModal} onOpenChange={(open) => { if (!open) setResetModal(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="font-heading neon-text">Redefinir Senha</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Usuário: <strong className="text-foreground">{resetModal?.nome}</strong></p>
            <Input type="password" placeholder="Nova senha *" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} className="bg-secondary" />
            <Input type="password" placeholder="Confirmar nova senha *" value={confirmarNovaSenha} onChange={e => setConfirmarNovaSenha(e.target.value)} className="bg-secondary" />
            <Button onClick={handleResetPassword} disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/80">
              {loading ? "Redefinindo..." : "Redefinir Senha"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation modal */}
      <Dialog open={!!deleteModal} onOpenChange={(open) => { if (!open) setDeleteModal(null); }}>
        <DialogContent className="bg-card border-red-500/30">
          <DialogHeader><DialogTitle className="font-heading text-red-400">Excluir Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja excluir <strong className="text-foreground">{deleteModal?.nome}</strong>? Esta ação é permanente.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDeleteModal(null)} className="flex-1">Cancelar</Button>
              <Button onClick={handleDelete} disabled={loading} className="flex-1 bg-red-600 text-white hover:bg-red-700">
                {loading ? "Excluindo..." : "Excluir"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsuariosPage;
