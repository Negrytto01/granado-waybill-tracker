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
    // Delete related armazenagem first
    await supabase.from("armazenagem").delete().eq("recebimento_id", id);
    // Delete related fluxo_financeiro
    await supabase.from("fluxo_financeiro").delete().eq("recebimento_id", id);
    // Delete the recebimento
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
    });
    setEditRecModal(r);
  };

  const handleEditRec = async () => {
    if (!editRecModal) return;
    const newValor = Number(editRecForm.valor_cobrado) || 0;
    const oldValor = Number(editRecModal.valor_cobrado) || 0;

    const { error } = await supabase.from("recebimentos").update({
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
    }).eq("id", editRecModal.id);
    if (error) { toast.error(error.message); return; }

    // Update fluxo_financeiro if valor changed
    if (newValor !== oldValor) {
      // Remove old entry if exists
      await supabase.from("fluxo_financeiro").delete().eq("recebimento_id", editRecModal.id);
      // Insert new if valor > 0
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
          ) : filteredRec.map(r => {
            const isExpanded = expandedId === r.id;
            return (
              <div key={r.id} className="rounded-lg border border-border bg-card/40">
                <div className="p-3 flex items-center justify-between cursor-pointer hover:bg-secondary/20" onClick={() => setExpandedId(isExpanded ? null : r.id)}>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-heading text-foreground">
                        {r.numero_nf.includes("/") ? (
                          <span className="flex flex-wrap gap-1 items-center">
                            {r.numero_nf.split(/\s*\/\s*/).map((nf: string, i: number) => (
                              <span key={i} className="inline-block px-1.5 py-0.5 rounded bg-secondary text-xs">
                                NF {formatNF(nf.trim())}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <>NF {formatNF(r.numero_nf)}</>
                        )}
                      </span>
                      <span className={`status-badge ${getStatusClass(r.status)}`}>{r.status}</span>
                      {r.is_retirada && <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">RETIRADA</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">{r.fornecedor} · {formatDate(r.data_prevista)} · {r.usuario_responsavel}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.valor_cobrado > 0 && <span className="text-sm font-heading text-primary">R$ {Number(r.valor_cobrado).toFixed(2)}</span>}
                    {isAdmin && (
                      <>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEditRec(r); }} className="text-muted-foreground hover:text-foreground">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDeleteRec(r.id); }} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-border/50 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mt-3">
                      <div><span className="text-muted-foreground">Volumes:</span> <span className="text-foreground">{r.quantidade_volumes || 0} caixas</span></div>
                      <div><span className="text-muted-foreground">Itens:</span> <span className="text-foreground">{r.quantidade_itens || 0}</span></div>
                      <div><span className="text-muted-foreground">Resp:</span> <span className="text-foreground">{r.usuario_responsavel || "-"}</span></div>
                    </div>

                    {!r.is_retirada && (
                      <div className="p-3 rounded-lg bg-secondary/30 space-y-2">
                        <h4 className="font-heading text-sm text-primary">⏱ Cronômetro de Descarga</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                          {r.hora_chegada && (
                            <div className="flex justify-between p-2 rounded bg-card/50">
                              <span className="text-muted-foreground">📍 Chegada:</span>
                              <span className="text-foreground font-medium">{formatTime(r.hora_chegada)}</span>
                            </div>
                          )}
                          {r.hora_chegada && r.hora_acoplagem && (
                            <div className="flex justify-between p-2 rounded bg-card/50">
                              <span className="text-muted-foreground">🚛 Tempo para acoplar:</span>
                              <span className="text-foreground font-medium">{calcDuration(r.hora_chegada, r.hora_acoplagem)}</span>
                            </div>
                          )}
                          {r.hora_inicio_descarga && r.hora_fim_descarga && (
                            <div className="flex justify-between p-2 rounded bg-card/50">
                              <span className="text-muted-foreground">📦 Tempo de descarga:</span>
                              <span className="text-foreground font-medium">{calcDuration(r.hora_inicio_descarga, r.hora_fim_descarga)}</span>
                            </div>
                          )}
                          {r.hora_fim_descarga && r.hora_desacoplagem && (
                            <div className="flex justify-between p-2 rounded bg-card/50">
                              <span className="text-muted-foreground">🔍 Conferência até liberação:</span>
                              <span className="text-foreground font-medium">{calcDuration(r.hora_fim_descarga, r.hora_desacoplagem)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {(r.caixas_batidas > 0 || r.pallets_descarregados > 0 || r.toneladas > 0) && (
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-1 text-sm">
                        <h4 className="font-heading text-sm text-primary">💰 Valor Cobrado</h4>
                        {r.caixas_batidas > 0 && <p className="text-foreground">Caixas batidas: {r.caixas_batidas}</p>}
                        {r.pallets_descarregados > 0 && <p className="text-foreground">Pallets descarregados: {r.pallets_descarregados}</p>}
                        {r.toneladas > 0 && <p className="text-foreground">Toneladas: {r.toneladas}</p>}
                        {r.tipo_descarga && <p className="text-foreground">Tipo: {r.tipo_descarga}</p>}
                        <p className="font-heading text-lg text-primary">Total: R$ {Number(r.valor_cobrado).toFixed(2)}</p>
                      </div>
                    )}

                    {r.observacoes && (
                      <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 space-y-1 text-sm">
                        <h4 className="font-heading text-sm text-yellow-400">📝 Observações</h4>
                        <p className="text-foreground whitespace-pre-wrap">{r.observacoes}</p>
                      </div>
                    )}

                    {r.nfd_numero && (
                      <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 space-y-1 text-sm">
                        <h4 className="font-heading text-sm text-red-400">📄 NFD (Nota Fiscal de Devolução)</h4>
                        <p className="text-foreground">{formatNF(r.nfd_numero)}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
                      <div>Chegada: {formatTime(r.hora_chegada)}</div>
                      <div>Acoplou: {formatTime(r.hora_acoplagem)}</div>
                      <div>Início Desc.: {formatTime(r.hora_inicio_descarga)}</div>
                      <div>Fim Desc.: {formatTime(r.hora_fim_descarga)}</div>
                      <div>Desacoplou: {formatTime(r.hora_desacoplagem)}</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="armazenagem" className="space-y-2 mt-4">
          {armazenagens.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum registro encontrado</p>
          ) : armazenagens.map(a => (
            <div key={a.id} className="p-3 rounded-lg border border-border bg-card/40">
              <div className="flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-heading text-foreground">
                      {a.recebimentos?.numero_nf?.includes("/") ? (
                        <span className="flex flex-wrap gap-1 items-center">
                          {a.recebimentos.numero_nf.split(/\s*\/\s*/).map((nf: string, i: number) => (
                            <span key={i} className="inline-block px-1.5 py-0.5 rounded bg-secondary text-xs">
                              NF {formatNF(nf.trim())}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <>NF {a.recebimentos?.numero_nf ? formatNF(a.recebimentos.numero_nf) : "-"}</>
                      )}
                    </span>
                    <span className={`status-badge ${getStatusClass(a.status)}`}>{a.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {a.recebimentos?.fornecedor} · {a.usuario_responsavel} · {formatDateTime(a.data_criacao)}
                  </p>
                  {a.hora_inicio && a.hora_fim && (
                    <p className="text-xs text-primary mt-1">
                      ⏱ Tempo efetivo: {calcEffectiveArmazenagemTime(a)}
                      {(a.pausas || []).length > 0 && ` (${(a.pausas || []).length} pausa(s))`}
                    </p>
                  )}
                  {a.observacoes_armazenagem && (
                    <p className="text-xs text-yellow-400 mt-1">📝 {a.observacoes_armazenagem}</p>
                  )}
                </div>
                {isAdmin && (
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteArm(a.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
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
            <div>
              <label className="text-xs text-muted-foreground">Data Prevista</label>
              <Input type="date" value={editRecForm.data_prevista || ""} onChange={e => setEditRecForm({...editRecForm, data_prevista: e.target.value})} className="bg-secondary mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Horário</label>
              <Input type="time" value={editRecForm.horario_agenda || ""} onChange={e => setEditRecForm({...editRecForm, horario_agenda: e.target.value})} className="bg-secondary mt-1" />
            </div>
            <Textarea placeholder="Observações" value={editRecForm.observacoes || ""} onChange={e => setEditRecForm({...editRecForm, observacoes: e.target.value})} className="bg-secondary" rows={2} />
            <Input placeholder="NFD" value={editRecForm.nfd_numero || ""} onChange={e => setEditRecForm({...editRecForm, nfd_numero: e.target.value})} className="bg-secondary" />
            
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
    </div>
  );
};

export default HistoricoPage;
