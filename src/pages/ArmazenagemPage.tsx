import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getStatusClass } from "@/lib/helpers";
import { Package } from "lucide-react";

const ArmazenagemPage = () => {
  const { profile } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  const fetchData = async () => {
    const { data } = await supabase.from("armazenagem").select("*, recebimentos(numero_nf, fornecedor)")
      .in("status", ["AGUARDANDO ARMAZENAGEM", "EM ARMAZENAGEM"])
      .order("data_criacao", { ascending: true });
    setItems(data || []);
  };

  useEffect(() => { fetchData(); }, []);

  const iniciarArmazenagem = async (id: string) => {
    await supabase.from("armazenagem").update({
      status: "EM ARMAZENAGEM" as any,
      hora_inicio: new Date().toISOString(),
      usuario_responsavel: profile?.nome,
    }).eq("id", id);
    toast.success("Armazenagem iniciada!");
    fetchData();
  };

  const finalizarArmazenagem = async (item: any) => {
    await supabase.from("armazenagem").update({
      status: "FINALIZADO" as any,
      hora_fim: new Date().toISOString(),
    }).eq("id", item.id);

    await supabase.from("recebimentos").update({
      status: "FINALIZADO" as any,
    }).eq("id", item.recebimento_id);

    toast.success("Armazenagem finalizada!");
    fetchData();
  };

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl neon-text">Fila de Armazenagem</h1>

      {items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="mx-auto h-12 w-12 mb-3 opacity-30" />
          <p>Nenhum item para armazenar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const rec = item.recebimentos;
            return (
              <div key={item.id} className="p-4 rounded-lg border border-border bg-card/60 backdrop-blur-sm space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading text-lg text-foreground">NF {rec?.numero_nf}</span>
                      <span className={`status-badge ${getStatusClass(item.status)}`}>{item.status}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{rec?.fornecedor}</p>
                  </div>
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
