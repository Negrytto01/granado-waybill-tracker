import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatTime, formatNF, getStatusClass } from "@/lib/helpers";
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
                  <span className="font-heading text-lg text-foreground">
                    {r.numero_nf.includes("/") ? (
                      <span className="flex flex-wrap gap-1.5 items-center">
                        {r.numero_nf.split(/\s*\/\s*/).map((nf: string, i: number) => (
                          <span key={i} className="inline-block px-2 py-0.5 rounded bg-secondary text-sm">
                            NF {formatNF(nf.trim())}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <>NF {formatNF(r.numero_nf)}</>
                    )}
                  </span>
                  <span className={`status-badge ${getStatusClass(r.status)}`}>{r.status}</span>
                  {r.is_pallet && <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">PALLET</span>}
                  {r.is_retirada && <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">RETIRADA</span>}
                </div>
                <p className="text-sm text-muted-foreground">{r.fornecedor}</p>
                <p className="text-xs text-muted-foreground">
                  Previsto: {formatDate(r.data_prevista)}
                  {r.horario_agenda && ` às ${r.horario_agenda.substring(0, 5)}`}
                  {r.hora_chegada && ` · Chegou: ${formatTime(r.hora_chegada)}`}
                </p>
                {!r.is_pallet && <p className="text-xs text-muted-foreground">Volumes: {r.quantidade_volumes || 0}</p>}
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
