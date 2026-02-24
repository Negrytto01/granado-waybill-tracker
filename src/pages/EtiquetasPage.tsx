import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Tag, Printer } from "lucide-react";
import jsPDF from "jspdf";

const EtiquetasPage = () => {
  const { profile } = useAuth();
  const [form, setForm] = useState({ descricao: "", peso: "", validade: "", quantidade_caixa: 0 });

  const generatePDF = (data: { descricao: string; peso: string; validade: string; quantidade_caixa: number; usuario: string }) => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFont("helvetica", "bold");

    doc.setFontSize(40);
    doc.text(`DESCRIÇÃO: ${data.descricao.toUpperCase()} / PESO: ${data.peso.toUpperCase()}`, 15, 50);

    doc.setFontSize(35);
    const validadeFormatted = data.validade
      ? new Date(data.validade + "T00:00:00").toLocaleDateString("pt-BR")
      : "-";
    doc.text(`VALIDADE: ${validadeFormatted}`, 15, 90);

    doc.setFontSize(35);
    doc.text(`QUANTIDADE DE CAIXA: ${data.quantidade_caixa} CAIXAS`, 15, 130);

    doc.setFontSize(30);
    doc.text(`USUÁRIO: ${data.usuario.toUpperCase()}`, 15, 170);

    doc.save(`etiqueta-${data.descricao.replace(/\s+/g, '-').toLowerCase()}.pdf`);
  };

  const handleSave = async () => {
    if (!form.descricao) { toast.error("Descrição obrigatória"); return; }
    const usuario = profile?.nome || "";
    const { error } = await supabase.from("etiquetas_pallet").insert([{
      descricao: form.descricao,
      peso: form.peso,
      validade: form.validade || null,
      quantidade_caixa: Number(form.quantidade_caixa),
      usuario,
    }]);
    if (error) { toast.error(error.message); return; }

    generatePDF({ ...form, quantidade_caixa: Number(form.quantidade_caixa), usuario });
    toast.success("Etiqueta salva e PDF gerado!");
    setForm({ descricao: "", peso: "", validade: "", quantidade_caixa: 0 });
  };

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl neon-text">Criar Etiqueta de Pallet</h1>

      <div className="max-w-lg space-y-4 p-6 rounded-xl border border-border bg-card/60 backdrop-blur-sm">
        <Input placeholder="Descrição do Produto *" value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} className="bg-secondary" />
        <Input placeholder="Peso (ex: 1KG)" value={form.peso} onChange={e => setForm({...form, peso: e.target.value})} className="bg-secondary" />
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Validade</label>
          <Input type="date" value={form.validade} onChange={e => setForm({...form, validade: e.target.value})} className="bg-secondary" />
        </div>
        <Input type="number" placeholder="Quantidade de Caixas" value={form.quantidade_caixa} onChange={e => setForm({...form, quantidade_caixa: Number(e.target.value)})} className="bg-secondary" />
        <div className="text-sm text-muted-foreground">Usuário: <span className="text-foreground">{profile?.nome}</span></div>
        <Button onClick={handleSave} className="w-full bg-primary text-primary-foreground hover:bg-primary/80 font-heading text-lg">
          <Printer className="mr-2 h-5 w-5" /> Salvar e Imprimir
        </Button>
      </div>
    </div>
  );
};

export default EtiquetasPage;
