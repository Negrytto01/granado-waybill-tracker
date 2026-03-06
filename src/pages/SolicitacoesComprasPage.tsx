import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatNF } from "@/lib/helpers";
import { Plus, X, Check, XCircle, Clock, CalendarDays, Send, Trash2, RotateCcw } from "lucide-react";

interface NFSolicitacao {
  numero_nf: string;
  quantidade_volumes: number;
  is_pallet: boolean;
}

const SolicitacoesComprasPage = () => {
  const { profile } = useAuth();
  const { hasAccess, isAdmin } = usePermissions();
  const [solicitacoes, setSolicitacoes] = useState<any[]>([]);
  const [openNew, setOpenNew] = useState(false);
  const [respondModal, setRespondModal] = useState<any>(null);
  const [fornecedor, setFornecedor] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [dataSugerida, setDataSugerida] = useState("");
  const [horarioSugerido, setHorarioSugerido] = useState("");
  const [nfEntries, setNfEntries] = useState<NFSolicitacao[]>([{ numero_nf: "", quantidade_volumes: 0, is_pallet: false }]);
  const [respostaObs, setRespostaObs] = useState("");
  const [respostaData, setRespostaData] = useState("");

  const canRespond = hasAccess("agenda") || isAdmin;

  const fetchData = useCallback(async () => {
    const { data } = await supabase.from("solicitacoes_compras").select("*").order("data_criacao", { ascending: false });
    setSolicitacoes(data || []);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel("solicitacoes-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "solicitacoes_compras" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const addNfEntry = () => setNfEntries([...nfEntries, { numero_nf: "", quantidade_volumes: 0, is_pallet: false }]);
  const removeNfEntry = (i: number) => setNfEntries(nfEntries.filter((_, idx) => idx !== i));
  const updateNfEntry = (i: number, field: keyof NFSolicitacao, value: string | number | boolean) => {
    const updated = [...nfEntries];
    (updated[i] as any)[field] = value;
    setNfEntries(updated);
  };

  const resetForm = () => {
    setFornecedor("");
    setObservacoes("");
    setDataSugerida("");
    setHorarioSugerido("");
    setNfEntries([{ numero_nf: "", quantidade_volumes: 0, is_pallet: false }]);
  };

  const handleCreate = async () => {
    if (!fornecedor.trim()) { toast.error("Informe o fornecedor"); return; }
    const validNFs = nfEntries.filter(nf => nf.numero_nf.trim());
    const totalVolumes = validNFs.filter(nf => !nf.is_pallet).reduce((s, nf) => s + Number(nf.quantidade_volumes), 0);

    const { error } = await supabase.from("solicitacoes_compras").insert([{
      fornecedor,
      volumes: totalVolumes,
      observacoes: observacoes || null,
      data_sugerida: dataSugerida || null,
      horario_sugerido: horarioSugerido || null,
      solicitado_por: profile?.nome,
      solicitado_por_user_id: (await supabase.auth.getUser()).data.user?.id,
      nf_entries: validNFs.length > 0 ? validNFs : [],
      status: "PENDENTE",
    } as any]);
    if (error) { toast.error(error.message); return; }
    toast.success("Solicitação enviada!");
    setOpenNew(false);
    resetForm();
  };

  const responder = async (aprovado: boolean) => {
    if (!respondModal) return;
    const { error } = await supabase.from("solicitacoes_compras").update({
      status: aprovado ? "APROVADO_AGENDA" : "REJEITADO",
      respondido_por: profile?.nome,
      data_resposta: new Date().toISOString(),
      resposta_observacoes: respostaObs || null,
      data_sugerida: respostaData || respondModal.data_sugerida,
    } as any).eq("id", respondModal.id);
    if (error) { toast.error(error.message); return; }
    toast.success(aprovado ? "Solicitação aprovada!" : "Solicitação rejeitada.");
    setRespondModal(null);
    setRespostaObs("");
    setRespostaData("");
  };

  const aprovarFinal = async (sol: any) => {
    const nfs: NFSolicitacao[] = sol.nf_entries || [];
    const concatenatedNFs = nfs.map((nf: any) => nf.numero_nf).filter(Boolean).join(" / ");
    const totalVolumes = nfs.filter((nf: any) => !nf.is_pallet).reduce((s: number, nf: any) => s + Number(nf.quantidade_volumes), 0);
    const hasPallet = nfs.some((nf: any) => nf.is_pallet);

    const { error: recError } = await supabase.from("recebimentos").insert([{
      numero_nf: concatenatedNFs || "S/N",
      fornecedor: sol.fornecedor,
      quantidade_volumes: totalVolumes,
      data_prevista: sol.data_sugerida || new Date().toISOString().split("T")[0],
      horario_agenda: sol.horario_sugerido || null,
      usuario_responsavel: sol.solicitado_por,
      status: "AGENDADO" as any,
      is_pallet: hasPallet,
    }]);
    if (recError) { toast.error(recError.message); return; }

    await supabase.from("solicitacoes_compras").update({
      status: "FINALIZADO",
      data_aprovacao_compras: new Date().toISOString(),
    } as any).eq("id", sol.id);
    toast.success("Solicitação aprovada e agenda criada!");
  };

  const rejeitarFinal = async (sol: any) => {
    await supabase.from("solicitacoes_compras").update({
      status: "REJEITADO_COMPRAS",
      data_aprovacao_compras: new Date().toISOString(),
    } as any).eq("id", sol.id);
    toast.info("Solicitação rejeitada.");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover esta solicitação?")) return;
    const { error } = await supabase.from("solicitacoes_compras").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Solicitação removida!");
  };

  const handleReopen = async (id: string) => {
    const { error } = await supabase.from("solicitacoes_compras").update({
      status: "PENDENTE",
      respondido_por: null,
      data_resposta: null,
      resposta_observacoes: null,
      data_aprovacao_compras: null,
    } as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Solicitação reaberta!");
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      "PENDENTE": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      "APROVADO_AGENDA": "bg-blue-500/20 text-blue-400 border-blue-500/30",
      "REJEITADO": "bg-red-500/20 text-red-400 border-red-500/30",
      "REJEITADO_COMPRAS": "bg-red-500/20 text-red-400 border-red-500/30",
      "FINALIZADO": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    };
    const labels: Record<string, string> = {
      "PENDENTE": "Aguardando Agenda",
      "APROVADO_AGENDA": "Aguardando Confirmação",
      "REJEITADO": "Rejeitado pela Agenda",
      "REJEITADO_COMPRAS": "Rejeitado",
      "FINALIZADO": "Concluído",
    };
    return <span className={`text-xs px-2 py-0.5 rounded border ${map[status] || ""}`}>{labels[status] || status}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-heading text-3xl neon-text">Solicitações</h1>
        <Dialog open={openNew} onOpenChange={(open) => { setOpenNew(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/80">
              <Plus className="mr-2 h-4 w-4" /> Nova Solicitação
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-heading neon-text">Nova Solicitação</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Fornecedor *" value={fornecedor} onChange={e => setFornecedor(e.target.value)} className="bg-secondary" />
              <div>
                <label className="text-xs text-muted-foreground">Data sugerida</label>
                <Input type="date" value={dataSugerida} onChange={e => setDataSugerida(e.target.value)} className="bg-secondary mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Horário sugerido</label>
                <Input type="time" value={horarioSugerido} onChange={e => setHorarioSugerido(e.target.value)} className="bg-secondary mt-1" />
              </div>
              <Textarea placeholder="Observações (urgência, detalhes...)" value={observacoes} onChange={e => setObservacoes(e.target.value)} className="bg-secondary" rows={2} />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">Notas Fiscais</label>
                  <Button type="button" variant="outline" size="sm" onClick={addNfEntry} className="text-xs border-primary/50 text-primary">
                    <Plus className="h-3 w-3 mr-1" /> Adicionar NF
                  </Button>
                </div>
                {nfEntries.map((nf, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1 space-y-1">
                      <Input placeholder={`Número NF ${i + 1}`} inputMode="numeric" value={nf.numero_nf} onChange={e => updateNfEntry(i, "numero_nf", e.target.value)} className="bg-secondary" />
                      <Input type="text" inputMode="numeric" placeholder="Qtd Volumes" value={nf.quantidade_volumes || ""} onChange={e => updateNfEntry(i, "quantidade_volumes", Number(e.target.value))} className="bg-secondary" />
                    </div>
                    {nfEntries.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeNfEntry(i)} className="text-destructive mt-1">
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <Button onClick={handleCreate} className="w-full bg-primary text-primary-foreground hover:bg-primary/80">
                <Send className="mr-2 h-4 w-4" /> Enviar Solicitação
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {solicitacoes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CalendarDays className="mx-auto h-12 w-12 mb-3 opacity-30" />
          <p>Nenhuma solicitação</p>
        </div>
      ) : (
        <div className="space-y-3">
          {solicitacoes.map(sol => {
            const nfs: NFSolicitacao[] = sol.nf_entries || [];
            const isSolicitor = profile?.nome === sol.solicitado_por;
            return (
              <div key={sol.id} className="p-4 rounded-lg border border-border bg-card/60 backdrop-blur-sm space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-heading text-lg text-foreground">{sol.fornecedor}</span>
                      {getStatusBadge(sol.status)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Solicitado por: {sol.solicitado_por}
                      {sol.data_sugerida && ` · Data: ${new Date(sol.data_sugerida + "T12:00:00").toLocaleDateString("pt-BR")}`}
                      {sol.horario_sugerido && ` às ${sol.horario_sugerido.substring(0, 5)}`}
                    </p>
                    {nfs.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {nfs.map((nf: any, i: number) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded bg-secondary text-foreground">
                            NF {formatNF(nf.numero_nf)} ({nf.quantidade_volumes} vol)
                          </span>
                        ))}
                      </div>
                    )}
                    {sol.volumes > 0 && <p className="text-xs text-muted-foreground mt-1">Total volumes: {sol.volumes}</p>}
                    {sol.observacoes && <p className="text-xs text-yellow-400 mt-1">📝 {sol.observacoes}</p>}
                    {sol.resposta_observacoes && <p className="text-xs text-blue-400 mt-1">💬 Resposta: {sol.resposta_observacoes}</p>}
                    {sol.respondido_por && <p className="text-xs text-muted-foreground mt-1">Respondido por: {sol.respondido_por}</p>}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      {sol.status !== "PENDENTE" && (
                        <Button variant="ghost" size="icon" onClick={() => handleReopen(sol.id)} title="Reabrir" className="text-blue-400 hover:text-blue-300">
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(sol.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 flex-wrap">
                  {sol.status === "PENDENTE" && canRespond && (
                    <>
                      <Button size="sm" onClick={() => { setRespondModal(sol); setRespostaData(sol.data_sugerida || ""); }} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30">
                        <Check className="mr-2 h-4 w-4" /> Aprovar / Sugerir Data
                      </Button>
                      <Button size="sm" onClick={() => { setRespondModal(sol); setRespostaData(""); }} className="bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30">
                        <XCircle className="mr-2 h-4 w-4" /> Rejeitar
                      </Button>
                    </>
                  )}
                  {sol.status === "APROVADO_AGENDA" && (isSolicitor || isAdmin) && (
                    <>
                      <Button size="sm" onClick={() => aprovarFinal(sol)} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30">
                        <Check className="mr-2 h-4 w-4" /> Confirmar e Agendar
                      </Button>
                      <Button size="sm" onClick={() => rejeitarFinal(sol)} className="bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30">
                        <XCircle className="mr-2 h-4 w-4" /> Rejeitar
                      </Button>
                    </>
                  )}
                  {sol.status === "PENDENTE" && !canRespond && (
                    <span className="text-xs text-yellow-400 flex items-center gap-1"><Clock className="h-3 w-3" /> Aguardando resposta da Agenda</span>
                  )}
                  {sol.status === "APROVADO_AGENDA" && !isSolicitor && !isAdmin && (
                    <span className="text-xs text-blue-400 flex items-center gap-1"><Clock className="h-3 w-3" /> Aguardando confirmação do solicitante</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Respond modal */}
      <Dialog open={!!respondModal} onOpenChange={(open) => { if (!open) { setRespondModal(null); setRespostaObs(""); setRespostaData(""); } }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="font-heading neon-text">Responder Solicitação</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{respondModal?.fornecedor} — {respondModal?.volumes} volumes</p>
            {respondModal?.observacoes && <p className="text-xs text-yellow-400">📝 {respondModal.observacoes}</p>}
            <div>
              <label className="text-xs text-muted-foreground">Data sugerida (pode alterar)</label>
              <Input type="date" value={respostaData} onChange={e => setRespostaData(e.target.value)} className="bg-secondary mt-1" />
            </div>
            <Textarea placeholder="Observações de resposta..." value={respostaObs} onChange={e => setRespostaObs(e.target.value)} className="bg-secondary" rows={2} />
            <div className="flex gap-2">
              <Button onClick={() => responder(true)} className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700">
                <Check className="mr-2 h-4 w-4" /> Aprovar
              </Button>
              <Button onClick={() => responder(false)} variant="outline" className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10">
                <XCircle className="mr-2 h-4 w-4" /> Rejeitar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SolicitacoesComprasPage;
