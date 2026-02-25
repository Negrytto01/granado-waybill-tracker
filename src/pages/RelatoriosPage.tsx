import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { BarChart3 } from "lucide-react";

const COLORS = ["#00e639", "#22d3ee", "#a855f7", "#f97316", "#eab308", "#ef4444", "#3b82f6"];

const RelatoriosPage = () => {
  const [tempoMedio, setTempoMedio] = useState<any[]>([]);
  const [volumePorFornecedor, setVolumePorFornecedor] = useState<any[]>([]);
  const [desempenhoDiario, setDesempenhoDiario] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch all finalized recebimentos for analysis
      const { data: recs } = await supabase
        .from("recebimentos")
        .select("*")
        .not("hora_inicio_descarga", "is", null)
        .not("hora_fim_descarga", "is", null)
        .order("data_criacao", { ascending: false })
        .limit(500);

      const allRecs = recs || [];

      // 1. Average unloading time by day of week
      const dayMap: Record<string, { total: number; count: number }> = {};
      const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      allRecs.forEach(r => {
        const start = new Date(r.hora_inicio_descarga!);
        const end = new Date(r.hora_fim_descarga!);
        const mins = (end.getTime() - start.getTime()) / 60000;
        if (mins > 0 && mins < 1440) {
          const day = dayNames[start.getDay()];
          if (!dayMap[day]) dayMap[day] = { total: 0, count: 0 };
          dayMap[day].total += mins;
          dayMap[day].count++;
        }
      });
      setTempoMedio(dayNames.map(d => ({
        dia: d,
        minutos: dayMap[d] ? Math.round(dayMap[d].total / dayMap[d].count) : 0
      })));

      // 2. Volume by supplier (top 10)
      const { data: allForVolume } = await supabase
        .from("recebimentos")
        .select("fornecedor, quantidade_volumes, quantidade_itens")
        .limit(500);

      const supplierMap: Record<string, number> = {};
      (allForVolume || []).forEach(r => {
        const name = r.fornecedor || "N/A";
        const short = name.length > 20 ? name.substring(0, 20) + "..." : name;
        supplierMap[short] = (supplierMap[short] || 0) + (r.quantidade_volumes || r.quantidade_itens || 1);
      });
      const sortedSuppliers = Object.entries(supplierMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, value]) => ({ name, value }));
      setVolumePorFornecedor(sortedSuppliers);

      // 3. Daily performance (last 14 days)
      const last14Days: any[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        const dayLabel = `${d.getDate()}/${d.getMonth() + 1}`;
        const dayRecs = allRecs.filter(r => r.hora_fim_descarga?.startsWith(dateStr));
        last14Days.push({
          dia: dayLabel,
          descargas: dayRecs.length,
        });
      }
      setDesempenhoDiario(last14Days);
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-3xl neon-text">Relatórios</h1>
        <div className="text-center py-12 text-muted-foreground animate-pulse">Carregando dados...</div>
      </div>
    );
  }

  const hasData = tempoMedio.some(d => d.minutos > 0) || volumePorFornecedor.length > 0;

  return (
    <div className="space-y-8">
      <h1 className="font-heading text-3xl neon-text">Relatórios</h1>

      {!hasData ? (
        <div className="text-center py-12 text-muted-foreground">
          <BarChart3 className="mx-auto h-12 w-12 mb-3 opacity-30" />
          <p>Ainda não há dados suficientes para gerar relatórios.</p>
          <p className="text-xs mt-1">Complete algumas descargas para visualizar os gráficos.</p>
        </div>
      ) : (
        <>
          {/* Average unloading time */}
          <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-6">
            <h2 className="font-heading text-xl text-foreground mb-4">Tempo Médio de Descarga (min)</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tempoMedio}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(160 20% 18%)" />
                  <XAxis dataKey="dia" stroke="hsl(150 20% 55%)" fontSize={12} />
                  <YAxis stroke="hsl(150 20% 55%)" fontSize={12} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(160 12% 10%)", border: "1px solid hsl(160 20% 18%)", borderRadius: 8, color: "hsl(150 80% 90%)" }}
                    formatter={(value: number) => [`${value} min`, "Tempo médio"]}
                  />
                  <Bar dataKey="minutos" fill="#00e639" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Volume by supplier */}
          <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-6">
            <h2 className="font-heading text-xl text-foreground mb-4">Volume por Fornecedor</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={volumePorFornecedor}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {volumePorFornecedor.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(160 12% 10%)", border: "1px solid hsl(160 20% 18%)", borderRadius: 8, color: "hsl(150 80% 90%)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Daily performance */}
          <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-6">
            <h2 className="font-heading text-xl text-foreground mb-4">Desempenho Diário (Descargas)</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={desempenhoDiario}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(160 20% 18%)" />
                  <XAxis dataKey="dia" stroke="hsl(150 20% 55%)" fontSize={12} />
                  <YAxis stroke="hsl(150 20% 55%)" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(160 12% 10%)", border: "1px solid hsl(160 20% 18%)", borderRadius: 8, color: "hsl(150 80% 90%)" }}
                  />
                  <Line type="monotone" dataKey="descargas" stroke="#00e639" strokeWidth={2} dot={{ fill: "#00e639", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default RelatoriosPage;
