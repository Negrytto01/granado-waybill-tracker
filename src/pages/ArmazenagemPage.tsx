import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getStatusClass, formatNF, calcEffectiveArmazenagemTime } from "@/lib/helpers";
import { useRealtime } from "@/hooks/useRealtime";
import { Package, Trash2, Pause, Play, CheckCircle } from "lucide-react";

const getAgingColor = (dataCriacao: string): { color: string; label: string; days: number } => {
  const days = Math.floor((Date.now() - new Date(dataCriacao).getTime()) / 86400000);
  if (days <= 5) return { color: "border-l-4 border-l-emerald-500", label: "Recente", days };
  if (days <= 10) return { color: "border-l-4 border-l-yellow-500", label: "Atenção", days };
  return { color: "border-l-4 border-l-red-500", label: "Crítico", days };
};

const isPaused = (item: any): boolean => {
  const pausas = item.pausas || [];
  return pausas.length > 0 && !pausas[pausas.length - 1].resume_at;
};

const ArmazenagemPage = () => {
  const { profile } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [, setTick] = useState(0);
  const isAdmin = profile?.cargo === "Master";

  const fetchData = useCallback(async () => {
    const { data } = await supabase.from("armazenagem").select("*, recebimentos(numero_nf, fornecedor, hora_fim_descarga, is_pallet, quantidade_volumes)")
      .in("status", ["AGUARDANDO ARMAZENAGEM", "EM ARMAZENAGEM", "PAUSADO"])
      .order("data_criacao", { ascending: true });
    setItems((data || []).filter(item => !item.recebimentos?.is_pallet));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useRealtime("armazenagem", fetchData);

  useEffect(() => {
    const hasActive = items.some(i => i.status === "EM ARMAZENAGEM");
    if (!hasActive) return;
    const interval = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(interval);
  }, [items]);

  const iniciarArmazenagem = async (id: string) => {
    const { error } = await supabase.from("armazenagem").update({
      status: "EM ARMAZENAGEM" as any,
      hora_inicio: new Date().toISOString(),
      usuario_responsavel: profile?.nome,
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Armazenagem iniciada!");
  };

  const pausarArmazenagem = async (item: any) => {
    const pausas = [...(item.pausas || [])];
    pausas.push({ pause_at: new Date().toISOString(), resume_at: null });
    const { error } = await supabase.from("armazenagem").update({
      status: "PAUSADO" as any,
      pausas,
    } as any).eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    toast.info("Armazenagem pausada!");
  };

  const retomarArmazenagem = async (item: any) => {
    const pausas = [...(item.pausas || [])];
    if (pausas.length > 0 && !pausas[pausas.length - 1].resume_at) {
      pausas[pausas.length - 1].resume_at = new Date().toISOString();
    }
    const { error } = await supabase.from("armazenagem").update({
      status: "EM ARMAZENAGEM" as any,
      pausas,
    } as any).eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Armazenagem retomada!");
  };

  const finalizarArmazenagem = async (item: any) => {
    const now = new Date().toISOString();
    const pausas = [...(item.pausas || [])];
    if (pausas.length > 0 && !pausas[pausas.length - 1].resume_at) {
      pausas[pausas.length - 1].resume_at = now;
    }
    let obsArm = "";
    if (pausas.length > 0) {
      const pauseNotes = pausas.map((p: any) => {
        const pAt = new Date(p.pause_at);
        const rAt = p.resume_at ? new Date(p.resume_at) : new Date();
        return `Houve pausa no dia ${pAt.toLocaleDateString("pt-BR")} às ${pAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} e retornou dia ${rAt.toLocaleDateString("pt-BR")} às ${rAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
      });
      obsArm = pauseNotes.join(" | ");
    }

    const { error: errArm } = await supabase.from("armazenagem").update({
      status: "FINALIZADO" as any,
      hora_fim: now,
      pausas,
      observacoes_armazenagem: obsArm || null,
    } as any).eq("id", item.id);
    if (errArm) { toast.error(errArm.message); return; }

    await supabase.from("recebimentos").update({
      status: "FINALIZADO" as any,
    }).eq("id", item.recebimento_id);

    const rec = item.recebimentos;
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (userId) {
      await supabase.from("mensagens_globais").insert([{
        mensagem: `Usuário ${profile?.nome}, finalizou o armazenamento da indústria ${rec?.fornecedor}`,
        enviado_por: "Sistema",
        enviado_por_user_id: userId,
        destinatarios: ["todos"],
      }] as any);
    }

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
            const paused = isPaused(item);
            return (
              <div key={item.id} className={`p-4 rounded-lg border border-border bg-card/60 backdrop-blur-sm space-y-3 ${aging.color}`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-heading text-lg text-foreground">
                        {rec?.numero_nf?.includes("/") ? (
                          <span className="flex flex-wrap gap-1.5 items-center">
                            {rec.numero_nf.split(/\s*\/\s*/).map((nf: string, i: number) => (
                              <span key={i} className="inline-block px-2 py-0.5 rounded bg-secondary text-sm">
                                NF {formatNF(nf.trim())}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <>NF {rec?.numero_nf ? formatNF(rec.numero_nf) : "-"}</>
                        )}
                      </span>
                      <span className={`status-badge ${getStatusClass(paused ? "PAUSADO" : item.status)}`}>{paused ? "PAUSADO" : item.status}</span>
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
                  {(item.status === "EM ARMAZENAGEM" || paused) && (
                    <div><span className="text-muted-foreground">Tempo:</span> <span className={`text-primary ${!paused ? "animate-pulse" : ""}`}>{calcEffectiveArmazenagemTime(item)}</span></div>
                  )}
                  {(item.pausas || []).length > 0 && (
                    <div><span className="text-muted-foreground">Pausas:</span> <span className="text-foreground">{(item.pausas || []).length}x</span></div>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {item.status === "AGUARDANDO ARMAZENAGEM" && (
                    <Button size="sm" onClick={() => iniciarArmazenagem(item.id)} className="bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30">
                      <Play className="mr-2 h-4 w-4" /> Iniciar Armazenagem
                    </Button>
                  )}
                  {item.status === "EM ARMAZENAGEM" && !paused && (
                    <>
                      <Button size="sm" onClick={() => finalizarArmazenagem(item)} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30">
                        <CheckCircle className="mr-2 h-4 w-4" /> Finalizar
                      </Button>
                      <Button size="sm" onClick={() => pausarArmazenagem(item)} className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30">
                        <Pause className="mr-2 h-4 w-4" /> Pausar
                      </Button>
                    </>
                  )}
                  {paused && (
                    <>
                      <Button size="sm" onClick={() => retomarArmazenagem(item)} className="bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30">
                        <Play className="mr-2 h-4 w-4" /> Retomar
                      </Button>
                      <Button size="sm" onClick={() => finalizarArmazenagem(item)} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30">
                        <CheckCircle className="mr-2 h-4 w-4" /> Finalizar
                      </Button>
                    </>
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
