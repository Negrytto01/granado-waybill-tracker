import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CargoPermissao {
  id: string;
  cargo: string;
  pagina: string;
  ativo: boolean;
}

export const usePermissions = () => {
  const { profile } = useAuth();
  const [permissoes, setPermissoes] = useState<CargoPermissao[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPermissoes = useCallback(async () => {
    const { data } = await supabase
      .from("cargo_permissoes")
      .select("*")
      .order("cargo")
      .order("pagina");
    setPermissoes((data as CargoPermissao[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPermissoes();
    const channel = supabase
      .channel("realtime-cargo_permissoes")
      .on("postgres_changes", { event: "*", schema: "public", table: "cargo_permissoes" }, () => fetchPermissoes())
      .subscribe();
    // Polling every 30s as backup for realtime sync across devices
    const interval = setInterval(fetchPermissoes, 30000);
    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, [fetchPermissoes]);

  const isAdmin = profile?.cargo === "Master";

  const hasAccess = useCallback((pagina: string): boolean => {
    if (!profile) return false;
    if (isAdmin) return true;
    const perm = permissoes.find(p => p.cargo === profile.cargo && p.pagina === pagina);
    return perm?.ativo ?? false;
  }, [profile, permissoes, isAdmin]);

  const getAccessiblePages = useCallback((): string[] => {
    if (!profile) return [];
    if (isAdmin) return ["dashboard", "agenda", "descarga", "armazenagem", "relatorios", "historico", "usuarios", "valores", "compras", "fornecedores", "financeiro", "calendario", "solicitacoes"];
    return permissoes
      .filter(p => p.cargo === profile.cargo && p.ativo)
      .map(p => p.pagina);
  }, [profile, permissoes, isAdmin]);

  return { permissoes, loading, hasAccess, getAccessiblePages, isAdmin, refetch: fetchPermissoes };
};
