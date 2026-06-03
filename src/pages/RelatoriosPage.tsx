import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface FornecedorStats {
  fornecedor: string;
  volumes: number;
  descargas: number;
  valorDescarga: number;
  prevMonthVolumes?: number;
  prevMonthDescargas?: number;
}

const RelatoriosPage = () => {
  const [stats, setStats] = useState<FornecedorStats[]>([]);
  const [mesRef, setMesRef] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [year, month] = mesRef.split("-").map(Number);
    const startDate = `${mesRef}-01`;
    const endDate = new Date(year, month, 0).toISOString().split("T")[0];

    // Previous month
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevStartDate = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
    const prevEndDate = new Date(prevYear, prevMonth, 0).toISOString().split("T")[0];

    // Current month data
    const { data: currentRecs } = await supabase.from("recebimentos").select("fornecedor, quantidade_volumes, valor_cobrado")
      .gte("data_prevista", startDate)
      .lte("data_prevista", endDate)
      .not("status", "eq", "NAO_VEIO");

    // Previous month data (try saved snapshot first)
    const { data: savedPrev } = await supabase.from("relatorios_mensais").select("*")
      .eq("mes_referencia", prevStartDate);

    let prevMap: Record<string, { volumes: number; descargas: number }> = {};
    if (savedPrev && savedPrev.length > 0) {
      savedPrev.forEach((s: any) => {
        const key = normalizeFornecedor(s.fornecedor);
        if (!prevMap[key]) prevMap[key] = { volumes: 0, descargas: 0 };
        prevMap[key].volumes += s.total_volumes || 0;
        prevMap[key].descargas += s.total_descargas || 0;
      });
    } else {
      // Calculate from recebimentos
      const { data: prevRecs } = await supabase.from("recebimentos").select("fornecedor, quantidade_volumes")
        .gte("data_prevista", prevStartDate)
        .lte("data_prevista", prevEndDate)
        .not("status", "eq", "NAO_VEIO");
      (prevRecs || []).forEach(r => {
        const name = normalizeFornecedor(r.fornecedor);
        if (!prevMap[name]) prevMap[name] = { volumes: 0, descargas: 0 };
        prevMap[name].volumes += r.quantidade_volumes || 0;
        prevMap[name].descargas++;
      });
    }

    // Current month aggregation
    const currentMap: Record<string, { volumes: number; descargas: number; valor: number }> = {};
    (currentRecs || []).forEach(r => {
      const name = normalizeFornecedor(r.fornecedor);
      if (!currentMap[name]) currentMap[name] = { volumes: 0, descargas: 0, valor: 0 };
      currentMap[name].volumes += r.quantidade_volumes || 0;
      currentMap[name].descargas++;
      currentMap[name].valor += Number(r.valor_cobrado) || 0;
    });

    const allFornecedores = [...new Set([...Object.keys(currentMap), ...Object.keys(prevMap)])].sort();
    const result: FornecedorStats[] = allFornecedores.map(f => ({
      fornecedor: f,
      volumes: currentMap[f]?.volumes || 0,
      descargas: currentMap[f]?.descargas || 0,
      valorDescarga: currentMap[f]?.valor || 0,
      prevMonthVolumes: prevMap[f]?.volumes || 0,
      prevMonthDescargas: prevMap[f]?.descargas || 0,
    })).filter(f => f.volumes > 0 || f.descargas > 0);

    setStats(result.sort((a, b) => b.volumes - a.volumes));
    setLoading(false);
  }, [mesRef]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Save snapshot for the previous month (day 1 auto-save)
  const saveSnapshot = async () => {
    const [year, month] = mesRef.split("-").map(Number);
    const startDate = `${mesRef}-01`;
    const endDate = new Date(year, month, 0).toISOString().split("T")[0];

    const { data: recs } = await supabase.from("recebimentos").select("fornecedor, quantidade_volumes")
      .gte("data_prevista", startDate)
      .lte("data_prevista", endDate)
      .not("status", "eq", "NAO_VEIO");

    const map: Record<string, { volumes: number; descargas: number }> = {};
    (recs || []).forEach(r => {
      const name = r.fornecedor || "N/A";
      if (!map[name]) map[name] = { volumes: 0, descargas: 0 };
      map[name].volumes += r.quantidade_volumes || 0;
      map[name].descargas++;
    });

    for (const [fornecedor, data] of Object.entries(map)) {
      await supabase.from("relatorios_mensais").upsert({
        mes_referencia: startDate,
        fornecedor,
        total_volumes: data.volumes,
        total_descargas: data.descargas,
      } as any, { onConflict: "mes_referencia,fornecedor" });
    }

    toast.success("Snapshot salvo!");
  };

  const calcPercentChange = (current: number, prev: number): { value: number; color: string; icon: any } => {
    if (prev === 0 && current === 0) return { value: 0, color: "text-muted-foreground", icon: null };
    if (prev === 0) return { value: 100, color: "text-emerald-400", icon: TrendingUp };
    const pct = ((current - prev) / prev) * 100;
    return {
      value: Math.round(pct),
      color: pct >= 0 ? "text-emerald-400" : "text-red-400",
      icon: pct >= 0 ? TrendingUp : TrendingDown,
    };
  };

  const totalVolumes = stats.reduce((s, f) => s + f.volumes, 0);
  const totalDescargas = stats.reduce((s, f) => s + f.descargas, 0);
  const totalValor = stats.reduce((s, f) => s + f.valorDescarga, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-3xl neon-text">Relatórios</h1>
        <div className="text-center py-12 text-muted-foreground animate-pulse">Carregando dados...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-heading text-3xl neon-text">Relatórios</h1>
        <div className="flex gap-2 items-center">
          <Input type="month" value={mesRef} onChange={e => setMesRef(e.target.value)} className="bg-secondary w-44" />
          <Button variant="outline" size="sm" onClick={saveSnapshot} className="border-primary/50 text-primary">
            <RefreshCw className="mr-2 h-4 w-4" /> Salvar Snapshot
          </Button>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm">
          <span className="text-xs text-muted-foreground uppercase">Total Volumes</span>
          <p className="font-heading text-3xl text-primary">{totalVolumes}</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm">
          <span className="text-xs text-muted-foreground uppercase">Total Descargas</span>
          <p className="font-heading text-3xl text-primary">{totalDescargas}</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm">
          <span className="text-xs text-muted-foreground uppercase">Valor Descarga</span>
          <p className="font-heading text-3xl text-primary">R$ {totalValor.toFixed(2)}</p>
        </div>
      </div>

      {stats.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <BarChart3 className="mx-auto h-12 w-12 mb-3 opacity-30" />
          <p>Nenhum dado para este mês</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.map(f => {
            const volChange = calcPercentChange(f.volumes, f.prevMonthVolumes || 0);
            const descChange = calcPercentChange(f.descargas, f.prevMonthDescargas || 0);
            return (
              <div key={f.fornecedor} className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm space-y-2">
                <h3 className="font-heading text-foreground text-sm truncate" title={f.fornecedor}>{f.fornecedor}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-muted-foreground">Volumes</span>
                    <p className="font-heading text-2xl text-primary">{f.volumes}</p>
                    {volChange.icon && (
                      <div className={`flex items-center gap-1 text-xs ${volChange.color}`}>
                        <volChange.icon className="h-3 w-3" />
                        <span>{volChange.value > 0 ? "+" : ""}{volChange.value}%</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Descargas</span>
                    <p className="font-heading text-2xl text-primary">{f.descargas}</p>
                    {descChange.icon && (
                      <div className={`flex items-center gap-1 text-xs ${descChange.color}`}>
                        <descChange.icon className="h-3 w-3" />
                        <span>{descChange.value > 0 ? "+" : ""}{descChange.value}%</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="pt-2 border-t border-border">
                  <span className="text-xs text-muted-foreground">Valor Descarga</span>
                  <p className="font-heading text-lg text-emerald-400">R$ {f.valorDescarga.toFixed(2)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RelatoriosPage;
