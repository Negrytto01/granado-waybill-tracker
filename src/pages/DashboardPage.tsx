import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useRealtime } from "@/hooks/useRealtime";
import { usePermissions } from "@/hooks/usePermissions";
import { Truck, Package, CalendarDays, CheckCircle, Users, History, BarChart3, ShoppingCart, AlertTriangle, Wallet, DollarSign, Calendar } from "lucide-react";

interface Stats {
  aguardando: number;
  emDescarga: number;
  paraGuardar: number;
  finalizadasHoje: number;
}

const DashboardPage = () => {
  const navigate = useNavigate();
  const { hasAccess } = usePermissions();
  const [stats, setStats] = useState<Stats>({ aguardando: 0, emDescarga: 0, paraGuardar: 0, finalizadasHoje: 0 });

  const fetchStats = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];
    const [aguardando, emDescarga, paraGuardar, finalizadas] = await Promise.all([
      supabase.from("recebimentos").select("id", { count: "exact", head: true }).in("status", ["AGENDADO", "CHEGOU"]),
      supabase.from("recebimentos").select("id", { count: "exact", head: true }).in("status", ["EM DESCARGA", "ACOPLADO", "DESACOPLADO"]),
      supabase.from("armazenagem").select("id", { count: "exact", head: true }).eq("status", "AGUARDANDO ARMAZENAGEM"),
      supabase.from("recebimentos").select("id", { count: "exact", head: true }).eq("status", "FINALIZADO").gte("hora_fim_descarga", today),
    ]);
    setStats({
      aguardando: aguardando.count || 0,
      emDescarga: emDescarga.count || 0,
      paraGuardar: paraGuardar.count || 0,
      finalizadasHoje: finalizadas.count || 0,
    });
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useRealtime("recebimentos", fetchStats);
  useRealtime("armazenagem", fetchStats);

  const cards = [
    { label: "Aguardando", value: stats.aguardando, icon: Truck, color: "text-yellow-400" },
    { label: "Em Descarga", value: stats.emDescarga, icon: Package, color: "text-orange-400" },
    { label: "Para Guardar", value: stats.paraGuardar, icon: CalendarDays, color: "text-purple-400" },
    { label: "Finalizadas Hoje", value: stats.finalizadasHoje, icon: CheckCircle, color: "text-emerald-400" },
  ];

  const allQuickActions = [
    { label: "Agenda", icon: CalendarDays, path: "/agenda", page: "agenda", color: "bg-blue-500/20 text-blue-400" },
    { label: "Calendário", icon: Calendar, path: "/calendario", page: "calendario", color: "bg-indigo-500/20 text-indigo-400" },
    { label: "Descarga", icon: Truck, path: "/descarga", page: "descarga", color: "bg-orange-500/20 text-orange-400" },
    { label: "Armazenagem", icon: Package, path: "/armazenagem", page: "armazenagem", color: "bg-purple-500/20 text-purple-400" },
    { label: "Compras", icon: ShoppingCart, path: "/compras", page: "compras", color: "bg-teal-500/20 text-teal-400" },
    { label: "Relatórios", icon: BarChart3, path: "/relatorios", page: "relatorios", color: "bg-cyan-500/20 text-cyan-400" },
    { label: "Histórico", icon: History, path: "/historico", page: "historico", color: "bg-blue-400/20 text-blue-300" },
    { label: "Fornecedores", icon: AlertTriangle, path: "/fornecedores", page: "fornecedores", color: "bg-red-500/20 text-red-400" },
    { label: "Valores", icon: DollarSign, path: "/valores", page: "valores", color: "bg-amber-500/20 text-amber-400" },
    { label: "Financeiro", icon: Wallet, path: "/financeiro", page: "financeiro", color: "bg-green-500/20 text-green-400" },
    { label: "Usuários", icon: Users, path: "/usuarios", page: "usuarios", color: "bg-slate-500/20 text-slate-400" },
  ];

  const quickActions = allQuickActions.filter(a => hasAccess(a.page));

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl neon-text">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.label} className="rounded-xl border border-border bg-card/80 backdrop-blur-sm p-4 space-y-2">
            <div className="flex items-center gap-2">
              <c.icon className={`h-5 w-5 ${c.color}`} />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">{c.label}</span>
            </div>
            <p className={`font-heading text-4xl ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="font-heading text-xl text-foreground mb-3">Acesso Rápido</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {quickActions.map(a => (
            <button
              key={a.label}
              onClick={() => navigate(a.path)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card/60 hover:bg-card transition-all ${a.color}`}
            >
              <a.icon className="h-8 w-8" />
              <span className="text-xs font-semibold">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
