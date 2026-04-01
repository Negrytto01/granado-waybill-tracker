import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate, formatDateTime, formatTime, formatNF, getStatusClass, calcDuration, calcEffectiveArmazenagemTime } from "@/lib/helpers";
import { useRealtime } from "@/hooks/useRealtime";
import { ChevronDown, ChevronUp, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";

const HistoricoPage = () => {
  const { profile } = useAuth();
  const [recebimentos, setRecebimentos] = useState<any[]>([]);
  const [armazenagens, setArmazenagens] = useState<any[]>([]);
  const [filterNF, setFilterNF] = useState("");
  const [filterFornecedor, setFilterFornecedor] = useState("");
  const [filterUsuario, setFilterUsuario] = useState("");
  const [filterData, setFilterData] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editRecModal, setEditRecModal] = useState<any>(null);
  const [editRecForm, setEditRecForm] = useState<any>({});
  const [editArmModal, setEditArmModal] = useState<any>(null);
  const [editArmForm, setEditArmForm] = useState<any>({});
  const isAdmin = profile?.cargo === "Master";

  const fetchAll = useCallback(async () => {
    const [rec, arm] = await Promise.all([
      supabase.from("recebimentos").select("*").order("data_criacao", { ascending: false }).limit(200),
      supabase.from("armazenagem").select("*, recebimentos(numero_nf, fornecedor)").order("data_criacao", { ascending: false }).limit(200),
    ]);
    setRecebimentos(rec.data || []);
    setArmazenagens(arm.data || []);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useRealtime("recebimentos", fetchAll);
  useRealtime("armazenagem", fetchAll);

  const filteredRec = recebimentos.filter(r => {
    if (filterNF && !r.numero_nf?.toLowerCase().includes(filterNF.toLowerCase())) return false;
    if (filterFornecedor && !r.fornecedor?.toLowerCase().includes(filterFornecedor.toLowerCase())) return false;
    if (filterUsuario && !r.usuario_responsavel?.toLowerCase().includes(filterUsuario.toLowerCase())) return false;
    if (filterData && r.data_prevista !== filterData) return false;
    return true;
  });

  const handleDeleteRec = async (id: string) => {
    if (!confirm("Remover este registro e todos os dados vinculados (armazenagem, financeiro)?")) return;
    await supabase.from("armazenagem").delete().eq("recebimento_id", id);
    await supabase.from("fluxo_financeiro").delete().eq("recebimento_id", id);
    const { error } = await supabase.from("recebimentos").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Registro removido!");
    fetchAll();
  };

  const handleDeleteArm = async (id: string) => {
    if (!confirm("Remover este registro?")) return;
    const { error } = await supabase.from("armazenagem").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Removido!");
    fetchAll();
  };

  const openEditRec = (r: any) => {
    setEditRecForm({
      numero_nf: r.numero_nf,
      fornecedor: r.fornecedor,
      quantidade_volumes: r.quantidade_volumes || 0,
      data_prevista: r.data_prevista || "",
      horario_agenda: r.horario_agenda || "",
      observacoes: r.observacoes || "",
      nfd_numero: r.nfd_numero || "",
      valor_cobrado: r.valor_cobrado || 0,
      caixas_batidas: r.caixas_batidas || 0,
      pallets_descarregados: r.pallets_descarregados || 0,
      toneladas: r.toneladas || 0,
      tipo_descarga: r.tipo_descarga || "nenhum",
      hora_chegada: r.hora_chegada ? new Date(r.hora_chegada).toISOString().slice(0, 16) : "",
      hora_acoplagem: r.hora_acoplagem ? new Date(r.hora_acoplagem).toISOString().slice(0, 16) : "",
      hora_inicio_descarga: r.hora_inicio_descarga ? new Date(r.hora_inicio_descarga).toISOString().slice(0, 16) : "",
      hora_fim_descarga: r.hora_fim_descarga ? new Date(r.hora_fim_descarga).toISOString().slice(0, 16) : "",
      hora_desacoplagem: r.hora_desacoplagem ? new Date(r.hora_desacoplagem).toISOString().slice(0, 16) : "",
    });
    setEditRecModal(r);
  };

  const handleEditRec = async () => {
    if (!editRecModal) return;
    const newValor = Number(editRecForm.valor_cobrado) || 0;
    const oldValor = Number(editRecModal.valor_cobrado) || 0;

    const updateData: any = {
      numero_nf: editRecForm.numero_nf,
      fornecedor: editRecForm.fornecedor,
      quantidade_volumes: Number(editRecForm.quantidade_volumes),
      data_prevista: editRecForm.data_prevista || null,
      horario_agenda: editRecForm.horario_agenda || null,
      observacoes: editRecForm.observacoes || null,
      nfd_numero: editRecForm.nfd_numero || null,
      valor_cobrado: newValor,
      caixas_batidas: Number(editRecForm.caixas_batidas) || 0,
      pallets_descarregados: Number(editRecForm.pallets_descarregados) || 0,
      toneladas: Number(editRecForm.toneladas) || 0,
      tipo_descarga: editRecForm.tipo_descarga || null,
    };

    // Update timestamps if admin edited them
    if (editRecForm.hora_chegada) updateData.hora_chegada = new Date(editRecForm.hora_chegada).toISOString();
    if (editRecForm.hora_acoplagem) updateData.hora_acoplagem = new Date(editRecForm.hora_acoplagem).toISOString();
    if (editRecForm.hora_inicio_descarga) updateData.hora_inicio_descarga = new Date(editRecForm.hora_inicio_descarga).toISOString();
    if (editRecForm.hora_fim_descarga) updateData.hora_fim_descarga = new Date(editRecForm.hora_fim_descarga).toISOString();
    if (editRecForm.hora_desacoplagem) updateData.hora_desacoplagem = new Date(editRecForm.hora_desacoplagem).toISOString();

    const { error } = await supabase.from("recebimentos").update(updateData).eq("id", editRecModal.id);
    if (error) { toast.error(error.message); return; }

    if (newValor !== oldValor) {
      await supabase.from("fluxo_financeiro").delete().eq("recebimento_id", editRecModal.id);
      if (newValor > 0) {
        await supabase.from("fluxo_financeiro").insert([{
          tipo: "ENTRADA",
          descricao: `Descarga NF ${editRecForm.numero_nf} - ${editRecForm.fornecedor}`,
          valor: newValor,
          recebimento_id: editRecModal.id,
          criado_por: profile?.nome,
        }] as any);
      }
    }

    toast.success("Registro atualizado!");
    setEditRecModal(null);
    fetchAll();
  };

  const openEditArm = (a: any) => {
    setEditArmForm({
      hora_inicio: a.hora_inicio ? new Date(a.hora_inicio).toISOString().slice(0, 16) : "",
      hora_fim: a.hora_fim ? new Date(a.hora_fim).toISOString().slice(0, 16) : "",
      observacoes_armazenagem: a.observacoes_armazenagem || "",
    });
    setEditArmModal(a);
  };

  const handleEditArm = async () => {
    if (!editArmModal) return;
    const updateData: any = {
      observacoes_armazenagem: editArmForm.observacoes_armazenagem || null,
    };
    if (editArmForm.hora_inicio) updateData.hora_inicio = new Date(editArmForm.hora_inicio).toISOString();
    if (editArmForm.hora_fim) updateData.hora_fim = new Date(editArmForm.hora_fim).toISOString();

    const { error } = await supabase.from("armazenagem").update(updateData).eq("id", editArmModal.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Armazenagem atualizada!");
    setEditArmModal(null);
    fetchAll();
  };

  const renderNFs = (nf: string) => {
    if (nf.includes("/")) {
      return (
        <span className="flex flex-wrap gap-1 items-center">
          {nf.split(/\s*\/\s*/).map((n: string, i: number) => (
            <span key={i} className="inline-block px-1.5 py-0.5 rounded bg-secondary text-xs">NF {formatNF(n.trim())}</span>
          ))}
        </span>
      );
    }
    return <>NF {formatNF(nf)}</>;
  };

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl neon-text">Histórico</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Input placeholder="Filtrar NF" value={filterNF} onChange={e => setFilterNF(e.target.value)} className="bg-secondary" />
        <Input placeholder="Filtrar Fornecedor" value={filterFornecedor} onChange={e => setFilterFornecedor(e.target.value)} className="bg-secondary" />
        <Input placeholder="Filtrar Usuário" value={filterUsuario} onChange={e => setFilterUsuario(e.target.value)} className="bg-secondary" />
        <Input type="date" value={filterData} onChange={e => setFilterData(e.target.value)} className="bg-secondary" />
      </div>

      <Tabs defaultValue="recebimentos">
        <TabsList className="bg-secondary">
          <TabsTrigger value="recebimentos">Recebimentos / Descargas</TabsTrigger>
          <TabsTrigger value="armazenagem">Armazenagem</TabsTrigger>
        </TabsList>

        <TabsContent value="recebimentos" className="space-y-2 mt-4">
          {filteredRec.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum registro encontrado</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredRec.map(r => {
                const isExpanded = expandedId === r.id;
                return (
                  <div key={r.id} className="rounded-xl border border-border bg-card/60 backdrop-blur-sm">
                    <div className="p-3 cursor-pointer hover:bg-secondary/20" onClick={() => setExpandedId(isExpanded ? null : r.id)}>
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-heading text-foreground text-sm">{renderNFs(r.numero_nf)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap mt-1">
                            <span className={`status-badge ${getStatusClass(r.status)}`}>{r.status}</span>
                            {r.is_retirada && <span className="text-xs px-1 py-0.5 rounded bg-cyan-500/20 text-cyan-400">RET</span>}
                            {r.is_marketing && <span className="text-xs px-1 py-0.5 rounded bg-purple-500/20 text-purple-400">MKT</span>}
                            {r.is_encaixe && <span className="text-xs px-1 py-0.5 rounded bg-orange-500/20 text-orange-400">ENC</span>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{r.fornecedor} · {formatDate(r.data_prevista)}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {r.valor_cobrado > 0 && <span className="text-xs font-heading text-primary">R$ {Number(r.valor_cobrado).toFixed(2)}</span>}
                          {isAdmin && (
                            <>
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEditRec(r); }} className="text-muted-foreground hover:text-foreground h-7 w-7">
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDeleteRec(r.id); }} className="text-destructive hover:text-destructive h-7 w-7">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-3 pb-3 border-t border-border/50 space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                          <div><span className="text-muted-foreground">Volumes:</span> <span className="text-foreground">{r.quantidade_volumes || 0}</span></div>
                          <div><span className="text-muted-foreground">Resp:</span> <span className="text-foreground">{r.usuario_responsavel || "-"}</span></div>
                        </div>

                        {!r.is_retirada && !r.is_marketing && (
                          <div className="p-3 rounded-lg bg-secondary/30 space-y-2">
                            <h4 className="font-heading text-sm text-primary">⏱ Cronômetro</h4>
                            <div className="grid grid-cols-1 gap-1.5 text-sm">
                              {r.hora_chegada && (
                                <div className="flex justify-between p-1.5 rounded bg-card/50">
                                  <span className="text-muted-foreground text-xs">📍 Chegada:</span>
                                  <span className="text-foreground text-xs font-medium">{formatTime(r.hora_chegada)}</span>
                                </div>
                              )}
                              {r.hora_chegada && r.hora_acoplagem && (
                                <div className="flex justify-between p-1.5 rounded bg-card/50">
                                  <span className="text-muted-foreground text-xs">🚛 Tempo p/ acoplar:</span>
                                  <span className="text-foreground text-xs font-medium">{calcDuration(r.hora_chegada, r.hora_acoplagem)}</span>
                                </div>
                              )}
                              {r.hora_inicio_descarga && r.hora_fim_descarga && (
                                <div className="flex justify-between p-1.5 rounded bg-card/50">
                                  <span className="text-muted-foreground text-xs">📦 Tempo descarga:</span>
                                  <span className="text-foreground text-xs font-medium">{calcDuration(r.hora_inicio_descarga, r.hora_fim_descarga)}</span>
                                </div>
                              )}
                              {r.hora_fim_descarga && r.hora_desacoplagem && (
                                <div className="flex justify-between p-1.5 rounded bg-card/50">
                                  <span className="text-muted-foreground text-xs">🔍 Conferência:</span>
                                  <span className="text-foreground text-xs font-medium">{calcDuration(r.hora_fim_descarga, r.hora_desacoplagem)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {r.valor_cobrado > 0 && (
                          <div className="p-2 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                            <p className="font-heading text-primary">Total: R$ {Number(r.valor_cobrado).toFixed(2)}</p>
                          </div>
                        )}

                        {r.observacoes && <p className="text-xs text-yellow-400">📝 {r.observacoes}</p>}
                        {r.nfd_numero && <p className="text-xs text-red-400">📄 NFD: {formatNF(r.nfd_numero)}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="armazenagem" className="space-y-2 mt-4">
          {armazenagens.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum registro encontrado</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {armazenagens.map(a => (
                <div key={a.id} className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 flex-1">
                      <span className="font-heading text-foreground text-sm">{renderNFs(a.recebimentos?.numero_nf || "-")}</span>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`status-badge ${getStatusClass(a.status)}`}>{a.status}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{a.recebimentos?.fornecedor} · {a.usuario_responsavel}</p>
                      {a.hora_inicio && a.hora_fim && (
                        <p className="text-xs text-primary mt-1">
                          ⏱ {calcEffectiveArmazenagemTime(a)}
                          {(a.pausas || []).length > 0 && ` (${(a.pausas || []).length} pausa(s))`}
                        </p>
                      )}
                      {a.observacoes_armazenagem && <p className="text-xs text-yellow-400 mt-1">📝 {a.observacoes_armazenagem}</p>}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditArm(a)} className="text-muted-foreground hover:text-foreground h-7 w-7">
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteArm(a.id)} className="text-destructive hover:text-destructive h-7 w-7">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit recebimento modal */}
      <Dialog open={!!editRecModal} onOpenChange={(open) => { if (!open) setEditRecModal(null); }}>
        <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading neon-text">Editar Registro</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Número NF" value={editRecForm.numero_nf || ""} onChange={e => setEditRecForm({...editRecForm, numero_nf: e.target.value})} className="bg-secondary" />
            <Input placeholder="Fornecedor" value={editRecForm.fornecedor || ""} onChange={e => setEditRecForm({...editRecForm, fornecedor: e.target.value})} className="bg-secondary" />
            <Input type="text" inputMode="numeric" placeholder="Volumes" value={editRecForm.quantidade_volumes || ""} onChange={e => setEditRecForm({...editRecForm, quantidade_volumes: e.target.value})} className="bg-secondary" />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Data Prevista</label>
                <Input type="date" value={editRecForm.data_prevista || ""} onChange={e => setEditRecForm({...editRecForm, data_prevista: e.target.value})} className="bg-secondary mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Horário</label>
                <Input type="time" value={editRecForm.horario_agenda || ""} onChange={e => setEditRecForm({...editRecForm, horario_agenda: e.target.value})} className="bg-secondary mt-1" />
              </div>
            </div>
            <Textarea placeholder="Observações" value={editRecForm.observacoes || ""} onChange={e => setEditRecForm({...editRecForm, observacoes: e.target.value})} className="bg-secondary" rows={2} />
            <Input placeholder="NFD" value={editRecForm.nfd_numero || ""} onChange={e => setEditRecForm({...editRecForm, nfd_numero: e.target.value})} className="bg-secondary" />

            {/* Timestamps edit - Admin only */}
            <div className="border-t border-border pt-3">
              <h4 className="text-sm font-heading text-primary mb-2">⏱ Horários (Admin)</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Chegada</label>
                  <Input type="datetime-local" value={editRecForm.hora_chegada || ""} onChange={e => setEditRecForm({...editRecForm, hora_chegada: e.target.value})} className="bg-secondary mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Acoplagem</label>
                  <Input type="datetime-local" value={editRecForm.hora_acoplagem || ""} onChange={e => setEditRecForm({...editRecForm, hora_acoplagem: e.target.value})} className="bg-secondary mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Início Descarga</label>
                  <Input type="datetime-local" value={editRecForm.hora_inicio_descarga || ""} onChange={e => setEditRecForm({...editRecForm, hora_inicio_descarga: e.target.value})} className="bg-secondary mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Fim Descarga</label>
                  <Input type="datetime-local" value={editRecForm.hora_fim_descarga || ""} onChange={e => setEditRecForm({...editRecForm, hora_fim_descarga: e.target.value})} className="bg-secondary mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Desacoplagem</label>
                  <Input type="datetime-local" value={editRecForm.hora_desacoplagem || ""} onChange={e => setEditRecForm({...editRecForm, hora_desacoplagem: e.target.value})} className="bg-secondary mt-1" />
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <h4 className="text-sm font-heading text-primary mb-2">💰 Cobrança</h4>
              <div>
                <label className="text-xs text-muted-foreground">Valor Cobrado (R$)</label>
                <Input type="number" step="0.01" value={editRecForm.valor_cobrado || ""} onChange={e => setEditRecForm({...editRecForm, valor_cobrado: e.target.value})} className="bg-secondary mt-1" />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div>
                  <label className="text-xs text-muted-foreground">Caixas</label>
                  <Input type="text" inputMode="numeric" value={editRecForm.caixas_batidas || ""} onChange={e => setEditRecForm({...editRecForm, caixas_batidas: e.target.value})} className="bg-secondary mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Pallets</label>
                  <Input type="text" inputMode="numeric" value={editRecForm.pallets_descarregados || ""} onChange={e => setEditRecForm({...editRecForm, pallets_descarregados: e.target.value})} className="bg-secondary mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Toneladas</label>
                  <Input type="text" inputMode="decimal" value={editRecForm.toneladas || ""} onChange={e => setEditRecForm({...editRecForm, toneladas: e.target.value})} className="bg-secondary mt-1" />
                </div>
              </div>
            </div>

            <Button onClick={handleEditRec} className="w-full bg-primary text-primary-foreground hover:bg-primary/80">Atualizar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit armazenagem modal - Admin only */}
      <Dialog open={!!editArmModal} onOpenChange={(open) => { if (!open) setEditArmModal(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="font-heading neon-text">Editar Armazenagem</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{editArmModal?.recebimentos?.fornecedor}</p>
            <div>
              <label className="text-xs text-muted-foreground">Início Armazenagem</label>
              <Input type="datetime-local" value={editArmForm.hora_inicio || ""} onChange={e => setEditArmForm({...editArmForm, hora_inicio: e.target.value})} className="bg-secondary mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Fim Armazenagem</label>
              <Input type="datetime-local" value={editArmForm.hora_fim || ""} onChange={e => setEditArmForm({...editArmForm, hora_fim: e.target.value})} className="bg-secondary mt-1" />
            </div>
            <Textarea placeholder="Observações" value={editArmForm.observacoes_armazenagem || ""} onChange={e => setEditArmForm({...editArmForm, observacoes_armazenagem: e.target.value})} className="bg-secondary" rows={2} />
            <Button onClick={handleEditArm} className="w-full bg-primary text-primary-foreground hover:bg-primary/80">Atualizar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HistoricoPage;
