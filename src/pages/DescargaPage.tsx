import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getStatusClass, formatTime, calcDuration } from "@/lib/helpers";
import { useRealtime } from "@/hooks/useRealtime";
import { playDescargaFinalizada } from "@/lib/sounds";
import { Play, Truck, Link, Unlink, CheckCircle } from "lucide-react";

const DescargaPage = () => {
  const { profile } = useAuth();
  const [recebimentos, setRecebimentos] = useState<any[]>([]);
  const [finalizarModal, setFinalizarModal] = useState<any>(null);
  const [caixasBatidas, setCaixasBatidas] = useState("");
  const [palletsDescarregados, setPalletsDescarregados] = useState("");
  const [toneladas, setToneladas] = useState("");
  const [tipoDescarga, setTipoDescarga] = useState("nenhum");
  const [valoresConfig, setValoresConfig] = useState({ valor_por_caixa: 0, valor_por_pallet: 0, valor_por_tonelada: 0 });
  const isAdmin = profile?.cargo === "Master";

  const fetchData = useCallback(async () => {
    const { data } = await supabase.from("recebimentos").select("*")
      .in("status", ["CHEGOU", "ACOPLADO", "DESACOPLADO", "EM DESCARGA"])
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

  const acoplar = async (id: string) => {
    await supabase.from("recebimentos").update({ status: "ACOPLADO" as any, hora_acoplagem: new Date().toISOString(), usuario_responsavel: profile?.nome }).eq("id", id);
    toast.success("Caminhão acoplado!");
  };

  const desacoplar = async (id: string) => {
    await supabase.from("recebimentos").update({ status: "DESACOPLADO" as any, hora_desacoplagem: new Date().toISOString() }).eq("id", id);
    toast.success("Caminhão desacoplado!");
  };

  const iniciarDescarga = async (id: string) => {
    await supabase.from("recebimentos").update({ status: "EM DESCARGA" as any, hora_inicio_descarga: new Date().toISOString(), usuario_responsavel: profile?.nome }).eq("id", id);
    toast.success("Descarga iniciada!");
  };

  const openFinalizarModal = (r: any) => {
    setFinalizarModal(r);
    setCaixasBatidas("");
    setPalletsDescarregados("");
    setToneladas("");
    setTipoDescarga("nenhum");
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

    const now = new Date().toISOString();
    await supabase.from("recebimentos").update({
      status: "AGUARDANDO ARMAZENAGEM" as any,
      hora_fim_descarga: now,
      caixas_batidas: caixas,
      pallets_descarregados: pallets,
      toneladas: ton,
      tipo_descarga: tipoDescarga,
      valor_cobrado: valorTotal,
    }).eq("id", finalizarModal.id);

    await supabase.from("armazenagem").insert([{
      recebimento_id: finalizarModal.id,
      quantidade_itens: finalizarModal.quantidade_itens || 0,
      quantidade_volumes: finalizarModal.quantidade_volumes || 0,
      status: "AGUARDANDO ARMAZENAGEM" as any,
      usuario_responsavel: profile?.nome,
    }]);

    if (valorTotal > 0) {
      await supabase.from("fluxo_financeiro").insert([{
        tipo: "ENTRADA",
        descricao: `Descarga NF ${finalizarModal.numero_nf} - ${finalizarModal.fornecedor}`,
        valor: valorTotal,
        recebimento_id: finalizarModal.id,
        criado_por: "Sistema",
      }]);
    }

    playDescargaFinalizada();
    toast.success(valorTotal > 0 ? `Descarga finalizada! Valor: R$ ${valorTotal.toFixed(2)}` : "Descarga finalizada!");
    setFinalizarModal(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este recebimento?")) return;
    await supabase.from("recebimentos").delete().eq("id", id);
    toast.success("Removido!");
  };

  const getNextAction = (status: string) => {
    switch (status) {
      case "CHEGOU": return { label: "Acoplar", icon: Link, action: acoplar, color: "bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30" };
      case "ACOPLADO": return { label: "Desacoplar", icon: Unlink, action: desacoplar, color: "bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30" };
      case "DESACOPLADO": return { label: "Iniciar Descarga", icon: Play, action: iniciarDescarga, color: "bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30" };
      default: return null;
    }
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
          {recebimentos.map(r => {
            const nextAction = getNextAction(r.status);
            return (
              <div key={r.id} className="p-4 rounded-lg border border-border bg-card/60 backdrop-blur-sm space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading text-lg text-foreground">NF {r.numero_nf}</span>
                      <span className={`status-badge ${getStatusClass(r.status)}`}>{r.status}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{r.fornecedor}</p>
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)} className="text-destructive hover:text-destructive">Remover</Button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Chegada:</span> <span className="text-foreground">{formatTime(r.hora_chegada)}</span></div>
                  {r.hora_acoplagem && <div><span className="text-muted-foreground">Acoplou:</span> <span className="text-foreground">{formatTime(r.hora_acoplagem)}</span></div>}
                  {r.hora_desacoplagem && <div><span className="text-muted-foreground">Desacoplou:</span> <span className="text-foreground">{formatTime(r.hora_desacoplagem)}</span></div>}
                  {r.hora_inicio_descarga && <div><span className="text-muted-foreground">Início:</span> <span className="text-foreground">{formatTime(r.hora_inicio_descarga)}</span></div>}
                  {r.status === "EM DESCARGA" && <div><span className="text-muted-foreground">Tempo:</span> <span className="text-primary animate-pulse">{calcDuration(r.hora_inicio_descarga, null)}</span></div>}
                  <div><span className="text-muted-foreground">Resp:</span> <span className="text-foreground">{r.usuario_responsavel}</span></div>
                </div>
                <div className="flex gap-2">
                  {nextAction && (
                    <Button size="sm" onClick={() => nextAction.action(r.id)} className={nextAction.color}>
                      <nextAction.icon className="mr-2 h-4 w-4" /> {nextAction.label}
                    </Button>
                  )}
                  {r.status === "EM DESCARGA" && (
                    <Button size="sm" onClick={() => openFinalizarModal(r)} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30">
                      <CheckCircle className="mr-2 h-4 w-4" /> Finalizar Descarga
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Finalizar modal - OPTIONAL fields */}
      <Dialog open={!!finalizarModal} onOpenChange={(open) => !open && setFinalizarModal(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="font-heading neon-text">Finalizar Descarga</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">NF {finalizarModal?.numero_nf} — {finalizarModal?.fornecedor}</p>
            <p className="text-xs text-muted-foreground italic">Os campos abaixo são opcionais. Preencha apenas se houve cobrança.</p>

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
                <Input type="number" value={caixasBatidas} onChange={e => setCaixasBatidas(e.target.value)} className="bg-secondary mt-1" placeholder="0" />
                <p className="text-xs text-muted-foreground mt-1">Valor unitário: R$ {valoresConfig.valor_por_caixa.toFixed(2)}</p>
              </div>
            )}

            {(tipoDescarga === "pallet" || tipoDescarga === "misto") && (
              <div>
                <label className="text-sm text-muted-foreground">Pallets Descarregados</label>
                <Input type="number" value={palletsDescarregados} onChange={e => setPalletsDescarregados(e.target.value)} className="bg-secondary mt-1" placeholder="0" />
                <p className="text-xs text-muted-foreground mt-1">Valor unitário: R$ {valoresConfig.valor_por_pallet.toFixed(2)}</p>
              </div>
            )}

            {tipoDescarga === "tonelada" && (
              <div>
                <label className="text-sm text-muted-foreground">Toneladas</label>
                <Input type="number" step="0.01" value={toneladas} onChange={e => setToneladas(e.target.value)} className="bg-secondary mt-1" placeholder="0.00" />
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
    </div>
  );
};

export default DescargaPage;
