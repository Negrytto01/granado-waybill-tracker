import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Shield } from "lucide-react";

const allPages = [
  { key: "dashboard", label: "Dashboard" },
  { key: "agenda", label: "Agenda" },
  { key: "descarga", label: "Descarga" },
  { key: "armazenagem", label: "Armazenagem" },
  { key: "relatorios", label: "Relatórios" },
  { key: "historico", label: "Histórico" },
  { key: "compras", label: "Compras" },
  { key: "fornecedores", label: "Fornecedores Urgência" },
  { key: "financeiro", label: "Financeiro" },
  { key: "valores", label: "Valores Descarga" },
  { key: "usuarios", label: "Usuários" },
  { key: "calendario", label: "Calendário" },
];

const cargos = ["Agendamento/Conferente", "Estoque", "Faturamento", "Compra", "Financeiro", "Fiscal"];

const PermissoesPage = () => {
  const { profile } = useAuth();
  const [permissoes, setPermissoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const { data } = await supabase.from("cargo_permissoes").select("*");
    setPermissoes(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const togglePermission = async (cargo: string, pagina: string, currentAtivo: boolean | undefined) => {
    const existing = permissoes.find(p => p.cargo === cargo && p.pagina === pagina);
    if (existing) {
      await supabase.from("cargo_permissoes").update({ ativo: !currentAtivo }).eq("id", existing.id);
    } else {
      await supabase.from("cargo_permissoes").insert([{ cargo, pagina, ativo: true }]);
    }
    toast.success("Permissão atualizada!");
    fetchData();
  };

  const isActive = (cargo: string, pagina: string) => {
    const p = permissoes.find(x => x.cargo === cargo && x.pagina === pagina);
    return p?.ativo ?? false;
  };

  if (profile?.cargo !== "Master") {
    return <div className="text-center py-12 text-muted-foreground">Acesso restrito a administradores</div>;
  }
  if (loading) return <div className="text-center py-12 text-muted-foreground animate-pulse">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <h1 className="font-heading text-3xl neon-text">Permissões por Cargo</h1>
      </div>
      <p className="text-muted-foreground text-sm">Ative ou desative as telas que cada cargo pode acessar. O Administrador sempre tem acesso a tudo.</p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-3 text-muted-foreground text-sm font-medium">Tela</th>
              {cargos.map(c => <th key={c} className="text-center p-3 text-muted-foreground text-sm font-medium">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {allPages.map(page => (
              <tr key={page.key} className="border-b border-border/50 hover:bg-secondary/30">
                <td className="p-3 text-foreground font-medium">{page.label}</td>
                {cargos.map(cargo => (
                  <td key={cargo} className="text-center p-3">
                    <Switch checked={isActive(cargo, page.key)} onCheckedChange={() => togglePermission(cargo, page.key, isActive(cargo, page.key))} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PermissoesPage;
