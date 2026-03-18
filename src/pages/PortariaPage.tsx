import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/helpers";
import { Truck, Plus, Trash2, User, Car } from "lucide-react";

const PortariaPage = () => {
  const { profile } = useAuth();
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [motoristas, setMotoristas] = useState<any[]>([]);
  const [registros, setRegistros] = useState<any[]>([]);
  const [openVeiculo, setOpenVeiculo] = useState(false);
  const [openMotorista, setOpenMotorista] = useState(false);
  const [openLancar, setOpenLancar] = useState(false);
  const [veiculoForm, setVeiculoForm] = useState({ nome: "", placa: "", modelo: "" });
  const [motoristaForm, setMotoristaForm] = useState({ nome: "" });
  const [lancarForm, setLancarForm] = useState({ veiculo_id: "", motorista_id: "", km_chegada: "", tem_problema: false, observacoes_problema: "" });
  const isAdmin = profile?.cargo === "Master";

  const fetchData = useCallback(async () => {
    const [v, m, r] = await Promise.all([
      supabase.from("veiculos").select("*").order("nome"),
      supabase.from("motoristas").select("*").order("nome"),
      supabase.from("portaria_registros").select("*").order("data_criacao", { ascending: false }).limit(100),
    ]);
    setVeiculos((v.data as any[]) || []);
    setMotoristas((m.data as any[]) || []);
    setRegistros((r.data as any[]) || []);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const ch1 = supabase.channel("rt-veiculos").on("postgres_changes", { event: "*", schema: "public", table: "veiculos" }, () => fetchData()).subscribe();
    const ch2 = supabase.channel("rt-motoristas").on("postgres_changes", { event: "*", schema: "public", table: "motoristas" }, () => fetchData()).subscribe();
    const ch3 = supabase.channel("rt-portaria").on("postgres_changes", { event: "*", schema: "public", table: "portaria_registros" }, () => fetchData()).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); supabase.removeChannel(ch3); };
  }, [fetchData]);

  const handleAddVeiculo = async () => {
    if (!veiculoForm.nome || !veiculoForm.placa) { toast.error("Preencha nome e placa"); return; }
    const { error } = await supabase.from("veiculos").insert([veiculoForm] as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Veículo cadastrado!");
    setOpenVeiculo(false);
    setVeiculoForm({ nome: "", placa: "", modelo: "" });
  };

  const handleAddMotorista = async () => {
    if (!motoristaForm.nome) { toast.error("Preencha o nome"); return; }
    const { error } = await supabase.from("motoristas").insert([motoristaForm] as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Motorista cadastrado!");
    setOpenMotorista(false);
    setMotoristaForm({ nome: "" });
  };

  const handleLancar = async () => {
    if (!lancarForm.veiculo_id || !lancarForm.motorista_id) { toast.error("Selecione veículo e motorista"); return; }
    const veiculo = veiculos.find(v => v.id === lancarForm.veiculo_id);
    const motorista = motoristas.find(m => m.id === lancarForm.motorista_id);

    const { error } = await supabase.from("portaria_registros").insert([{
      veiculo_id: lancarForm.veiculo_id,
      motorista_id: lancarForm.motorista_id,
      veiculo_nome: veiculo?.nome,
      veiculo_placa: veiculo?.placa,
      motorista_nome: motorista?.nome,
      km_chegada: lancarForm.km_chegada || null,
      tem_problema: lancarForm.tem_problema,
      observacoes_problema: lancarForm.tem_problema ? lancarForm.observacoes_problema : null,
      registrado_por: profile?.nome,
    }] as any);
    if (error) { toast.error(error.message); return; }

    // Log activity
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (userId) {
      await supabase.from("atividades_usuarios").insert([{
        user_id: userId,
        usuario_nome: profile?.nome || "",
        acao: "Registro portaria",
        detalhes: `Veículo ${veiculo?.nome} (${veiculo?.placa}) - Motorista ${motorista?.nome}`,
      }] as any);
    }

    toast.success("Chegada registrada!");
    setOpenLancar(false);
    setLancarForm({ veiculo_id: "", motorista_id: "", km_chegada: "", tem_problema: false, observacoes_problema: "" });
  };

  const handleDeleteVeiculo = async (id: string) => {
    if (!confirm("Remover veículo?")) return;
    await supabase.from("veiculos").delete().eq("id", id);
    toast.success("Removido!");
  };

  const handleDeleteMotorista = async (id: string) => {
    if (!confirm("Remover motorista?")) return;
    await supabase.from("motoristas").delete().eq("id", id);
    toast.success("Removido!");
  };

  const handleDeleteRegistro = async (id: string) => {
    if (!confirm("Remover registro?")) return;
    await supabase.from("portaria_registros").delete().eq("id", id);
    toast.success("Removido!");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-heading text-3xl neon-text">Portaria</h1>
        <div className="flex gap-2 flex-wrap">
          {isAdmin && (
            <>
              <Dialog open={openVeiculo} onOpenChange={setOpenVeiculo}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-primary/50 text-primary">
                    <Car className="mr-2 h-4 w-4" /> Cadastrar Veículo
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader><DialogTitle className="font-heading neon-text">Cadastrar Veículo</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <Input placeholder="Nome *" value={veiculoForm.nome} onChange={e => setVeiculoForm({...veiculoForm, nome: e.target.value})} className="bg-secondary" />
                    <Input placeholder="Placa *" value={veiculoForm.placa} onChange={e => setVeiculoForm({...veiculoForm, placa: e.target.value})} className="bg-secondary" />
                    <Input placeholder="Modelo" value={veiculoForm.modelo} onChange={e => setVeiculoForm({...veiculoForm, modelo: e.target.value})} className="bg-secondary" />
                    <Button onClick={handleAddVeiculo} className="w-full bg-primary text-primary-foreground hover:bg-primary/80">Cadastrar</Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={openMotorista} onOpenChange={setOpenMotorista}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-primary/50 text-primary">
                    <User className="mr-2 h-4 w-4" /> Cadastrar Motorista
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader><DialogTitle className="font-heading neon-text">Cadastrar Motorista</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <Input placeholder="Nome *" value={motoristaForm.nome} onChange={e => setMotoristaForm({...motoristaForm, nome: e.target.value})} className="bg-secondary" />
                    <Button onClick={handleAddMotorista} className="w-full bg-primary text-primary-foreground hover:bg-primary/80">Cadastrar</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}

          <Dialog open={openLancar} onOpenChange={setOpenLancar}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/80">
                <Plus className="mr-2 h-4 w-4" /> Lançar Chegada
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-heading neon-text">Lançar Chegada</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">Veículo *</label>
                  <Select value={lancarForm.veiculo_id} onValueChange={v => setLancarForm({...lancarForm, veiculo_id: v})}>
                    <SelectTrigger className="bg-secondary mt-1"><SelectValue placeholder="Selecionar veículo" /></SelectTrigger>
                    <SelectContent>
                      {veiculos.map(v => <SelectItem key={v.id} value={v.id}>{v.nome} — {v.placa}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Motorista *</label>
                  <Select value={lancarForm.motorista_id} onValueChange={v => setLancarForm({...lancarForm, motorista_id: v})}>
                    <SelectTrigger className="bg-secondary mt-1"><SelectValue placeholder="Selecionar motorista" /></SelectTrigger>
                    <SelectContent>
                      {motoristas.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Input placeholder="KM Chegada" value={lancarForm.km_chegada} onChange={e => setLancarForm({...lancarForm, km_chegada: e.target.value})} className="bg-secondary" inputMode="numeric" />
                
                <div className="space-y-2">
                  <label className="text-sm text-foreground">O veículo apresenta algum problema?</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="problema" checked={lancarForm.tem_problema} onChange={() => setLancarForm({...lancarForm, tem_problema: true})} className="accent-primary" />
                      <span className="text-sm text-foreground">Sim</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="problema" checked={!lancarForm.tem_problema} onChange={() => setLancarForm({...lancarForm, tem_problema: false, observacoes_problema: ""})} className="accent-primary" />
                      <span className="text-sm text-foreground">Não</span>
                    </label>
                  </div>
                </div>

                {lancarForm.tem_problema && (
                  <Textarea placeholder="Descreva o problema do veículo..." value={lancarForm.observacoes_problema} onChange={e => setLancarForm({...lancarForm, observacoes_problema: e.target.value})} className="bg-secondary" rows={3} />
                )}

                <Button onClick={handleLancar} className="w-full bg-primary text-primary-foreground hover:bg-primary/80">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Vehicles & Drivers lists (admin only) */}
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-card/60 p-4 space-y-2">
            <h3 className="font-heading text-foreground text-sm flex items-center gap-2"><Car className="h-4 w-4 text-primary" /> Veículos Cadastrados ({veiculos.length})</h3>
            {veiculos.map(v => (
              <div key={v.id} className="flex justify-between items-center p-2 rounded bg-secondary/30 text-sm">
                <span className="text-foreground">{v.nome} — {v.placa} {v.modelo && `(${v.modelo})`}</span>
                <Button variant="ghost" size="icon" onClick={() => handleDeleteVeiculo(v.id)} className="text-destructive h-6 w-6"><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border bg-card/60 p-4 space-y-2">
            <h3 className="font-heading text-foreground text-sm flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Motoristas Cadastrados ({motoristas.length})</h3>
            {motoristas.map(m => (
              <div key={m.id} className="flex justify-between items-center p-2 rounded bg-secondary/30 text-sm">
                <span className="text-foreground">{m.nome}</span>
                <Button variant="ghost" size="icon" onClick={() => handleDeleteMotorista(m.id)} className="text-destructive h-6 w-6"><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Registros */}
      <div className="space-y-2">
        <h2 className="font-heading text-lg text-foreground">Registros de Chegada</h2>
        {registros.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Truck className="mx-auto h-12 w-12 mb-3 opacity-30" />
            <p>Nenhum registro</p>
          </div>
        ) : registros.map(r => (
          <div key={r.id} className={`p-3 rounded-lg border bg-card/40 ${r.tem_problema ? "border-red-500/30" : "border-border"}`}>
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-heading text-foreground">{r.veiculo_nome} — {r.veiculo_placa}</span>
                  {r.tem_problema && <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">PROBLEMA</span>}
                </div>
                <p className="text-xs text-muted-foreground">Motorista: {r.motorista_nome} · KM: {r.km_chegada || "-"}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(r.data_criacao)} · {r.registrado_por}</p>
                {r.observacoes_problema && <p className="text-xs text-red-400 mt-1">⚠️ {r.observacoes_problema}</p>}
              </div>
              {isAdmin && (
                <Button variant="ghost" size="icon" onClick={() => handleDeleteRegistro(r.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PortariaPage;
