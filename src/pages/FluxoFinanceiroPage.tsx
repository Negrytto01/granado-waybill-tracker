import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { DollarSign, Plus, TrendingUp, TrendingDown, Trash2 } from "lucide-react";
import { formatDateTime } from "@/lib/helpers";

const FluxoFinanceiroPage = () => {
  const { profile } = useAuth();
  const [fluxos, setFluxos] = useState<any[]>([]);
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({ descricao: "", valor: "" });
  const [mesRef, setMesRef] = useState(new Date().toISOString().slice(0, 7));
  const isAdmin = profile?.cargo === "Administrador";

  const fetchData = useCallback(async () => {
    const startDate = `${mesRef}-01`;
    const endDate = new Date(Number(mesRef.split("-")[0]), Number(mesRef.split("-")[1]), 0).toISOString().split("T")[0];
    
    const { data } = await supabase.from("fluxo_financeiro").select("*")
      .gte("mes_referencia", startDate)
      .lte("mes_referencia", endDate)
      .order("data_criacao", { ascending: false });
    setFluxos(data || []);
  }, [mesRef]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel("realtime-fluxo_financeiro")
      .on("postgres_changes", { event: "*", schema: "public", table: "fluxo_financeiro" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const handleAddSaida = async () => {
    if (!form.descricao || !form.valor) { toast.error("Preencha todos os campos"); return; }
    const { error } = await supabase.from("fluxo_financeiro").insert([{
      tipo: "SAIDA",
      descricao: form.descricao,
      valor: parseFloat(form.valor),
      mes_referencia: `${mesRef}-01`,
      criado_por: profile?.nome,
    }]);
    if (error) { toast.error(error.message); return; }
    toast.success("Saída registrada!");
    setOpenNew(false);
    setForm({ descricao: "", valor: "" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover?")) return;
    const { error } = await supabase.from("fluxo_financeiro").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Removido!");
    fetchData();
  };

  const totalEntradas = fluxos.filter(f => f.tipo === "ENTRADA").reduce((a, f) => a + Number(f.valor), 0);
  const totalSaidas = fluxos.filter(f => f.tipo === "SAIDA").reduce((a, f) => a + Number(f.valor), 0);
  const saldo = totalEntradas - totalSaidas;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-heading text-3xl neon-text">Fluxo Financeiro</h1>
        <div className="flex gap-2 items-center">
          <Input type="month" value={mesRef} onChange={e => setMesRef(e.target.value)} className="bg-secondary w-44" />
          {isAdmin && (
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild>
                <Button className="bg-destructive text-destructive-foreground hover:bg-destructive/80">
                  <Plus className="mr-2 h-4 w-4" /> Nova Saída
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader><DialogTitle className="font-heading neon-text">Registrar Saída</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Input placeholder="Descrição *" value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} className="bg-secondary" />
                  <Input type="number" step="0.01" placeholder="Valor (R$) *" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} className="bg-secondary" />
                  <Button onClick={handleAddSaida} className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/80">Salvar Saída</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <span className="text-xs text-muted-foreground uppercase">Entradas</span>
          </div>
          <p className="font-heading text-2xl text-emerald-400">R$ {totalEntradas.toFixed(2)}</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="h-4 w-4 text-red-400" />
            <span className="text-xs text-muted-foreground uppercase">Saídas</span>
          </div>
          <p className="font-heading text-2xl text-red-400">R$ {totalSaidas.toFixed(2)}</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground uppercase">Saldo</span>
          </div>
          <p className={`font-heading text-2xl ${saldo >= 0 ? "text-emerald-400" : "text-red-400"}`}>R$ {saldo.toFixed(2)}</p>
        </div>
      </div>

      <div className="space-y-2">
        {fluxos.map(f => (
          <div key={f.id} className="p-3 rounded-lg border border-border bg-card/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {f.tipo === "ENTRADA" ? <TrendingUp className="h-4 w-4 text-emerald-400" /> : <TrendingDown className="h-4 w-4 text-red-400" />}
              <div>
                <p className="text-foreground">{f.descricao}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(f.data_criacao)} · {f.criado_por}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`font-heading text-lg ${f.tipo === "ENTRADA" ? "text-emerald-400" : "text-red-400"}`}>
                {f.tipo === "ENTRADA" ? "+" : "-"} R$ {Number(f.valor).toFixed(2)}
              </span>
              {isAdmin && (
                <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
        {fluxos.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Nenhum registro neste mês</p>
        )}
      </div>
    </div>
  );
};

export default FluxoFinanceiroPage;
