import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { DollarSign } from "lucide-react";
import { FornecedorNF } from "@/components/FornecedorNF";

const ValoresDescargaPage = () => {
  const { profile } = useAuth();
  const [valorCaixa, setValorCaixa] = useState("");
  const [valorPallet, setValorPallet] = useState("");
  const [valorTonelada, setValorTonelada] = useState("");
  const [valorMulta, setValorMulta] = useState("");
  const [loading, setLoading] = useState(true);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [recebimentos, setRecebimentos] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    const { data: valores } = await supabase.from("valores_descarga").select("*").limit(1);
    if (valores && valores.length > 0) {
      setValorCaixa(String(valores[0].valor_por_caixa));
      setValorPallet(String(valores[0].valor_por_pallet));
      setValorTonelada(String(valores[0].valor_por_tonelada || 0));
      setValorMulta(String((valores[0] as any).valor_multa || 0));
      setExistingId(valores[0].id);
    }

    const { data: recs } = await supabase.from("recebimentos").select("*")
      .gt("valor_cobrado", 0)
      .order("hora_fim_descarga", { ascending: false })
      .limit(50);
    setRecebimentos(recs || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    const caixa = parseFloat(valorCaixa) || 0;
    const pallet = parseFloat(valorPallet) || 0;
    const tonelada = parseFloat(valorTonelada) || 0;
    const multa = parseFloat(valorMulta) || 0;

    if (existingId) {
      const { error } = await supabase.from("valores_descarga").update({
        valor_por_caixa: caixa, valor_por_pallet: pallet, valor_por_tonelada: tonelada,
        valor_multa: multa,
        atualizado_em: new Date().toISOString(), atualizado_por: profile?.nome,
      } as any).eq("id", existingId);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("valores_descarga").insert([{
        valor_por_caixa: caixa, valor_por_pallet: pallet, valor_por_tonelada: tonelada,
        valor_multa: multa, atualizado_por: profile?.nome,
      }] as any);
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Valores salvos!");
    fetchData();
  };

  if (profile?.cargo !== "Master") {
    return <div className="text-center py-12 text-muted-foreground">Acesso restrito a administradores</div>;
  }
  if (loading) return <div className="text-center py-12 text-muted-foreground animate-pulse">Carregando...</div>;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl neon-text">Valores de Descarga</h1>
      <div className="max-w-md p-6 rounded-xl border border-border bg-card/60 backdrop-blur-sm space-y-4">
        <div>
          <label className="text-sm text-muted-foreground">Valor por Caixa Batida (R$)</label>
          <Input type="number" step="0.01" value={valorCaixa} onChange={e => setValorCaixa(e.target.value)} className="bg-secondary mt-1" />
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Valor por Pallet Descarregado (R$)</label>
          <Input type="number" step="0.01" value={valorPallet} onChange={e => setValorPallet(e.target.value)} className="bg-secondary mt-1" />
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Valor por Tonelada (R$)</label>
          <Input type="number" step="0.01" value={valorTonelada} onChange={e => setValorTonelada(e.target.value)} className="bg-secondary mt-1" />
        </div>
        <div className="border-t border-border pt-4">
          <label className="text-sm text-red-400">Valor da Multa — Não Comparecimento (R$)</label>
          <Input type="number" step="0.01" value={valorMulta} onChange={e => setValorMulta(e.target.value)} className="bg-secondary mt-1" />
        </div>
        <Button onClick={handleSave} className="w-full bg-primary text-primary-foreground hover:bg-primary/80">
          <DollarSign className="mr-2 h-4 w-4" /> Salvar Valores
        </Button>
      </div>

      {recebimentos.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-heading text-xl text-foreground">Descargas com Valor Cobrado</h2>
          {recebimentos.map(r => (
            <div key={r.id} className="p-3 rounded-lg border border-border bg-card/40 flex justify-between items-center gap-3">
              <FornecedorNF fornecedor={r.fornecedor} numeroNf={r.numero_nf} />
              <div className="text-right">
                <span className="font-heading text-primary text-lg">R$ {Number(r.valor_cobrado).toFixed(2)}</span>
                <p className="text-xs text-muted-foreground">
                  {r.caixas_batidas > 0 && `${r.caixas_batidas} caixas`}
                  {r.caixas_batidas > 0 && r.pallets_descarregados > 0 && " · "}
                  {r.pallets_descarregados > 0 && `${r.pallets_descarregados} pallets`}
                  {r.toneladas > 0 && ` · ${r.toneladas}t`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ValoresDescargaPage;
