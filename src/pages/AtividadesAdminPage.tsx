import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateTime } from "@/lib/helpers";
import { Activity, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const AtividadesAdminPage = () => {
  const { profile } = useAuth();
  const [atividades, setAtividades] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    const { data } = await supabase.from("atividades_usuarios").select("*")
      .order("data_criacao", { ascending: false })
      .limit(200);
    setAtividades((data as any[]) || []);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel("rt-atividades")
      .on("postgres_changes", { event: "*", schema: "public", table: "atividades_usuarios" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  if (profile?.cargo !== "Master") {
    return <div className="text-center py-12 text-muted-foreground">Acesso restrito</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl neon-text">Atividades em Tempo Real</h1>
        <Button variant="ghost" size="icon" onClick={fetchData}><RefreshCw className="h-4 w-4 text-muted-foreground" /></Button>
      </div>

      {atividades.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Activity className="mx-auto h-12 w-12 mb-3 opacity-30" />
          <p>Nenhuma atividade registrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {atividades.map(a => (
            <div key={a.id} className="p-3 rounded-lg border border-border bg-card/40">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-heading text-foreground text-sm">{a.usuario_nome}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary">{a.acao}</span>
              </div>
              {a.detalhes && <p className="text-sm text-muted-foreground mt-1">{a.detalhes}</p>}
              <p className="text-xs text-muted-foreground mt-1">{formatDateTime(a.data_criacao)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AtividadesAdminPage;
