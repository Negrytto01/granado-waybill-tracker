import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getStatusClass, formatTime, calcDuration } from "@/lib/helpers";
import { Play, Square, Truck } from "lucide-react";

const DescargaPage = () => {
  const { profile } = useAuth();
  const [recebimentos, setRecebimentos] = useState<any[]>([]);

  const fetchData = async () => {
    const { data } = await supabase.from("recebimentos").select("*")
      .in("status", ["CHEGOU", "EM DESCARGA"])
      .order("hora_chegada", { ascending: true });
    setRecebimentos(data || []);
  };

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 30000); return () => clearInterval(i); }, []);

  const iniciarDescarga = async (id: string) => {
    await supabase.from("recebimentos").update({
      status: "EM DESCARGA" as any,
      hora_inicio_descarga: new Date().toISOString(),
      usuario_responsavel: profile?.nome,
    }).eq("id", id);
    toast.success("Descarga iniciada!");
    fetchData();
  };

  const finalizarDescarga = async (r: any) => {
    const now = new Date().toISOString();
    await supabase.from("recebimentos").update({
      status: "AGUARDANDO ARMAZENAGEM" as any,
      hora_fim_descarga: now,
    }).eq("id", r.id);

    await supabase.from("armazenagem").insert([{
      recebimento_id: r.id,
      quantidade_itens: r.quantidade_itens || 0,
      quantidade_volumes: r.quantidade_volumes || 0,
      status: "AGUARDANDO ARMAZENAGEM" as any,
      usuario_responsavel: profile?.nome,
    }]);

    toast.success("Descarga finalizada! Enviado para armazenagem.");
    fetchData();
  };

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl neon-text">Controle de Descarga</h1>

      {recebimentos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Truck className="mx-auto h-12 w-12 mb-3 opacity-30" />
          <p>Nenhum caminhão para descarga</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recebimentos.map(r => (
            <div key={r.id} className="p-4 rounded-lg border border-border bg-card/60 backdrop-blur-sm space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-lg text-foreground">NF {r.numero_nf}</span>
                    <span className={`status-badge ${getStatusClass(r.status)}`}>{r.status}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{r.fornecedor}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <div><span className="text-muted-foreground">Chegada:</span> <span className="text-foreground">{formatTime(r.hora_chegada)}</span></div>
                {r.hora_inicio_descarga && <div><span className="text-muted-foreground">Início:</span> <span className="text-foreground">{formatTime(r.hora_inicio_descarga)}</span></div>}
                {r.status === "EM DESCARGA" && <div><span className="text-muted-foreground">Tempo:</span> <span className="text-primary animate-pulse-neon">{calcDuration(r.hora_inicio_descarga, null)}</span></div>}
                <div><span className="text-muted-foreground">Resp:</span> <span className="text-foreground">{r.usuario_responsavel}</span></div>
              </div>
              <div className="flex gap-2">
                {r.status === "CHEGOU" && (
                  <Button size="sm" onClick={() => iniciarDescarga(r.id)} className="bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30">
                    <Play className="mr-2 h-4 w-4" /> Iniciar Descarga
                  </Button>
                )}
                {r.status === "EM DESCARGA" && (
                  <Button size="sm" onClick={() => finalizarDescarga(r)} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30">
                    <Square className="mr-2 h-4 w-4" /> Finalizar Descarga
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DescargaPage;
