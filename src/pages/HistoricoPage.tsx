import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate, formatDateTime, formatTime, getStatusClass, calcDuration } from "@/lib/helpers";
import { useRealtime } from "@/hooks/useRealtime";
import { History, ChevronDown, ChevronUp, Trash2 } from "lucide-react";

const HistoricoPage = () => {
  const { profile } = useAuth();
  const [recebimentos, setRecebimentos] = useState<any[]>([]);
  const [armazenagens, setArmazenagens] = useState<any[]>([]);
  const [filterNF, setFilterNF] = useState("");
  const [filterFornecedor, setFilterFornecedor] = useState("");
  const [filterUsuario, setFilterUsuario] = useState("");
  const [filterData, setFilterData] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const isAdmin = profile?.cargo === "Administrador";

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
    if (!confirm("Remover este registro?")) return;
    await supabase.from("recebimentos").delete().eq("id", id);
    fetchAll();
  };

  const handleDeleteArm = async (id: string) => {
    if (!confirm("Remover este registro?")) return;
    await supabase.from("armazenagem").delete().eq("id", id);
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
                <div
                  className="p-3 flex items-center justify-between cursor-pointer hover:bg-secondary/20"
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading text-foreground">NF {r.numero_nf}</span>
                      <span className={`status-badge ${getStatusClass(r.status)}`}>{r.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{r.fornecedor} · {formatDate(r.data_prevista)} · {r.usuario_responsavel}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.valor_cobrado > 0 && (
                      <span className="text-sm font-heading text-primary">R$ {Number(r.valor_cobrado).toFixed(2)}</span>
                    )}
                    {isAdmin && (
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDeleteRec(r.id); }} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
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

                    {/* Chronometer section */}
                    <div className="p-3 rounded-lg bg-secondary/30 space-y-2">
                      <h4 className="font-heading text-sm text-primary">⏱ Cronômetro de Descarga</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        {r.hora_chegada && r.hora_acoplagem && (
                          <div className="flex justify-between p-2 rounded bg-card/50">
                            <span className="text-muted-foreground">Chegada → Acoplagem:</span>
                            <span className="text-foreground font-medium">{calcDuration(r.hora_chegada, r.hora_acoplagem)}</span>
                          </div>
                        )}
                        {r.hora_acoplagem && r.hora_desacoplagem && (
                          <div className="flex justify-between p-2 rounded bg-card/50">
                            <span className="text-muted-foreground">Acoplagem → Desacoplagem:</span>
                            <span className="text-foreground font-medium">{calcDuration(r.hora_acoplagem, r.hora_desacoplagem)}</span>
                          </div>
                        )}
                        {r.hora_desacoplagem && r.hora_inicio_descarga && (
                          <div className="flex justify-between p-2 rounded bg-card/50">
                            <span className="text-muted-foreground">Desacoplagem → Início Descarga:</span>
                            <span className="text-foreground font-medium">{calcDuration(r.hora_desacoplagem, r.hora_inicio_descarga)}</span>
                          </div>
                        )}
                        {r.hora_inicio_descarga && r.hora_fim_descarga && (
                          <div className="flex justify-between p-2 rounded bg-card/50">
                            <span className="text-muted-foreground">Descarga (início → fim):</span>
                            <span className="text-foreground font-medium">{calcDuration(r.hora_inicio_descarga, r.hora_fim_descarga)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Pricing section */}
                    {(r.caixas_batidas > 0 || r.pallets_descarregados > 0) && (
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-1 text-sm">
                        <h4 className="font-heading text-sm text-primary">💰 Valor Cobrado</h4>
                        {r.caixas_batidas > 0 && <p className="text-foreground">Caixas batidas: {r.caixas_batidas}</p>}
                        {r.pallets_descarregados > 0 && <p className="text-foreground">Pallets descarregados: {r.pallets_descarregados}</p>}
                        <p className="font-heading text-lg text-primary">Total: R$ {Number(r.valor_cobrado).toFixed(2)}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
                      <div>Chegada: {formatTime(r.hora_chegada)}</div>
                      <div>Acoplou: {formatTime(r.hora_acoplagem)}</div>
                      <div>Desacoplou: {formatTime(r.hora_desacoplagem)}</div>
                      <div>Início Desc.: {formatTime(r.hora_inicio_descarga)}</div>
                      <div>Fim Desc.: {formatTime(r.hora_fim_descarga)}</div>
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
            <div key={a.id} className="p-3 rounded-lg border border-border bg-card/40 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-heading text-foreground">NF {a.recebimentos?.numero_nf}</span>
                  <span className={`status-badge ${getStatusClass(a.status)}`}>{a.status}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {a.recebimentos?.fornecedor} · {a.usuario_responsavel} · {formatDateTime(a.data_criacao)}
                  {a.hora_inicio && a.hora_fim && ` · Tempo: ${calcDuration(a.hora_inicio, a.hora_fim)}`}
                </p>
              </div>
              {isAdmin && (
                <Button variant="ghost" size="icon" onClick={() => handleDeleteArm(a.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HistoricoPage;
