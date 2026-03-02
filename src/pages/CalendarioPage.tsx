import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useRealtime";
import { Calendar } from "@/components/ui/calendar";
import { formatTime, getStatusClass } from "@/lib/helpers";
import { CalendarDays } from "lucide-react";

const CalendarioPage = () => {
  const [recebimentos, setRecebimentos] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const fetchData = useCallback(async () => {
    const { data } = await supabase
      .from("recebimentos")
      .select("id, numero_nf, fornecedor, data_prevista, horario_agenda, status, quantidade_volumes")
      .order("horario_agenda", { ascending: true });
    setRecebimentos(data || []);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useRealtime("recebimentos", fetchData);

  const selectedDateStr = selectedDate?.toISOString().split("T")[0];
  const dayItems = recebimentos.filter(r => r.data_prevista === selectedDateStr);

  // Dates that have agendas
  const datesWithAgenda = new Set(recebimentos.map(r => r.data_prevista));
  const modifiers = {
    hasAgenda: (date: Date) => datesWithAgenda.has(date.toISOString().split("T")[0]),
  };
  const modifiersClassNames = {
    hasAgenda: "bg-primary/20 text-primary font-bold",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CalendarDays className="h-8 w-8 text-primary" />
        <h1 className="font-heading text-3xl neon-text">Calendário de Agendas</h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-4">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            modifiers={modifiers}
            modifiersClassNames={modifiersClassNames}
            className="p-3 pointer-events-auto"
          />
        </div>

        <div className="flex-1 space-y-3">
          <h2 className="font-heading text-lg text-foreground">
            {selectedDate ? selectedDate.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Selecione uma data"}
          </h2>

          {dayItems.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">Nenhuma agenda para esta data</p>
          ) : (
            dayItems.map(r => (
              <div key={r.id} className="p-4 rounded-lg border border-border bg-card/60 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-heading text-foreground">NF {r.numero_nf}</span>
                  <span className={`status-badge ${getStatusClass(r.status)}`}>{r.status}</span>
                </div>
                <p className="text-sm text-muted-foreground">{r.fornecedor}</p>
                <p className="text-xs text-muted-foreground">
                  {r.horario_agenda ? `Horário: ${r.horario_agenda}` : "Sem horário definido"}
                  {r.quantidade_volumes > 0 && ` · ${r.quantidade_volumes} caixas`}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CalendarioPage;
