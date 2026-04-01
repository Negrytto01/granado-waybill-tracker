import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Car, User, Plus, Trash2, Edit } from "lucide-react";

const CadastroVeiculosPage = () => {
  const { profile } = useAuth();
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [motoristas, setMotoristas] = useState<any[]>([]);
  const [openVeiculo, setOpenVeiculo] = useState(false);
  const [openMotorista, setOpenMotorista] = useState(false);
  const [veiculoForm, setVeiculoForm] = useState({ nome: "", placa: "", modelo: "" });
  const [motoristaForm, setMotoristaForm] = useState({ nome: "" });
  const isAdmin = profile?.cargo === "Master";

  const fetchData = useCallback(async () => {
    const [v, m] = await Promise.all([
      supabase.from("veiculos").select("*").order("nome"),
      supabase.from("motoristas").select("*").order("nome"),
    ]);
    setVeiculos((v.data as any[]) || []);
    setMotoristas((m.data as any[]) || []);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const ch1 = supabase.channel("rt-veiculos-cad").on("postgres_changes", { event: "*", schema: "public", table: "veiculos" }, () => fetchData()).subscribe();
    const ch2 = supabase.channel("rt-motoristas-cad").on("postgres_changes", { event: "*", schema: "public", table: "motoristas" }, () => fetchData()).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-heading text-3xl neon-text">Cadastro de Veículos e Motoristas</h1>
        {isAdmin && (
          <div className="flex gap-2 flex-wrap">
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
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h2 className="font-heading text-lg text-foreground flex items-center gap-2">
            <Car className="h-5 w-5 text-primary" /> Veículos ({veiculos.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {veiculos.map(v => (
              <div key={v.id} className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm space-y-1">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-heading text-foreground">{v.nome}</p>
                    <p className="text-sm text-primary">{v.placa}</p>
                    {v.modelo && <p className="text-xs text-muted-foreground">{v.modelo}</p>}
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteVeiculo(v.id)} className="text-destructive h-7 w-7">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {veiculos.length === 0 && <p className="text-muted-foreground text-sm col-span-2">Nenhum veículo cadastrado</p>}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="font-heading text-lg text-foreground flex items-center gap-2">
            <User className="h-5 w-5 text-primary" /> Motoristas ({motoristas.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {motoristas.map(m => (
              <div key={m.id} className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm">
                <div className="flex justify-between items-center">
                  <p className="font-heading text-foreground">{m.nome}</p>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteMotorista(m.id)} className="text-destructive h-7 w-7">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {motoristas.length === 0 && <p className="text-muted-foreground text-sm col-span-2">Nenhum motorista cadastrado</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CadastroVeiculosPage;
