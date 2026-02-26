import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type TableName = "recebimentos" | "armazenagem" | "etiquetas_pallet" | "usuarios" | "cargo_permissoes" | "valores_descarga" | "fornecedores_urgencia" | "fluxo_financeiro";

export const useRealtime = (
  table: TableName,
  onUpdate: () => void,
  options?: { onInsert?: (payload: any) => void; onUpdate?: (payload: any) => void }
) => {
  useEffect(() => {
    const channel = supabase
      .channel(`realtime-${table}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload) => {
          if (payload.eventType === "INSERT" && options?.onInsert) {
            options.onInsert(payload.new);
          }
          if (payload.eventType === "UPDATE" && options?.onUpdate) {
            options.onUpdate(payload.new);
          }
          onUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, onUpdate]);
};
