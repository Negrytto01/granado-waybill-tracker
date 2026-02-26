import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getStatusClass, calcDuration } from "@/lib/helpers";
import { useRealtime } from "@/hooks/useRealtime";
import { Package, Trash2 } from "lucide-react";

const getAgingColor = (dataCriacao: string): { color: string; label: string; days: number } => {
  const days = Math.floor((Date.now() - new Date(dataCriacao).getTime()) / 86400000);
  if (days <= 5) return { color: "border-l-4 border-l-emerald-500", label: "Recente", days };
  if (days <= 10) return { color: "border-l-4 border-l-yellow-500", label: "Atenção", days };
  return { color: "border-l-4 border-l-red-500", label: "Crítico", days };
};

const ArmazenagemPage = () => {
  const { profile } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const isAdmin = profile?.cargo === "Administrador";

  const fetchData = useCallback(async () => {
    const { data } = await supabase.from("armazenagem").select("*, recebimentos(numero_nf, fornecedor, hora_fim_descarga)")
      .in("status", ["AGUARDANDO ARMAZENAGEM", "EM ARMAZENAGEM"])
      .order("data_criacao", { ascending: true });
    setItems(data || []);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useRealtime("armazenagem", fetchData);

  const iniciarArmazenagem = async (id: string) => {
    const { error } = await supabase.from("armazenagem").update({
      status: "EM ARMAZENAGEM" as any,
      hora_inicio: new Date().toISOString(),
      usuario_responsavel: profile?.nome,
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Armazenagem iniciada!");
  };

  const finalizarArmazenagem = async (item: any) => {
    const { error: errArm } = await supabase.from("armazenagem").update({
      status: "FINALIZADO" as any,
      hora_fim: new Date().toISOString(),
    }).eq("id", item.id);
    if (errArm) { toast.error(errArm.message); return; }

    await supabase.from("recebimentos").update({
      status: "FINALIZADO" as any,
    }).eq("id", item.recebimento_id);

    toast.success("Armazenagem finalizada!");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza?")) return;
    const { error } = await supabase.from("armazenagem").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Removido!");
  };

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl neon-text">Fila de Armazenagem</h1>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500" /> Até 5 dias</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-500" /> 5-10 dias</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500" /> +10 dias</span>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="mx-auto h-12 w-12 mb-3 opacity-30" />
          <p>Nenhum item para armazenar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const rec = item.recebimentos;
            const aging = getAgingColor(item.data_criacao);
            return (
              <div key={item.id} className={`p-4 rounded-lg border border-border bg-card/60 backdrop-blur-sm space-y-3 ${aging.color}`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading text-lg text-foreground">NF {rec?.numero_nf}</span>
                      <span className={`status-badge ${getStatusClass(item.status)}`}>{item.status}</span>
                      <span className="text-xs text-muted-foreground">{aging.days} dias — {aging.label}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{rec?.fornecedor}</p>
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Itens:</span> <span className="text-foreground">{item.quantidade_itens}</span></div>
                  <div><span className="text-muted-foreground">Volumes:</span> <span className="text-foreground">{item.quantidade_volumes}</span></div>
                  <div><span className="text-muted-foreground">Resp:</span> <span className="text-foreground">{item.usuario_responsavel || "-"}</span></div>
                </div>
                <div className="flex gap-2">
                  {item.status === "AGUARDANDO ARMAZENAGEM" && (
                    <Button size="sm" onClick={() => iniciarArmazenagem(item.id)} className="bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30">
                      Iniciar Armazenagem
                    </Button>
                  )}
                  {item.status === "EM ARMAZENAGEM" && (
                    <Button size="sm" onClick={() => finalizarArmazenagem(item)} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30">
                      Finalizar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ArmazenagemPage;
