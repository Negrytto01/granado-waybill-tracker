import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatDateTime, getStatusClass } from "@/lib/helpers";
import { History } from "lucide-react";

const HistoricoPage = () => {
  const [recebimentos, setRecebimentos] = useState<any[]>([]);
  const [etiquetas, setEtiquetas] = useState<any[]>([]);
  const [filterNF, setFilterNF] = useState("");
  const [filterFornecedor, setFilterFornecedor] = useState("");
  const [filterUsuario, setFilterUsuario] = useState("");
  const [filterData, setFilterData] = useState("");

  useEffect(() => {
    const fetchAll = async () => {
      const [rec, etq] = await Promise.all([
        supabase.from("recebimentos").select("*").order("data_criacao", { ascending: false }).limit(200),
        supabase.from("etiquetas_pallet").select("*").order("data_criacao", { ascending: false }).limit(200),
      ]);
      setRecebimentos(rec.data || []);
      setEtiquetas(etq.data || []);
    };
    fetchAll();
  }, []);

  const filteredRec = recebimentos.filter(r => {
    if (filterNF && !r.numero_nf?.toLowerCase().includes(filterNF.toLowerCase())) return false;
    if (filterFornecedor && !r.fornecedor?.toLowerCase().includes(filterFornecedor.toLowerCase())) return false;
    if (filterUsuario && !r.usuario_responsavel?.toLowerCase().includes(filterUsuario.toLowerCase())) return false;
    if (filterData && r.data_prevista !== filterData) return false;
    return true;
  });

  const filteredEtq = etiquetas.filter(e => {
    if (filterUsuario && !e.usuario?.toLowerCase().includes(filterUsuario.toLowerCase())) return false;
    if (filterData && !e.data_criacao?.startsWith(filterData)) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl neon-text">Histórico</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Input placeholder="Filtrar NF" value={filterNF} onChange={e => setFilterNF(e.target.value)} className="bg-secondary" />
        <Input placeholder="Filtrar Fornecedor" value={filterFornecedor} onChange={e => setFilterFornecedor(e.target.value)} className="bg-secondary" />
        <Input placeholder="Filtrar Usuário" value={filterUsuario} onChange={e => setFilterUsuario(e.target.value)} className="bg-secondary" />
        <Input type="date" value={filterData} onChange={e => setFilterData(e.target.value)} className="bg-secondary" />
      </div>

      <Tabs defaultValue="recebimentos">
        <TabsList className="bg-secondary">
          <TabsTrigger value="recebimentos">Recebimentos</TabsTrigger>
          <TabsTrigger value="etiquetas">Etiquetas</TabsTrigger>
        </TabsList>

        <TabsContent value="recebimentos" className="space-y-2 mt-4">
          {filteredRec.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum registro encontrado</p>
          ) : filteredRec.map(r => (
            <div key={r.id} className="p-3 rounded-lg border border-border bg-card/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-heading text-foreground">NF {r.numero_nf}</span>
                  <span className={`status-badge ${getStatusClass(r.status)}`}>{r.status}</span>
                </div>
                <p className="text-xs text-muted-foreground">{r.fornecedor} · {formatDate(r.data_prevista)} · {r.usuario_responsavel}</p>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="etiquetas" className="space-y-2 mt-4">
          {filteredEtq.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum registro encontrado</p>
          ) : filteredEtq.map(e => (
            <div key={e.id} className="p-3 rounded-lg border border-border bg-card/40">
              <p className="font-heading text-foreground">{e.descricao}</p>
              <p className="text-xs text-muted-foreground">Peso: {e.peso} · Caixas: {e.quantidade_caixa} · {e.usuario} · {formatDateTime(e.data_criacao)}</p>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HistoricoPage;
