import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { formatDateTime } from "@/lib/helpers";

const FornecedoresUrgenciaPage = () => {
  const { profile } = useAuth();
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({ nome_fornecedor: "", observacoes: "" });
  const isAdmin = profile?.cargo === "Administrador";

  // Check if we're in the 3rd week of the month (days 15-21)
  const today = new Date();
  const dayOfMonth = today.getDate();
  const isAlertPeriod = dayOfMonth >= 15;

  const fetchData = useCallback(async () => {
    const { data } = await supabase.from("fornecedores_urgencia").select("*")
      .order("contagem_urgencias", { ascending: false });
    setFornecedores(data || []);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel("realtime-fornecedores_urgencia")
      .on("postgres_changes", { event: "*", schema: "public", table: "fornecedores_urgencia" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const handleAdd = async () => {
    if (!form.nome_fornecedor) { toast.error("Nome do fornecedor obrigatório"); return; }
    
    // Check if already exists
    const existing = fornecedores.find(f => 
      f.nome_fornecedor.toLowerCase() === form.nome_fornecedor.toLowerCase()
    );
    
    if (existing) {
      await supabase.from("fornecedores_urgencia").update({
        contagem_urgencias: existing.contagem_urgencias + 1,
        ultima_urgencia: new Date().toISOString(),
        observacoes: form.observacoes || existing.observacoes,
      }).eq("id", existing.id);
    } else {
      await supabase.from("fornecedores_urgencia").insert([{
        nome_fornecedor: form.nome_fornecedor,
        observacoes: form.observacoes || null,
      }]);
    }
    toast.success("Fornecedor registrado!");
    setOpenNew(false);
    setForm({ nome_fornecedor: "", observacoes: "" });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("fornecedores_urgencia").delete().eq("id", id);
    toast.success("Removido!");
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-heading text-3xl neon-text">Fornecedores — Urgência</h1>
        {isAdmin && (
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/80">
                <Plus className="mr-2 h-4 w-4" /> Registrar Urgência
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle className="font-heading neon-text">Registrar Fornecedor Urgente</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Nome do Fornecedor *" value={form.nome_fornecedor} onChange={e => setForm({...form, nome_fornecedor: e.target.value})} className="bg-secondary" />
                <Input placeholder="Observações" value={form.observacoes} onChange={e => setForm({...form, observacoes: e.target.value})} className="bg-secondary" />
                <Button onClick={handleAdd} className="w-full bg-primary text-primary-foreground hover:bg-primary/80">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isAlertPeriod && fornecedores.length > 0 && (
        <div className="p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-heading text-yellow-400">Atenção! Período de alerta (a partir da 3ª semana)</p>
            <p className="text-sm text-muted-foreground">Os seguintes fornecedores costumam solicitar encaixes de urgência. Fique atento aos agendamentos!</p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {fornecedores.map(f => (
          <div key={f.id} className="p-4 rounded-lg border border-border bg-card/60 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading text-foreground">{f.nome_fornecedor}</span>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
                  {f.contagem_urgencias}x urgências
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Última: {formatDateTime(f.ultima_urgencia)}
                {f.observacoes && ` · ${f.observacoes}`}
              </p>
            </div>
            {isAdmin && (
              <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
        {fornecedores.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <AlertTriangle className="mx-auto h-12 w-12 mb-3 opacity-30" />
            <p>Nenhum fornecedor de urgência registrado</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FornecedoresUrgenciaPage;
