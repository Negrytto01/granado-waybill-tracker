import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getStatusClass, parseXML, formatDate, formatTime } from "@/lib/helpers";
import { useRealtime } from "@/hooks/useRealtime";
import { playTruckArrival } from "@/lib/sounds";
import { Plus, Truck, Trash2, Edit, X } from "lucide-react";

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
  const [fornecedor, setFornecedor] = useState("");
  const [dataPrevista, setDataPrevista] = useState(new Date().toISOString().split("T")[0]);
  const [horarioAgenda, setHorarioAgenda] = useState("");
  const [nfEntries, setNfEntries] = useState<NFEntry[]>([{ numero_nf: "", quantidade_volumes: 0, is_pallet: false }]);
  const [editForm, setEditForm] = useState({ numero_nf: "", fornecedor: "", quantidade_volumes: 0, data_prevista: "", horario_agenda: "", is_pallet: false });
  const isAdmin = profile?.cargo === "Master";

  const fetchData = useCallback(async () => {
    const { data } = await supabase.from("recebimentos").select("*").order("data_prevista", { ascending: true }).order("data_criacao", { ascending: false });
    setRecebimentos(data || []);
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
    setNfEntries([{ numero_nf: "", quantidade_volumes: 0, is_pallet: false }]);
  };

  const addNfEntry = () => setNfEntries([...nfEntries, { numero_nf: "", quantidade_volumes: 0, is_pallet: false }]);
  const removeNfEntry = (i: number) => setNfEntries(nfEntries.filter((_, idx) => idx !== i));
  const updateNfEntry = (i: number, field: keyof NFEntry, value: string | number | boolean) => {
    const updated = [...nfEntries];
    (updated[i] as any)[field] = value;
    setNfEntries(updated);
  };

  const handleCreate = async () => {
    const validNFs = nfEntries.filter(nf => nf.numero_nf.trim());
    if (validNFs.length === 0) {
      validNFs.push({ numero_nf: "S/N", quantidade_volumes: 0, is_pallet: false });
    }

    // Consolidate: concatenate NFs, sum non-pallet volumes
    const concatenatedNFs = validNFs.map(nf => nf.numero_nf).join("/");
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
    }]);
    if (error) { toast.error(error.message); return; }
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


  const handleChegou = async (id: string) => {
    await supabase.from("recebimentos").update({
      status: "CHEGOU" as any,
      hora_chegada: new Date().toISOString(),
      usuario_responsavel: profile?.nome,
    }).eq("id", id);
    playTruckArrival();
    toast.success("Chegada registrada!");
  };

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const groups = [
    { label: "Atrasados", items: recebimentos.filter(r => r.data_prevista < today && !["FINALIZADO"].includes(r.status)) },
    { label: "Hoje", items: recebimentos.filter(r => r.data_prevista === today) },
    { label: "Amanhã", items: recebimentos.filter(r => r.data_prevista === tomorrow) },
    { label: "Próximos", items: recebimentos.filter(r => r.data_prevista > tomorrow) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-heading text-3xl neon-text">Agenda de Recebimento</h1>
        <div className="flex gap-2">
          <Dialog open={openNew} onOpenChange={(open) => { setOpenNew(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/80">
                <Plus className="mr-2 h-4 w-4" /> Nova NF
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-heading neon-text">Novo Recebimento</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Fornecedor" value={fornecedor} onChange={e => setFornecedor(e.target.value)} className="bg-secondary" />
                <div>
                  <label className="text-xs text-muted-foreground">Data da Agenda</label>
                  <Input type="date" value={dataPrevista} onChange={e => setDataPrevista(e.target.value)} className="bg-secondary mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Horário da Agenda</label>
                  <Input type="time" value={horarioAgenda} onChange={e => setHorarioAgenda(e.target.value)} className="bg-secondary mt-1" />
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
                          <Checkbox
                            id={`pallet-${i}`}
                            checked={nf.is_pallet}
                            onCheckedChange={(checked) => updateNfEntry(i, "is_pallet", !!checked)}
                          />
                          <label htmlFor={`pallet-${i}`} className="text-xs text-muted-foreground cursor-pointer">
                            NF de Pallet (não contabiliza volumes/armazenagem)
                          </label>
                        </div>
                      </div>
                      {nfEntries.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeNfEntry(i)} className="text-destructive mt-1">
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {nfEntries.length > 1 && (
                    <div className="p-2 rounded border border-primary/20 bg-primary/5 text-xs text-muted-foreground">
                      <strong>Resumo:</strong> NFs {nfEntries.filter(n => n.numero_nf.trim()).map(n => n.numero_nf).join("/") || "S/N"} — Total Volumes: {nfEntries.filter(n => !n.is_pallet).reduce((s, n) => s + Number(n.quantidade_volumes), 0)}
                    </div>
                  )}
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
            <div className="flex items-center gap-2 py-1">
              <Checkbox
                id="edit-pallet"
                checked={editForm.is_pallet}
                onCheckedChange={(checked) => setEditForm({...editForm, is_pallet: !!checked})}
              />
              <label htmlFor="edit-pallet" className="text-xs text-muted-foreground cursor-pointer">
                NF de Pallet (não contabiliza volumes/armazenagem)
              </label>
            </div>
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

      {groups.map(group => group.items.length > 0 && (
        <div key={group.label} className="space-y-3">
          <h2 className="font-heading text-lg text-foreground border-b border-border pb-1">{group.label}</h2>
          <div className="space-y-2">
            {group.items.map(r => (
              <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-border bg-card/60 backdrop-blur-sm">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-heading text-lg text-foreground">NF {r.numero_nf}</span>
                    <span className={`status-badge ${getStatusClass(r.status)}`}>{r.status}</span>
                    {r.is_pallet && <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">PALLET</span>}
                  </div>
                  <p className="text-sm text-muted-foreground">{r.fornecedor}</p>
                  <p className="text-xs text-muted-foreground">
                    Previsto: {formatDate(r.data_prevista)}
                    {r.horario_agenda && ` às ${r.horario_agenda}`}
                    {r.hora_chegada && ` · Chegou: ${formatTime(r.hora_chegada)}`}
                  </p>
                  {!r.is_pallet && <p className="text-xs text-muted-foreground">Volumes: {r.quantidade_volumes || 0} caixas</p>}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {r.status === "AGENDADO" && (
                    <Button size="sm" onClick={() => handleChegou(r.id)} className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30">
                      <Truck className="mr-2 h-4 w-4" /> Caminhão Chegou
                    </Button>
                  )}
                  {isAdmin && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(r)} className="text-muted-foreground hover:text-foreground">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(r.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
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
