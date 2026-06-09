import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getStatusClass, formatNF, calcEffectiveArmazenagemTime } from "@/lib/helpers";
import { useRealtime } from "@/hooks/useRealtime";
import { Package, Trash2, Pause, Play, CheckCircle, Plus, Wrench } from "lucide-react";

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
  const [openOcorrencia, setOpenOcorrencia] = useState(false);
  const [openNovoTipo, setOpenNovoTipo] = useState(false);
  const [ocorrenciaForm, setOcorrenciaForm] = useState({ fornecedor: "", ocorrencia: "" });
  const [novoTipoNome, setNovoTipoNome] = useState("");
  const [tiposOcorrencia, setTiposOcorrencia] = useState<any[]>([]);
  const [ocorrencias, setOcorrencias] = useState<any[]>([]);
  const isAdmin = profile?.cargo === "Master";

  const fetchData = useCallback(async () => {
    const [armData, tiposData, ocorrData] = await Promise.all([
      supabase.from("armazenagem").select("*, recebimentos(numero_nf, fornecedor, hora_fim_descarga, is_pallet, quantidade_volumes)")
        .in("status", ["AGUARDANDO ARMAZENAGEM", "EM ARMAZENAGEM", "PAUSADO"])
        .order("data_criacao", { ascending: true }),
      supabase.from("ocorrencias_tipos").select("*").order("nome"),
      supabase.from("ocorrencias_armazenagem").select("*").order("data_criacao", { ascending: false }).limit(50),
    ]);
    setItems(((armData.data as any[]) || []).filter(item => !item.recebimentos?.is_pallet));
    setTiposOcorrencia((tiposData.data as any[]) || []);
    setOcorrencias((ocorrData.data as any[]) || []);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useRealtime("armazenagem", fetchData);

  useEffect(() => {
    const hasActive = items.some(i => i.status === "EM ARMAZENAGEM");
    if (!hasActive) return;
    const interval = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(interval);
  }, [items]);

  const logActivity = async (acao: string, detalhes?: string) => {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (userId) {
      await supabase.from("atividades_usuarios").insert([{
        user_id: userId, usuario_nome: profile?.nome || "", acao, detalhes,
      }] as any);
    }
  };

  const iniciarArmazenagem = async (id: string, item: any) => {
    await supabase.from("armazenagem").update({
      status: "EM ARMAZENAGEM" as any, hora_inicio: new Date().toISOString(), usuario_responsavel: profile?.nome,
    }).eq("id", id);
    await logActivity("Iniciou armazenagem", `${item.recebimentos?.fornecedor}`);
    toast.success("Armazenagem iniciada!");
  };

  const pausarArmazenagem = async (item: any) => {
    const pausas = [...(item.pausas || [])];
    pausas.push({ pause_at: new Date().toISOString(), resume_at: null });
    await supabase.from("armazenagem").update({ status: "PAUSADO" as any, pausas } as any).eq("id", item.id);
    await logActivity("Pausou armazenagem", `${item.recebimentos?.fornecedor}`);
    toast.info("Armazenagem pausada!");
  };

  const retomarArmazenagem = async (item: any) => {
    const pausas = [...(item.pausas || [])];
    if (pausas.length > 0 && !pausas[pausas.length - 1].resume_at) {
      pausas[pausas.length - 1].resume_at = new Date().toISOString();
    }
    await supabase.from("armazenagem").update({ status: "EM ARMAZENAGEM" as any, pausas } as any).eq("id", item.id);
    await logActivity("Retomou armazenagem", `${item.recebimentos?.fornecedor}`);
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
        return `Pausa ${pAt.toLocaleDateString("pt-BR")} ${pAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} → ${rAt.toLocaleDateString("pt-BR")} ${rAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
      });
      obsArm = pauseNotes.join(" | ");
    }

    await supabase.from("armazenagem").update({
      status: "FINALIZADO" as any, hora_fim: now, pausas, observacoes_armazenagem: obsArm || null,
    } as any).eq("id", item.id);

    await supabase.from("recebimentos").update({ status: "FINALIZADO" as any }).eq("id", item.recebimento_id);

    const rec = item.recebimentos;
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (userId) {
      await supabase.from("mensagens_globais").insert([{
        mensagem: `Usuário ${profile?.nome}, finalizou o armazenamento da indústria ${rec?.fornecedor}`,
        enviado_por: "Sistema", enviado_por_user_id: userId, destinatarios: ["todos"],
      }] as any);
    }
    await logActivity("Finalizou armazenagem", `${rec?.fornecedor}`);
    toast.success("Armazenagem finalizada!");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza?")) return;
    await supabase.from("armazenagem").delete().eq("id", id);
    toast.success("Removido!");
  };

  const handleAddOcorrencia = async () => {
    if (!ocorrenciaForm.fornecedor || !ocorrenciaForm.ocorrencia) { toast.error("Preencha todos os campos"); return; }
    await supabase.from("ocorrencias_armazenagem").insert([{
      fornecedor: ocorrenciaForm.fornecedor, ocorrencia: ocorrenciaForm.ocorrencia, registrado_por: profile?.nome,
    }] as any);
    await logActivity("Ocorrência armazenagem", `${ocorrenciaForm.fornecedor} - ${ocorrenciaForm.ocorrencia}`);
    toast.success("Ocorrência registrada!");
    setOpenOcorrencia(false);
    setOcorrenciaForm({ fornecedor: "", ocorrencia: "" });
    fetchData();
  };

  const handleAddTipo = async () => {
    if (!novoTipoNome) { toast.error("Informe o nome"); return; }
    await supabase.from("ocorrencias_tipos").insert([{ nome: novoTipoNome }] as any);
    toast.success("Tipo de ocorrência criado!");
    setOpenNovoTipo(false);
    setNovoTipoNome("");
    fetchData();
  };

  const handleDeleteOcorrencia = async (id: string) => {
    if (!confirm("Remover?")) return;
    await supabase.from("ocorrencias_armazenagem").delete().eq("id", id);
    toast.success("Removido!");
    fetchData();
  };

  const renderNFs = (nf: string) => {
    if (nf?.includes("/")) {
      return (
        <span className="flex flex-wrap gap-1 items-center">
          {nf.split(/\s*\/\s*/).map((n: string, i: number) => (
            <span key={i} className="inline-block px-1.5 py-0.5 rounded bg-secondary text-xs">NF {formatNF(n.trim())}</span>
          ))}
        </span>
      );
    }
    return <>NF {nf ? formatNF(nf) : "-"}</>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-heading text-3xl neon-text">Fila de Armazenagem</h1>
        <div className="flex gap-2">
          <Dialog open={openOcorrencia} onOpenChange={setOpenOcorrencia}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-primary/50 text-primary">
                <Wrench className="mr-2 h-4 w-4" /> Ocorrência
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle className="font-heading neon-text">Registrar Ocorrência</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Fornecedor" value={ocorrenciaForm.fornecedor} onChange={e => setOcorrenciaForm({...ocorrenciaForm, fornecedor: e.target.value})} className="bg-secondary" />
                <div>
                  <label className="text-xs text-muted-foreground">Tipo de Ocorrência</label>
                  <Select value={ocorrenciaForm.ocorrencia} onValueChange={v => setOcorrenciaForm({...ocorrenciaForm, ocorrencia: v})}>
                    <SelectTrigger className="bg-secondary mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {tiposOcorrencia.map(t => <SelectItem key={t.id} value={t.nome}>{t.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {isAdmin && (
                  <Button variant="link" size="sm" onClick={() => setOpenNovoTipo(true)} className="text-primary p-0">
                    <Plus className="h-3 w-3 mr-1" /> Criar novo tipo
                  </Button>
                )}
                <Button onClick={handleAddOcorrencia} className="w-full bg-primary text-primary-foreground hover:bg-primary/80">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={openNovoTipo} onOpenChange={setOpenNovoTipo}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="font-heading neon-text">Novo Tipo de Ocorrência</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nome (ex: Reposição, Organização)" value={novoTipoNome} onChange={e => setNovoTipoNome(e.target.value)} className="bg-secondary" />
            <Button onClick={handleAddTipo} className="w-full bg-primary text-primary-foreground hover:bg-primary/80">Criar</Button>
          </div>
        </DialogContent>
      </Dialog>

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map(item => {
            const rec = item.recebimentos;
            const aging = getAgingColor(item.data_criacao);
            const paused = isPaused(item);
            return (
              <div key={item.id} className={`p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm space-y-2 ${aging.color}`}>
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <h3 data-testid="fornecedor-nome" className="font-heading text-foreground text-base leading-tight truncate" title={rec?.fornecedor}>{rec?.fornecedor || "-"}</h3>
                    <div data-testid="nf-secundario" className="text-xs text-muted-foreground mt-0.5">{renderNFs(rec?.numero_nf)}</div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className={`status-badge ${getStatusClass(paused ? "PAUSADO" : item.status)}`}>{paused ? "PAUSADO" : item.status}</span>
                      <span className="text-xs text-muted-foreground">{aging.days}d — {aging.label}</span>
                    </div>
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="text-destructive hover:text-destructive h-7 w-7">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div><span className="text-muted-foreground">Vol:</span> <span className="text-foreground">{item.quantidade_volumes}</span></div>
                  <div><span className="text-muted-foreground">Resp:</span> <span className="text-foreground">{item.usuario_responsavel || "-"}</span></div>
                  {(item.status === "EM ARMAZENAGEM" || paused) && (
                    <div className="col-span-2"><span className="text-muted-foreground">Tempo:</span> <span className={`text-primary ${!paused ? "animate-pulse" : ""}`}>{calcEffectiveArmazenagemTime(item)}</span></div>
                  )}
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {item.status === "AGUARDANDO ARMAZENAGEM" && (
                    <Button size="sm" onClick={() => iniciarArmazenagem(item.id, item)} className="bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 text-xs">
                      <Play className="mr-1 h-3 w-3" /> Iniciar
                    </Button>
                  )}
                  {item.status === "EM ARMAZENAGEM" && !paused && (
                    <>
                      <Button size="sm" onClick={() => finalizarArmazenagem(item)} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 text-xs">
                        <CheckCircle className="mr-1 h-3 w-3" /> Finalizar
                      </Button>
                      <Button size="sm" onClick={() => pausarArmazenagem(item)} className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30 text-xs">
                        <Pause className="mr-1 h-3 w-3" /> Pausar
                      </Button>
                    </>
                  )}
                  {paused && (
                    <>
                      <Button size="sm" onClick={() => retomarArmazenagem(item)} className="bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 text-xs">
                        <Play className="mr-1 h-3 w-3" /> Retomar
                      </Button>
                      <Button size="sm" onClick={() => finalizarArmazenagem(item)} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 text-xs">
                        <CheckCircle className="mr-1 h-3 w-3" /> Finalizar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ocorrências list */}
      {ocorrencias.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-heading text-lg text-foreground border-t border-border pt-4">Ocorrências Recentes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ocorrencias.map(o => (
              <div key={o.id} className="p-3 rounded-xl border border-border bg-card/60 backdrop-blur-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-heading text-foreground text-sm">{o.fornecedor}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary">{o.ocorrencia}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{o.registrado_por} · {new Date(o.data_criacao).toLocaleDateString("pt-BR")}</p>
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteOcorrencia(o.id)} className="text-destructive h-6 w-6"><Trash2 className="h-3 w-3" /></Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ArmazenagemPage;
