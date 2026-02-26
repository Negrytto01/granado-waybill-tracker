import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatTime, getStatusClass } from "@/lib/helpers";
import { useRealtime } from "@/hooks/useRealtime";
import { CalendarDays } from "lucide-react";

const ComprasPage = () => {
  const [recebimentos, setRecebimentos] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    const { data } = await supabase.from("recebimentos").select("*")
      .order("data_prevista", { ascending: true })
      .order("data_criacao", { ascending: false });
    setRecebimentos(data || []);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useRealtime("recebimentos", fetchData);

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
      <h1 className="font-heading text-3xl neon-text">Compras — Agenda de Recebimento</h1>
      <p className="text-muted-foreground text-sm">Visualização das agendas (somente leitura)</p>

      {groups.map(group => group.items.length > 0 && (
        <div key={group.label} className="space-y-3">
          <h2 className="font-heading text-lg text-foreground border-b border-border pb-1">{group.label}</h2>
          <div className="space-y-2">
            {group.items.map(r => (
              <div key={r.id} className="p-4 rounded-lg border border-border bg-card/60 backdrop-blur-sm space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-heading text-lg text-foreground">NF {r.numero_nf}</span>
                  <span className={`status-badge ${getStatusClass(r.status)}`}>{r.status}</span>
                </div>
                <p className="text-sm text-muted-foreground">{r.fornecedor}</p>
                <p className="text-xs text-muted-foreground">
                  Previsto: {formatDate(r.data_prevista)}
                  {r.horario_agenda && ` às ${r.horario_agenda}`}
                  {r.hora_chegada && ` · Chegou: ${formatTime(r.hora_chegada)}`}
                </p>
                <p className="text-xs text-muted-foreground">Volumes: {r.quantidade_volumes || 0}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      {recebimentos.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <CalendarDays className="mx-auto h-12 w-12 mb-3 opacity-30" />
          <p>Nenhum recebimento agendado</p>
        </div>
      )}
    </div>
  );
};

export default ComprasPage;
