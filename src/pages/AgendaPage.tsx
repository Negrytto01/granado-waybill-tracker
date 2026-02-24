import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getStatusClass, parseXML, formatDate, formatTime } from "@/lib/helpers";
import { Plus, Upload, Truck } from "lucide-react";

const AgendaPage = () => {
  const { profile } = useAuth();
  const [recebimentos, setRecebimentos] = useState<any[]>([]);
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({ numero_nf: "", fornecedor: "", cnpj: "", transportadora: "", placa: "", motorista: "", quantidade_volumes: 0, data_prevista: new Date().toISOString().split("T")[0] });
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    const { data } = await supabase.from("recebimentos").select("*").order("data_prevista", { ascending: true }).order("data_criacao", { ascending: false });
    setRecebimentos(data || []);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    if (!form.numero_nf || !form.fornecedor) { toast.error("NF e Fornecedor obrigatórios"); return; }
    const { error } = await supabase.from("recebimentos").insert([{
      ...form,
      quantidade_volumes: Number(form.quantidade_volumes),
      usuario_responsavel: profile?.nome,
      status: "AGENDADO" as any,
    }]);
    if (error) { toast.error(error.message); return; }
    toast.success("Recebimento agendado!");
    setOpenNew(false);
    setForm({ numero_nf: "", fornecedor: "", cnpj: "", transportadora: "", placa: "", motorista: "", quantidade_volumes: 0, data_prevista: new Date().toISOString().split("T")[0] });
    fetchData();
  };

  const handleXML = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = parseXML(text);
      const totalItens = parsed.itens.reduce((a, b) => a + b.quantidade, 0);
      const { error } = await supabase.from("recebimentos").insert([{
        numero_nf: parsed.numero_nf,
        fornecedor: parsed.fornecedor,
        cnpj: parsed.cnpj,
        quantidade_itens: Math.round(totalItens),
        xml_nota: text,
        usuario_responsavel: profile?.nome,
        status: "AGENDADO" as any,
        data_prevista: new Date().toISOString().split("T")[0],
      }]);
      if (error) { toast.error(error.message); return; }
      toast.success(`NF ${parsed.numero_nf} importada!`);
      fetchData();
    } catch {
      toast.error("Erro ao processar XML");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleChegou = async (id: string) => {
    await supabase.from("recebimentos").update({
      status: "CHEGOU" as any,
      hora_chegada: new Date().toISOString(),
      usuario_responsavel: profile?.nome,
    }).eq("id", id);
    toast.success("Chegada registrada!");
    fetchData();
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
          <input ref={fileRef} type="file" accept=".xml" className="hidden" onChange={handleXML} />
          <Button variant="outline" onClick={() => fileRef.current?.click()} className="border-primary/50 text-primary hover:bg-primary/10">
            <Upload className="mr-2 h-4 w-4" /> Importar XML
          </Button>
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/80">
                <Plus className="mr-2 h-4 w-4" /> Nova NF
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle className="font-heading neon-text">Novo Recebimento</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Número NF *" value={form.numero_nf} onChange={e => setForm({...form, numero_nf: e.target.value})} className="bg-secondary" />
                <Input placeholder="Fornecedor *" value={form.fornecedor} onChange={e => setForm({...form, fornecedor: e.target.value})} className="bg-secondary" />
                <Input placeholder="CNPJ" value={form.cnpj} onChange={e => setForm({...form, cnpj: e.target.value})} className="bg-secondary" />
                <Input placeholder="Transportadora" value={form.transportadora} onChange={e => setForm({...form, transportadora: e.target.value})} className="bg-secondary" />
                <Input placeholder="Placa" value={form.placa} onChange={e => setForm({...form, placa: e.target.value})} className="bg-secondary" />
                <Input placeholder="Motorista" value={form.motorista} onChange={e => setForm({...form, motorista: e.target.value})} className="bg-secondary" />
                <Input type="number" placeholder="Qtd Volumes" value={form.quantidade_volumes} onChange={e => setForm({...form, quantidade_volumes: Number(e.target.value)})} className="bg-secondary" />
                <Input type="date" value={form.data_prevista} onChange={e => setForm({...form, data_prevista: e.target.value})} className="bg-secondary" />
                <Button onClick={handleCreate} className="w-full bg-primary text-primary-foreground hover:bg-primary/80">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

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
                  </div>
                  <p className="text-sm text-muted-foreground">{r.fornecedor} {r.transportadora ? `· ${r.transportadora}` : ""}</p>
                  <p className="text-xs text-muted-foreground">Previsto: {formatDate(r.data_prevista)} {r.hora_chegada ? `· Chegou: ${formatTime(r.hora_chegada)}` : ""}</p>
                </div>
                {r.status === "AGENDADO" && (
                  <Button size="sm" onClick={() => handleChegou(r.id)} className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30">
                    <Truck className="mr-2 h-4 w-4" /> Caminhão Chegou
                  </Button>
                )}
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
