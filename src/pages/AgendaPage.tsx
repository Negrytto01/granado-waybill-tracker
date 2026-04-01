import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getStatusClass, formatDate, formatTime, formatNF } from "@/lib/helpers";
import { useRealtime } from "@/hooks/useRealtime";
import { playTruckArrival } from "@/lib/sounds";
import { Plus, Truck, Trash2, Edit, X, PackagePlus, Ban, Zap } from "lucide-react";

interface NFEntry {
  numero_nf: string;
  quantidade_volumes: number;
  is_pallet: boolean;
}

const AgendaPage = () => {
  const { profile } = useAuth();
  const [recebimentos, setRecebimentos] = useState<any[]>([]);
  const [openNew, setOpenNew] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [addNfModal, setAddNfModal] = useState<any>(null);
  const [addNfType, setAddNfType] = useState<"pallet" | "regular">("pallet");
  const [newNfNumber, setNewNfNumber] = useState("");
  const [newNfVolumes, setNewNfVolumes] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [dataPrevista, setDataPrevista] = useState(new Date().toISOString().split("T")[0]);
  const [horarioAgenda, setHorarioAgenda] = useState("");
  const [isRetirada, setIsRetirada] = useState(false);
  const [isMarketing, setIsMarketing] = useState(false);
  const [isEncaixe, setIsEncaixe] = useState(false);
  const [nfEntries, setNfEntries] = useState<NFEntry[]>([{ numero_nf: "", quantidade_volumes: 0, is_pallet: false }]);
  const [editForm, setEditForm] = useState({ numero_nf: "", fornecedor: "", quantidade_volumes: 0, data_prevista: "", horario_agenda: "", is_pallet: false });
  const [naoVeioModal, setNaoVeioModal] = useState<any>(null);
  const [naoVeioObs, setNaoVeioObs] = useState("");
  const [valoresConfig, setValoresConfig] = useState({ valor_multa: 0 });
  const isAdmin = profile?.cargo === "Master";

  const fetchData = useCallback(async () => {
    const { data } = await supabase.from("recebimentos").select("*").order("data_prevista", { ascending: true }).order("data_criacao", { ascending: false });
    setRecebimentos(data || []);
    const { data: val } = await supabase.from("valores_descarga").select("valor_multa").limit(1);
    if (val && val.length > 0) setValoresConfig({ valor_multa: Number((val[0] as any).valor_multa || 0) });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useRealtime("recebimentos", fetchData, {
    onUpdate: (newRec: any) => {
      if (newRec.status === "CHEGOU") {
        playTruckArrival();
        toast.info(`🚛 Caminhão chegou! NF ${newRec.numero_nf}`);
      }
    }
  });

  const resetForm = () => {
    setFornecedor("");
    setDataPrevista(new Date().toISOString().split("T")[0]);
    setHorarioAgenda("");
    setIsRetirada(false);
    setIsMarketing(false);
    setIsEncaixe(false);
    setNfEntries([{ numero_nf: "", quantidade_volumes: 0, is_pallet: false }]);
  };

  const addNfEntry = () => setNfEntries([...nfEntries, { numero_nf: "", quantidade_volumes: 0, is_pallet: false }]);
  const removeNfEntry = (i: number) => setNfEntries(nfEntries.filter((_, idx) => idx !== i));
  const updateNfEntry = (i: number, field: keyof NFEntry, value: string | number | boolean) => {
    const updated = [...nfEntries];
    (updated[i] as any)[field] = value;
    setNfEntries(updated);
  };

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

  const handleCreate = async () => {
    const validNFs = nfEntries.filter(nf => nf.numero_nf.trim());
    if (validNFs.length === 0) {
      validNFs.push({ numero_nf: "S/N", quantidade_volumes: 0, is_pallet: false });
    }
    const concatenatedNFs = validNFs.map(nf => nf.numero_nf).join(" / ");
    const totalVolumes = validNFs.filter(nf => !nf.is_pallet).reduce((sum, nf) => sum + Number(nf.quantidade_volumes), 0);
    const hasPallet = validNFs.some(nf => nf.is_pallet);

    const { error } = await supabase.from("recebimentos").insert([{
      numero_nf: concatenatedNFs,
      fornecedor: fornecedor || "Não informado",
      quantidade_volumes: totalVolumes,
      data_prevista: dataPrevista,
      horario_agenda: horarioAgenda || null,
      usuario_responsavel: profile?.nome,
      status: "AGENDADO" as any,
      is_pallet: hasPallet,
      is_retirada: isRetirada,
      is_marketing: isMarketing,
      is_encaixe: isEncaixe,
    }] as any);
    if (error) { toast.error(error.message); return; }
    await logActivity("Agendamento criado", `${fornecedor} - NF ${concatenatedNFs}${isEncaixe ? " (ENCAIXE)" : ""}`);
    toast.success("Agendamento salvo!");
    setOpenNew(false);
    resetForm();
  };

  const handleEdit = async () => {
    if (!editItem) return;
    const { error } = await supabase.from("recebimentos").update({
      numero_nf: editForm.numero_nf,
      fornecedor: editForm.fornecedor,
      quantidade_volumes: Number(editForm.quantidade_volumes),
      data_prevista: editForm.data_prevista,
      horario_agenda: editForm.horario_agenda || null,
      is_pallet: editForm.is_pallet,
    }).eq("id", editItem.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Atualizado!");
    setEditItem(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover?")) return;
    const { error } = await supabase.from("recebimentos").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Removido!");
  };

  const openEdit = (r: any) => {
    setEditForm({
      numero_nf: r.numero_nf,
      fornecedor: r.fornecedor,
      quantidade_volumes: r.quantidade_volumes || 0,
      data_prevista: r.data_prevista || new Date().toISOString().split("T")[0],
      horario_agenda: r.horario_agenda || "",
      is_pallet: r.is_pallet || false,
    });
    setEditItem(r);
  };

  const handleAddNf = async () => {
    if (!addNfModal || !newNfNumber.trim()) { toast.error("Informe o número da NF"); return; }
    const currentNFs = addNfModal.numero_nf;
    const updatedNFs = currentNFs ? `${currentNFs} / ${newNfNumber.trim()}` : newNfNumber.trim();
    const volumes = addNfType === "pallet" ? addNfModal.quantidade_volumes : (addNfModal.quantidade_volumes || 0) + (parseInt(newNfVolumes) || 0);

    const { error } = await supabase.from("recebimentos").update({
      numero_nf: updatedNFs,
      quantidade_volumes: volumes,
      is_pallet: addNfType === "pallet" ? true : addNfModal.is_pallet,
    }).eq("id", addNfModal.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`NF ${addNfType === "pallet" ? "de Pallet" : ""} adicionada!`);
    setAddNfModal(null);
    setNewNfNumber("");
    setNewNfVolumes("");
  };

  const handleChegou = async (r: any) => {
    if (r.is_retirada || r.is_marketing) {
      // Retirada or Marketing: skip acoplagem, go direct to armazenagem
      await supabase.from("recebimentos").update({
        status: "AGUARDANDO ARMAZENAGEM" as any,
        hora_chegada: new Date().toISOString(),
        usuario_responsavel: profile?.nome,
      }).eq("id", r.id);
      await supabase.from("armazenagem").insert([{
        recebimento_id: r.id,
        quantidade_itens: r.quantidade_itens || 0,
        quantidade_volumes: r.quantidade_volumes || 0,
        status: "AGUARDANDO ARMAZENAGEM" as any,
      }]);
      const label = r.is_retirada ? "Retirada" : "Marketing";
      await logActivity(`${label} registrada`, `${r.fornecedor}`);
      toast.success(`${label} registrada! Enviado para armazenagem.`);
    } else {
      await supabase.from("recebimentos").update({
        status: "CHEGOU" as any,
        hora_chegada: new Date().toISOString(),
        usuario_responsavel: profile?.nome,
      }).eq("id", r.id);
      await logActivity("Caminhão chegou", `${r.fornecedor}`);
      playTruckArrival();
      toast.success("Chegada registrada!");
    }
  };

  const handleNaoVeio = async () => {
    if (!naoVeioModal) return;
    const avisouAntecedencia = false;

    await supabase.from("recebimentos").update({
      status: "NAO_VEIO" as any,
      observacoes: naoVeioObs ? `Não veio: ${naoVeioObs}` : "Fornecedor não compareceu",
    }).eq("id", naoVeioModal.id);

    await supabase.from("fornecedores_nao_vieram").insert([{
      recebimento_id: naoVeioModal.id,
      fornecedor: naoVeioModal.fornecedor,
      motivo: "Não veio",
      observacoes: naoVeioObs || null,
      usuario: profile?.nome,
      multa: valoresConfig.valor_multa,
      avisou_antecedencia: avisouAntecedencia,
    }] as any);

    await logActivity("Fornecedor não veio", `${naoVeioModal.fornecedor}`);
    toast.success("Registrado como não compareceu!");
    setNaoVeioModal(null);
    setNaoVeioObs("");
  };

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const groups = [
    { label: "Atrasados", items: recebimentos.filter(r => r.data_prevista < today && !["FINALIZADO", "NAO_VEIO"].includes(r.status)) },
    { label: "Hoje", items: recebimentos.filter(r => r.data_prevista === today) },
    { label: "Amanhã", items: recebimentos.filter(r => r.data_prevista === tomorrow) },
    { label: "Próximos", items: recebimentos.filter(r => r.data_prevista > tomorrow) },
  ];

  const renderNFs = (nf: string) => {
    if (nf.includes("/")) {
      return (
        <span className="flex flex-wrap gap-1.5 items-center">
          {nf.split(/\s*\/\s*/).map((n: string, i: number) => (
            <span key={i} className="inline-block px-2 py-0.5 rounded bg-secondary text-sm">
              NF {formatNF(n.trim())}
            </span>
          ))}
        </span>
      );
    }
    return <>NF {formatNF(nf)}</>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-heading text-3xl neon-text">Agenda de Recebimento</h1>
        <div className="flex gap-2">
          {/* Encaixe button */}
          <Button variant="outline" onClick={() => { setOpenNew(true); setIsEncaixe(true); }} className="border-orange-500/50 text-orange-400">
            <Zap className="mr-2 h-4 w-4" /> Encaixe
          </Button>
          <Dialog open={openNew} onOpenChange={(open) => { setOpenNew(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/80">
                <Plus className="mr-2 h-4 w-4" /> Nova NF
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-heading neon-text">{isEncaixe ? "Encaixe (Sem Agenda)" : "Novo Recebimento"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Fornecedor" value={fornecedor} onChange={e => setFornecedor(e.target.value)} className="bg-secondary" />
                {!isEncaixe && (
                  <>
                    <div>
                      <label className="text-xs text-muted-foreground">Data da Agenda</label>
                      <Input type="date" value={dataPrevista} onChange={e => setDataPrevista(e.target.value)} className="bg-secondary mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Horário da Agenda</label>
                      <Input type="time" value={horarioAgenda} onChange={e => setHorarioAgenda(e.target.value)} className="bg-secondary mt-1" />
                    </div>
                  </>
                )}

                {isEncaixe && (
                  <div className="p-3 rounded-lg border border-orange-500/30 bg-orange-500/5">
                    <p className="text-sm text-orange-400 font-medium">⚡ Encaixe — Fornecedor veio sem agendamento prévio</p>
                    <p className="text-xs text-muted-foreground mt-1">O tempo será contabilizado desde a chegada até a saída</p>
                  </div>
                )}

                <div className="flex items-center gap-2 p-3 rounded-lg border border-cyan-500/30 bg-cyan-500/5">
                  <Checkbox id="retirada" checked={isRetirada} onCheckedChange={(checked) => { setIsRetirada(!!checked); if (checked) setIsMarketing(false); }} />
                  <label htmlFor="retirada" className="text-sm text-cyan-400 cursor-pointer font-medium">
                    Retirada Granado (pula descarga, vai direto para armazenagem)
                  </label>
                </div>

                <div className="flex items-center gap-2 p-3 rounded-lg border border-purple-500/30 bg-purple-500/5">
                  <Checkbox id="marketing" checked={isMarketing} onCheckedChange={(checked) => { setIsMarketing(!!checked); if (checked) setIsRetirada(false); }} />
                  <label htmlFor="marketing" className="text-sm text-purple-400 cursor-pointer font-medium">
                    NF de Marketing (pula acoplagem e conferência)
                  </label>
                </div>

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
                        <Input type="text" inputMode="numeric" placeholder="Qtd Volumes (Caixas)" value={nf.quantidade_volumes || ""} onChange={e => updateNfEntry(i, "quantidade_volumes", Number(e.target.value))} className="bg-secondary" />
                        <div className="flex items-center gap-2 py-1">
                          <Checkbox id={`pallet-${i}`} checked={nf.is_pallet} onCheckedChange={(checked) => updateNfEntry(i, "is_pallet", !!checked)} />
                          <label htmlFor={`pallet-${i}`} className="text-xs text-muted-foreground cursor-pointer">NF de Pallet</label>
                        </div>
                      </div>
                      {nfEntries.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeNfEntry(i)} className="text-destructive mt-1">
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <Button onClick={handleCreate} className="w-full bg-primary text-primary-foreground hover:bg-primary/80">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editItem} onOpenChange={(open) => { if (!open) setEditItem(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="font-heading neon-text">Editar Recebimento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Número NF" inputMode="numeric" value={editForm.numero_nf} onChange={e => setEditForm({...editForm, numero_nf: e.target.value})} className="bg-secondary" />
            <Input placeholder="Fornecedor" value={editForm.fornecedor} onChange={e => setEditForm({...editForm, fornecedor: e.target.value})} className="bg-secondary" />
            <Input type="text" inputMode="numeric" placeholder="Qtd Volumes (Caixas)" value={editForm.quantidade_volumes || ""} onChange={e => setEditForm({...editForm, quantidade_volumes: Number(e.target.value)})} className="bg-secondary" />
            <div>
              <label className="text-xs text-muted-foreground">Data da Agenda</label>
              <Input type="date" value={editForm.data_prevista} onChange={e => setEditForm({...editForm, data_prevista: e.target.value})} className="bg-secondary mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Horário da Agenda</label>
              <Input type="time" value={editForm.horario_agenda} onChange={e => setEditForm({...editForm, horario_agenda: e.target.value})} className="bg-secondary mt-1" />
            </div>
            <Button onClick={handleEdit} className="w-full bg-primary text-primary-foreground hover:bg-primary/80">Atualizar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add NF dialog - Only Master can add after status changes */}
      <Dialog open={!!addNfModal} onOpenChange={(open) => { if (!open) { setAddNfModal(null); setNewNfNumber(""); setNewNfVolumes(""); } }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="font-heading neon-text">Adicionar NF</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{addNfModal?.fornecedor}</p>
            {isAdmin && (
              <div className="flex gap-2">
                <Button size="sm" variant={addNfType === "pallet" ? "default" : "outline"} onClick={() => setAddNfType("pallet")} className="flex-1">NF de Pallet</Button>
                <Button size="sm" variant={addNfType === "regular" ? "default" : "outline"} onClick={() => setAddNfType("regular")} className="flex-1">NF Regular</Button>
              </div>
            )}
            <Input placeholder="Número da NF" inputMode="numeric" value={newNfNumber} onChange={e => setNewNfNumber(e.target.value)} className="bg-secondary" />
            {addNfType === "regular" && (
              <Input type="text" inputMode="numeric" placeholder="Qtd Volumes" value={newNfVolumes} onChange={e => setNewNfVolumes(e.target.value)} className="bg-secondary" />
            )}
            <Button onClick={handleAddNf} className="w-full bg-primary text-primary-foreground hover:bg-primary/80">
              <PackagePlus className="mr-2 h-4 w-4" /> Adicionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Não Veio dialog */}
      <Dialog open={!!naoVeioModal} onOpenChange={(open) => { if (!open) { setNaoVeioModal(null); setNaoVeioObs(""); } }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="font-heading neon-text text-red-400">Fornecedor Não Veio</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Fornecedor: <strong className="text-foreground">{naoVeioModal?.fornecedor}</strong></p>
            {valoresConfig.valor_multa > 0 && (
              <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10">
                <p className="text-sm text-red-400">Multa: R$ {valoresConfig.valor_multa.toFixed(2)}</p>
              </div>
            )}
            <Textarea placeholder="Observação (ex: Não avisou, avisou com antecedência...)" value={naoVeioObs} onChange={e => setNaoVeioObs(e.target.value)} className="bg-secondary" rows={3} />
            <Button onClick={handleNaoVeio} className="w-full bg-red-600 text-white hover:bg-red-700">
              <Ban className="mr-2 h-4 w-4" /> Confirmar — Não Veio
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {groups.map(group => group.items.length > 0 && (
        <div key={group.label} className="space-y-3">
          <h2 className="font-heading text-lg text-foreground border-b border-border pb-1">{group.label}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {group.items.map(r => (
              <div key={r.id} className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm space-y-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-heading text-foreground">{renderNFs(r.numero_nf)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`status-badge ${getStatusClass(r.status)}`}>{r.status === "NAO_VEIO" ? "NÃO VEIO" : r.status}</span>
                    {r.is_pallet && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">PALLET</span>}
                    {r.is_retirada && <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">RETIRADA</span>}
                    {r.is_marketing && <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">MARKETING</span>}
                    {r.is_encaixe && <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">ENCAIXE</span>}
                  </div>
                  <p className="text-sm text-muted-foreground">{r.fornecedor}</p>
                  <p className="text-xs text-muted-foreground">
                    Previsto: {formatDate(r.data_prevista)}
                    {r.horario_agenda && ` às ${r.horario_agenda.substring(0, 5)}`}
                    {r.hora_chegada && ` · Chegou: ${formatTime(r.hora_chegada)}`}
                  </p>
                  {!r.is_pallet && <p className="text-xs text-muted-foreground">Volumes: {r.quantidade_volumes || 0} caixas</p>}
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {r.status === "AGENDADO" && (
                    <>
                      <Button size="sm" onClick={() => handleChegou(r)} className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30 text-xs">
                        <Truck className="mr-1 h-3 w-3" /> {r.is_retirada ? "Chegou" : r.is_marketing ? "Chegou (MKT)" : "Chegou"}
                      </Button>
                      <Button size="sm" onClick={() => setNaoVeioModal(r)} className="bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 text-xs">
                        <Ban className="mr-1 h-3 w-3" /> Não Veio
                      </Button>
                    </>
                  )}
                  {isAdmin && !["FINALIZADO", "NAO_VEIO"].includes(r.status) && (
                    <Button size="sm" variant="outline" onClick={() => { setAddNfModal(r); setAddNfType("pallet"); }} className="text-amber-400 border-amber-500/30 hover:bg-amber-500/10 text-xs">
                      <PackagePlus className="mr-1 h-3 w-3" /> NF
                    </Button>
                  )}
                  {isAdmin && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(r)} className="text-muted-foreground hover:text-foreground h-7 w-7 p-0">
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(r.id)} className="text-destructive hover:text-destructive h-7 w-7 p-0">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {recebimentos.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Truck className="mx-auto h-12 w-12 mb-3 opacity-30" />
          <p>Nenhum recebimento agendado</p>
        </div>
      )}
    </div>
  );
};

export default AgendaPage;
