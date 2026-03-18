import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/helpers";
import { Ban, Trash2 } from "lucide-react";

const FornecedoresNaoVieramPage = () => {
  const { profile } = useAuth();
  const [registros, setRegistros] = useState<any[]>([]);
  const isAdmin = profile?.cargo === "Master";

  const fetchData = useCallback(async () => {
    const { data } = await supabase.from("fornecedores_nao_vieram").select("*")
      .order("data_criacao", { ascending: false });
    setRegistros((data as any[]) || []);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const ch = supabase.channel("rt-naovieram").on("postgres_changes", { event: "*", schema: "public", table: "fornecedores_nao_vieram" }, () => fetchData()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchData]);

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este registro?")) return;
    await supabase.from("fornecedores_nao_vieram").delete().eq("id", id);
    fetchData();
  };

  const totalMultas = registros.reduce((s, r) => s + Number(r.multa || 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl neon-text">Fornecedores — Não Compareceram</h1>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm">
          <span className="text-xs text-muted-foreground uppercase">Total Registros</span>
          <p className="font-heading text-3xl text-red-400">{registros.length}</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm">
          <span className="text-xs text-muted-foreground uppercase">Total Multas</span>
          <p className="font-heading text-3xl text-red-400">R$ {totalMultas.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">⚠️ Valores a cobrar futuramente</p>
        </div>
      </div>

      {registros.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Ban className="mx-auto h-12 w-12 mb-3 opacity-30" />
          <p>Nenhum fornecedor registrado como ausente</p>
        </div>
      ) : (
        <div className="space-y-2">
          {registros.map(r => (
            <div key={r.id} className="p-4 rounded-lg border border-red-500/20 bg-card/40">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-heading text-foreground">{r.fornecedor}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">{r.motivo}</span>
                  </div>
                  {r.observacoes && <p className="text-sm text-yellow-400 mt-1">📝 {r.observacoes}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    Registrado por: {r.usuario} · {formatDateTime(r.data_criacao)}
                  </p>
                  {Number(r.multa) > 0 && (
                    <p className="text-sm font-heading text-red-400 mt-1">Multa: R$ {Number(r.multa).toFixed(2)}</p>
                  )}
                </div>
                {isAdmin && (
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FornecedoresNaoVieramPage;
