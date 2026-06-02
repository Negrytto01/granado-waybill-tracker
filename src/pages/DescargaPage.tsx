import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getStatusClass, formatTime, calcDuration, formatNF } from "@/lib/helpers";
import { useRealtime } from "@/hooks/useRealtime";
import { playDescargaFinalizada } from "@/lib/sounds";
import { Play, Truck, Link, Unlink, CheckCircle, MessageSquare, Plus, X, ClipboardCheck } from "lucide-react";

interface NFVerification {
  nf: string;
  arrived: boolean;
}

const DescargaPage = () => {
  const { profile } = useAuth();
  const [recebimentos, setRecebimentos] = useState<any[]>([]);
  const [finalizarModal, setFinalizarModal] = useState<any>(null);
  const [desacoplarModal, setDesacoplarModal] = useState<any>(null);
  const [verificacaoModal, setVerificacaoModal] = useState<any>(null);
  const [nfVerifications, setNfVerifications] = useState<NFVerification[]>([]);
  const [extraNFs, setExtraNFs] = useState<string[]>([]);
  const [newExtraNF, setNewExtraNF] = useState("");
  const [caixasBatidas, setCaixasBatidas] = useState("");
  const [palletsDescarregados, setPalletsDescarregados] = useState("");
  const [toneladas, setToneladas] = useState("");
  const [tipoDescarga, setTipoDescarga] = useState("nenhum");
  const [observacoes, setObservacoes] = useState("");
  const [nfdNumero, setNfdNumero] = useState("");
  const [transportadora, setTransportadora] = useState("");
  const [jaArmazenado, setJaArmazenado] = useState(false);
  const [valoresConfig, setValoresConfig] = useState({ valor_por_caixa: 0, valor_por_pallet: 0, valor_por_tonelada: 0 });
  const isAdmin = profile?.cargo === "Master";

  const fetchData = useCallback(async () => {
    const { data } = await supabase.from("recebimentos").select("*")
      .in("status", ["CHEGOU", "ACOPLADO", "EM DESCARGA", "AGUARDANDO DESACOPLAGEM"])
      .order("hora_chegada", { ascending: true });
    setRecebimentos(data || []);
    const { data: val } = await supabase.from("valores_descarga").select("*").limit(1);
    if (val && val.length > 0) {
      setValoresConfig({
        valor_por_caixa: Number(val[0].valor_por_caixa),
        valor_por_pallet: Number(val[0].valor_por_pallet),
        valor_por_tonelada: Number(val[0].valor_por_tonelada || 0),
      });
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useRealtime("recebimentos", fetchData);

  useEffect(() => {
    const hasActive = recebimentos.some(r => ["EM DESCARGA", "ACOPLADO"].includes(r.status));
    if (!hasActive) return;
    const i = setInterval(() => setRecebimentos(prev => [...prev]), 10000);
    return () => clearInterval(i);
  }, [recebimentos]);

  const logActivity = async (acao: string, detalhes?: string) => {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (userId) {
      await supabase.from("atividades_usuarios").insert([{
        user_id: userId,
        usuario_nome: profile?.nome || "",
        acao,
        detalhes,
      }] as any);
    }
  };

  const acoplar = async (id: string, r: any) => {
    await supabase.from("recebimentos").update({
      status: "ACOPLADO" as any,
      hora_acoplagem: new Date().toISOString(),
      usuario_responsavel: profile?.nome
    }).eq("id", id);
    await logActivity("Caminhão acoplado", `${r.fornecedor}`);
    toast.success("Caminhão acoplado!");
  };

  const openVerificacao = (r: any) => {
    const nfs = r.numero_nf.split(/\s*\/\s*/).map((nf: string) => nf.trim()).filter(Boolean);
    setNfVerifications(nfs.map((nf: string) => ({ nf, arrived: true })));
    setExtraNFs([]);
    setNewExtraNF("");
    setVerificacaoModal(r);
  };

  const confirmarVerificacao = async () => {
    if (!verificacaoModal) return;
    const notArrived = nfVerifications.filter(v => !v.arrived).map(v => v.nf);
    const obsArray: string[] = [];

    if (notArrived.length > 0) {
      obsArray.push(`NFs não chegaram conforme agendamento: ${notArrived.map(nf => formatNF(nf)).join(", ")}`);
    }

    let updatedNFs = verificacaoModal.numero_nf;
    if (extraNFs.length > 0) {
      updatedNFs = updatedNFs + " / " + extraNFs.join(" / ");
      obsArray.push(`NFs adicionadas sem agendamento prévio: ${extraNFs.map(nf => formatNF(nf)).join(", ")}`);
    }

    const existingObs = verificacaoModal.observacoes || "";
    const newObs = obsArray.length > 0
      ? (existingObs ? existingObs + " | " : "") + obsArray.join(" | ")
      : existingObs;

    await supabase.from("recebimentos").update({
      status: "EM DESCARGA" as any,
      hora_inicio_descarga: new Date().toISOString(),
      usuario_responsavel: profile?.nome,
      numero_nf: updatedNFs,
      observacoes: newObs || null,
    }).eq("id", verificacaoModal.id);

    await logActivity("Descarga iniciada", `${verificacaoModal.fornecedor}`);
    toast.success("Descarga iniciada!");
    setVerificacaoModal(null);
  };

  const openFinalizarModal = (r: any) => {
    setFinalizarModal(r);
    setCaixasBatidas("");
    setPalletsDescarregados("");
    setToneladas("");
    setTipoDescarga("nenhum");
    setObservacoes(r.observacoes || "");
    setNfdNumero(r.nfd_numero || "");
    setJaArmazenado(false);
  };

  const calcValorTotal = () => {
    const caixas = parseInt(caixasBatidas) || 0;
    const pallets = parseInt(palletsDescarregados) || 0;
    const ton = parseFloat(toneladas) || 0;
    let total = 0;
    if (tipoDescarga === "caixa" || tipoDescarga === "misto") total += caixas * valoresConfig.valor_por_caixa;
    if (tipoDescarga === "pallet" || tipoDescarga === "misto") total += pallets * valoresConfig.valor_por_pallet;
    if (tipoDescarga === "tonelada") total += ton * valoresConfig.valor_por_tonelada;
    return total;
  };

  const finalizarDescarga = async () => {
    if (!finalizarModal) return;
    const caixas = parseInt(caixasBatidas) || 0;
    const pallets = parseInt(palletsDescarregados) || 0;
    const ton = parseFloat(toneladas) || 0;
    const valorTotal = calcValorTotal();

    await supabase.from("recebimentos").update({
      status: "AGUARDANDO DESACOPLAGEM" as any,
      hora_fim_descarga: new Date().toISOString(),
      caixas_batidas: caixas,
      pallets_descarregados: pallets,
      toneladas: ton,
      tipo_descarga: tipoDescarga,
      valor_cobrado: valorTotal,
      observacoes: observacoes || null,
      nfd_numero: nfdNumero || null,
    }).eq("id", finalizarModal.id);

    if (!finalizarModal.is_pallet && !jaArmazenado) {
      await supabase.from("armazenagem").insert([{
        recebimento_id: finalizarModal.id,
        quantidade_itens: finalizarModal.quantidade_itens || 0,
        quantidade_volumes: finalizarModal.quantidade_volumes || 0,
        status: "AGUARDANDO ARMAZENAGEM" as any,
        usuario_responsavel: profile?.nome,
      }]);
    } else if (jaArmazenado) {
      // Already stored - mark as finalized directly
      await supabase.from("armazenagem").insert([{
        recebimento_id: finalizarModal.id,
        quantidade_itens: finalizarModal.quantidade_itens || 0,
        quantidade_volumes: finalizarModal.quantidade_volumes || 0,
        status: "FINALIZADO" as any,
        usuario_responsavel: profile?.nome,
        hora_inicio: new Date().toISOString(),
        hora_fim: new Date().toISOString(),
        observacoes_armazenagem: "Armazenado durante a descarga",
      }] as any);
    }

    if (valorTotal > 0) {
      await supabase.from("fluxo_financeiro").insert([{
        tipo: "ENTRADA",
        descricao: `Descarga NF ${finalizarModal.numero_nf} - ${finalizarModal.fornecedor}`,
        valor: valorTotal,
        recebimento_id: finalizarModal.id,
        criado_por: profile?.nome,
      }] as any);
    }

    await logActivity("Descarga finalizada", `${finalizarModal.fornecedor} - R$ ${valorTotal.toFixed(2)}`);
    playDescargaFinalizada();
    toast.success(valorTotal > 0 ? `Descarga finalizada! Valor: R$ ${valorTotal.toFixed(2)}` : "Descarga finalizada!");
    setFinalizarModal(null);
  };

  const desacoplar = async () => {
    if (!desacoplarModal) return;
    const finalStatus = desacoplarModal.is_pallet ? "FINALIZADO" : "AGUARDANDO ARMAZENAGEM";
    await supabase.from("recebimentos").update({
      status: finalStatus as any,
      hora_desacoplagem: new Date().toISOString(),
    }).eq("id", desacoplarModal.id);
    await logActivity("Caminhão desacoplado", `${desacoplarModal.fornecedor}`);
    toast.success("Caminhão desacoplado! Saída registrada.");
    setDesacoplarModal(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este recebimento?")) return;
    await supabase.from("recebimentos").delete().eq("id", id);
    toast.success("Removido!");
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-heading text-lg text-foreground">
                      {r.numero_nf.includes("/") ? (
                        <span className="flex flex-wrap gap-1.5 items-center">
                          {r.numero_nf.split(/\s*\/\s*/).map((nf: string, i: number) => (
                            <span key={i} className="inline-block px-2 py-0.5 rounded bg-secondary text-sm">
                              NF {formatNF(nf.trim())}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <>NF {formatNF(r.numero_nf)}</>
                      )}
                    </span>
                    <span className={`status-badge ${getStatusClass(r.status)}`}>{r.status}</span>
                    {r.is_pallet && <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">PALLET</span>}
                  </div>
                  <p className="text-sm text-muted-foreground">{r.fornecedor}</p>
                  {r.observacoes && (
                    <p className="text-xs text-yellow-400 flex items-center gap-1 mt-1">
                      <MessageSquare className="h-3 w-3" /> {r.observacoes}
                    </p>
                  )}
                  {r.nfd_numero && <p className="text-xs text-red-400 mt-1">NFD: {formatNF(r.nfd_numero)}</p>}
                </div>
                {isAdmin && (
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)} className="text-destructive hover:text-destructive">Remover</Button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <div><span className="text-muted-foreground">Chegada:</span> <span className="text-foreground">{formatTime(r.hora_chegada)}</span></div>
                {r.hora_acoplagem && <div><span className="text-muted-foreground">Acoplou:</span> <span className="text-foreground">{formatTime(r.hora_acoplagem)}</span></div>}
                {r.hora_inicio_descarga && <div><span className="text-muted-foreground">Início:</span> <span className="text-foreground">{formatTime(r.hora_inicio_descarga)}</span></div>}
                {r.status === "EM DESCARGA" && <div><span className="text-muted-foreground">Tempo:</span> <span className="text-primary animate-pulse">{calcDuration(r.hora_inicio_descarga, null)}</span></div>}
                {r.hora_fim_descarga && <div><span className="text-muted-foreground">Fim:</span> <span className="text-foreground">{formatTime(r.hora_fim_descarga)}</span></div>}
                <div><span className="text-muted-foreground">Resp:</span> <span className="text-foreground">{r.usuario_responsavel}</span></div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {r.status === "CHEGOU" && (
                  <Button size="sm" onClick={() => acoplar(r.id, r)} className="bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30">
                    <Link className="mr-2 h-4 w-4" /> Acoplar
                  </Button>
                )}
                {r.status === "ACOPLADO" && (
                  <Button size="sm" onClick={() => openVerificacao(r)} className="bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30">
                    <ClipboardCheck className="mr-2 h-4 w-4" /> Verificar NFs e Iniciar Descarga
                  </Button>
                )}
                {r.status === "EM DESCARGA" && (
                  <Button size="sm" onClick={() => openFinalizarModal(r)} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30">
                    <CheckCircle className="mr-2 h-4 w-4" /> Finalizar Descarga
                  </Button>
                )}
                {r.status === "AGUARDANDO DESACOPLAGEM" && (
                  <Button size="sm" onClick={() => setDesacoplarModal(r)} className="bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30">
                    <Unlink className="mr-2 h-4 w-4" /> Desacoplar (Saída)
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* NF Verification modal */}
      <Dialog open={!!verificacaoModal} onOpenChange={(open) => !open && setVerificacaoModal(null)}>
        <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading neon-text">Verificação de NFs — Iniciar Descarga</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{verificacaoModal?.fornecedor}</p>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">NFs Agendadas — marque as que chegaram:</label>
              {nfVerifications.map((v, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg border border-border bg-secondary/30">
                  <Checkbox checked={v.arrived} onCheckedChange={(checked) => {
                    const updated = [...nfVerifications];
                    updated[i].arrived = !!checked;
                    setNfVerifications(updated);
                  }} />
                  <span className={`text-sm ${v.arrived ? "text-foreground" : "text-red-400 line-through"}`}>
                    NF {formatNF(v.nf)}
                  </span>
                  {!v.arrived && <span className="text-xs text-red-400">Não chegou</span>}
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">NFs extras (não agendadas):</label>
              {extraNFs.map((nf, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
                  <span className="text-sm text-yellow-400">NF {formatNF(nf)} (sem agendamento)</span>
                  <Button size="sm" variant="ghost" onClick={() => setExtraNFs(extraNFs.filter((_, idx) => idx !== i))} className="text-destructive ml-auto">
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input placeholder="Número NF extra" inputMode="numeric" value={newExtraNF} onChange={e => setNewExtraNF(e.target.value)} className="bg-secondary" />
                <Button size="sm" variant="outline" onClick={() => { if (newExtraNF.trim()) { setExtraNFs([...extraNFs, newExtraNF.trim()]); setNewExtraNF(""); } }} className="border-yellow-500/50 text-yellow-400">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Button onClick={confirmarVerificacao} className="w-full bg-orange-600 text-white hover:bg-orange-700">
              <Play className="mr-2 h-4 w-4" /> Confirmar e Iniciar Descarga
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Finalizar modal */}
      <Dialog open={!!finalizarModal} onOpenChange={(open) => !open && setFinalizarModal(null)}>
        <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading neon-text">Finalizar Descarga</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">NF {finalizarModal?.numero_nf} — {finalizarModal?.fornecedor}</p>
            <div>
              <label className="text-sm text-muted-foreground">Observações</label>
              <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} className="bg-secondary mt-1" placeholder="Ex: Shelf life, mercadoria danificada..." rows={3} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">NFD (Nota Fiscal de Devolução)</label>
              <Input value={nfdNumero} onChange={e => setNfdNumero(e.target.value)} className="bg-secondary mt-1" placeholder="Número da NFD (se houver)" inputMode="numeric" />
            </div>

            {/* Já armazenado? */}
            <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
              <Checkbox id="ja-armazenado" checked={jaArmazenado} onCheckedChange={(checked) => setJaArmazenado(!!checked)} />
              <label htmlFor="ja-armazenado" className="text-sm text-emerald-400 cursor-pointer font-medium">
                Mercadoria já foi armazenada durante a descarga
              </label>
            </div>

            <p className="text-xs text-muted-foreground italic">Os campos de cobrança abaixo são opcionais.</p>
            <div>
              <label className="text-sm text-muted-foreground">Tipo de Descarga</label>
              <Select value={tipoDescarga} onValueChange={setTipoDescarga}>
                <SelectTrigger className="bg-secondary mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Sem cobrança</SelectItem>
                  <SelectItem value="caixa">Por Caixa</SelectItem>
                  <SelectItem value="pallet">Por Pallet</SelectItem>
                  <SelectItem value="tonelada">Por Peso (Tonelada)</SelectItem>
                  <SelectItem value="misto">Misto (Caixa + Pallet)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(tipoDescarga === "caixa" || tipoDescarga === "misto") && (
              <div>
                <label className="text-sm text-muted-foreground">Caixas Batidas</label>
                <Input type="text" inputMode="numeric" value={caixasBatidas} onChange={e => setCaixasBatidas(e.target.value)} className="bg-secondary mt-1" placeholder="0" />
                <p className="text-xs text-muted-foreground mt-1">Valor unitário: R$ {valoresConfig.valor_por_caixa.toFixed(2)}</p>
              </div>
            )}
            {(tipoDescarga === "pallet" || tipoDescarga === "misto") && (
              <div>
                <label className="text-sm text-muted-foreground">Pallets Descarregados</label>
                <Input type="text" inputMode="numeric" value={palletsDescarregados} onChange={e => setPalletsDescarregados(e.target.value)} className="bg-secondary mt-1" placeholder="0" />
                <p className="text-xs text-muted-foreground mt-1">Valor unitário: R$ {valoresConfig.valor_por_pallet.toFixed(2)}</p>
              </div>
            )}
            {tipoDescarga === "tonelada" && (
              <div>
                <label className="text-sm text-muted-foreground">Toneladas</label>
                <Input type="text" inputMode="decimal" value={toneladas} onChange={e => setToneladas(e.target.value)} className="bg-secondary mt-1" placeholder="0.00" />
                <p className="text-xs text-muted-foreground mt-1">Valor unitário: R$ {valoresConfig.valor_por_tonelada.toFixed(2)}</p>
              </div>
            )}
            {tipoDescarga !== "nenhum" && (
              <div className="p-3 rounded-lg border border-primary/30 bg-primary/10">
                <p className="text-sm text-muted-foreground">Valor Total Cobrado:</p>
                <p className="font-heading text-2xl text-primary">R$ {calcValorTotal().toFixed(2)}</p>
              </div>
            )}
            <Button onClick={finalizarDescarga} className="w-full bg-primary text-primary-foreground hover:bg-primary/80">
              <CheckCircle className="mr-2 h-4 w-4" /> Confirmar Finalização
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Desacoplar modal */}
      <Dialog open={!!desacoplarModal} onOpenChange={(open) => !open && setDesacoplarModal(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="font-heading neon-text">Desacoplar — Saída do Caminhão</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">NF {desacoplarModal?.numero_nf} — {desacoplarModal?.fornecedor}</p>
            {desacoplarModal?.valor_cobrado > 0 && (
              <div className="p-3 rounded-lg border border-primary/30 bg-primary/10">
                <p className="text-sm text-muted-foreground">Valor cobrado:</p>
                <p className="font-heading text-xl text-primary">R$ {Number(desacoplarModal?.valor_cobrado).toFixed(2)}</p>
              </div>
            )}
            {desacoplarModal?.observacoes && (
              <div className="p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10">
                <p className="text-sm text-muted-foreground">Observações:</p>
                <p className="text-sm text-foreground">{desacoplarModal.observacoes}</p>
              </div>
            )}
            {desacoplarModal?.nfd_numero && (
              <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10">
                <p className="text-sm text-muted-foreground">NFD:</p>
                <p className="text-sm text-foreground">{desacoplarModal.nfd_numero}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Confirme que as notas e pagamento foram verificados antes de liberar o caminhão.</p>
            <Button onClick={desacoplar} className="w-full bg-purple-600 text-white hover:bg-purple-700">
              <Unlink className="mr-2 h-4 w-4" /> Confirmar Saída do Caminhão
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DescargaPage;
