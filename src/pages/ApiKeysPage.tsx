import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Copy, Plus, Trash2, Ban, Check } from "lucide-react";
import { toast } from "sonner";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

const RESOURCES = [
  "recebimentos", "armazenagem", "solicitacoes_compras",
  "fornecedores_urgencia", "fornecedores_nao_vieram",
  "portaria_registros", "veiculos", "motoristas",
  "ocorrencias_armazenagem", "ocorrencias_tipos",
  "fluxo_financeiro", "valores_descarga", "relatorios_mensais",
  "etiquetas_pallet",
];

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api/v1`;
const OPENAPI_URL = `${API_BASE}/openapi.json`;
const WEBHOOK_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/external-webhook`;

const ERP_TEMPLATES: Record<string, { auth_tipo: string; auth_config: any; endpoints: any; base_url: string }> = {
  totvs: {
    base_url: "https://seu-totvs.com.br/rest",
    auth_tipo: "oauth2",
    auth_config: { token_url: "https://seu-totvs.com.br/api/oauth2/v1/token", client_id: "", client_secret: "", grant_type: "password", scope: "" },
    endpoints: {
      sincronizar_fornecedores: { metodo: "GET", path: "/fwmodel/SA2/items" },
      enviar_recebimento: { metodo: "POST", path: "/fwmodel/SF1/items" },
      sincronizar_produtos: { metodo: "GET", path: "/fwmodel/SB1/items" },
      webhook_map: { fornecedor_atualizado: { tabela: "recebimentos", mapeamento: { fornecedor: "A2_NOME", cnpj: "A2_CGC" } } },
    },
  },
  sap: {
    base_url: "https://seu-sap:50000/b1s/v1",
    auth_tipo: "cookie",
    auth_config: { login_url: "https://seu-sap:50000/b1s/v1/Login", login_body: { CompanyDB: "SBODEMO", UserName: "manager", Password: "" } },
    endpoints: {
      sincronizar_fornecedores: { metodo: "GET", path: "/BusinessPartners?$filter=CardType eq 'cSupplier'" },
      enviar_recebimento: { metodo: "POST", path: "/PurchaseDeliveryNotes" },
      sincronizar_produtos: { metodo: "GET", path: "/Items" },
    },
  },
  bling: {
    base_url: "https://api.bling.com.br/Api/v3",
    auth_tipo: "bearer",
    auth_config: { token: "" },
    endpoints: {
      sincronizar_fornecedores: { metodo: "GET", path: "/contatos?tipo=F" },
      enviar_recebimento: { metodo: "POST", path: "/notasfiscais" },
      sincronizar_produtos: { metodo: "GET", path: "/produtos" },
    },
  },
  generico: {
    base_url: "https://api.exemplo.com",
    auth_tipo: "bearer",
    auth_config: { token: "" },
    endpoints: {},
  },
};

export default function ApiKeysPage() {
  const { isAdmin } = usePermissions();
  const [keys, setKeys] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [openNew, setOpenNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRead, setNewRead] = useState<string[]>([]);
  const [newWrite, setNewWrite] = useState<string[]>([]);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [integracoes, setIntegracoes] = useState<any[]>([]);
  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [openInteg, setOpenInteg] = useState(false);
  const [integForm, setIntegForm] = useState<any>({ nome: "", tipo: "totvs", ...ERP_TEMPLATES.totvs, webhook_secret: "" });
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const load = async () => {
    const [k, l, i, s] = await Promise.all([
      supabase.from("api_keys").select("*").order("data_criacao", { ascending: false }),
      supabase.from("api_logs").select("*").order("data_criacao", { ascending: false }).limit(100),
      supabase.from("integracoes_externas").select("*").order("data_criacao", { ascending: false }),
      supabase.from("integracoes_sync_logs").select("*").order("data_criacao", { ascending: false }).limit(50),
    ]);
    setKeys(k.data || []);
    setLogs(l.data || []);
    setIntegracoes(i.data || []);
    setSyncLogs(s.data || []);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/" replace />;

  const toggleRes = (list: string[], set: (v: string[]) => void, r: string) => {
    set(list.includes(r) ? list.filter(x => x !== r) : [...list, r]);
  };

  const createKey = async () => {
    if (!newName.trim()) { toast.error("Informe o nome"); return; }
    const { data, error } = await supabase.functions.invoke("api-keys-admin", {
      body: { action: "create", payload: { nome: newName, permissoes: { read: newRead, write: newWrite } } },
    });
    if (error || data?.error) { toast.error(data?.error || error?.message || "Erro"); return; }
    setCreatedKey(data.key);
    setNewName(""); setNewRead([]); setNewWrite([]);
    load();
  };

  const toggleActive = async (k: any) => {
    await supabase.from("api_keys").update({ ativo: !k.ativo }).eq("id", k.id);
    load();
  };

  const deleteKey = async (id: string) => {
    if (!confirm("Excluir esta chave? Sistemas que a usam vão parar de funcionar.")) return;
    await supabase.from("api_keys").delete().eq("id", id);
    load();
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const saveIntegracao = async () => {
    if (!integForm.nome.trim()) { toast.error("Informe o nome"); return; }
    const { error } = await supabase.from("integracoes_externas").insert({
      nome: integForm.nome,
      tipo: integForm.tipo,
      base_url: integForm.base_url,
      auth_tipo: integForm.auth_tipo,
      auth_config: integForm.auth_config,
      endpoints: integForm.endpoints,
      webhook_secret: integForm.webhook_secret || null,
      ativo: true,
    });
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Integração criada");
    setOpenInteg(false);
    setIntegForm({ nome: "", tipo: "totvs", ...ERP_TEMPLATES.totvs, webhook_secret: "" });
    load();
  };

  const toggleIntegAtivo = async (i: any) => {
    await supabase.from("integracoes_externas").update({ ativo: !i.ativo }).eq("id", i.id);
    load();
  };

  const deleteInteg = async (id: string) => {
    if (!confirm("Excluir integração?")) return;
    await supabase.from("integracoes_externas").delete().eq("id", id);
    load();
  };

  const testIntegracao = async (i: any, operacao: string) => {
    setTesting(i.id + operacao);
    setTestResult(null);
    const { data, error } = await supabase.functions.invoke("external-proxy", {
      body: { integracao_id: i.id, operacao },
    });
    setTesting(null);
    setTestResult({ integ: i.nome, operacao, data, error: error?.message });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl neon-text">API & Integrações</h1>
        <Button onClick={() => setOpenNew(true)} className="gap-2"><Plus size={16} /> Nova Chave</Button>
      </div>

      <Tabs defaultValue="keys">
        <TabsList>
          <TabsTrigger value="keys">Chaves ({keys.length})</TabsTrigger>
          <TabsTrigger value="integracoes">Integrações ({integracoes.length})</TabsTrigger>
          <TabsTrigger value="logs">Logs ({logs.length})</TabsTrigger>
          <TabsTrigger value="docs">Documentação</TabsTrigger>
          <TabsTrigger value="swagger">Swagger</TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="space-y-3 mt-4">
          {keys.length === 0 && <Card className="p-6 text-center text-muted-foreground">Nenhuma chave criada ainda.</Card>}
          {keys.map(k => (
            <Card key={k.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{k.nome}</span>
                  {k.ativo ? <Badge className="bg-emerald-500/20 text-emerald-300">Ativa</Badge> : <Badge variant="secondary">Revogada</Badge>}
                </div>
                <code className="text-xs text-muted-foreground">{k.key_prefix}…</code>
                <div className="text-xs text-muted-foreground mt-1">
                  {k.total_chamadas} chamadas · Último uso: {k.ultimo_uso ? new Date(k.ultimo_uso).toLocaleString("pt-BR") : "nunca"}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Leitura: {(k.permissoes?.read || []).join(", ") || "—"} · Escrita: {(k.permissoes?.write || []).join(", ") || "—"}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => toggleActive(k)}>
                  {k.ativo ? <><Ban size={14} className="mr-1" />Revogar</> : <><Check size={14} className="mr-1" />Reativar</>}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => deleteKey(k.id)}><Trash2 size={14} /></Button>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="logs" className="space-y-2 mt-4">
          {logs.length === 0 && <Card className="p-6 text-center text-muted-foreground">Nenhuma chamada registrada.</Card>}
          {logs.map(l => (
            <Card key={l.id} className="p-3 text-sm flex flex-wrap items-center gap-3">
              <Badge variant={l.status_code < 300 ? "default" : "destructive"}>{l.status_code}</Badge>
              <span className="font-mono text-xs">{l.method}</span>
              <span className="font-mono text-xs flex-1 truncate">{l.endpoint}</span>
              <span className="text-xs text-muted-foreground">{l.api_key_nome}</span>
              <span className="text-xs text-muted-foreground">{new Date(l.data_criacao).toLocaleString("pt-BR")}</span>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="docs" className="mt-4 space-y-4">
          <Card className="p-4 space-y-3">
            <h3 className="font-heading text-lg">Como usar</h3>
            <p className="text-sm text-muted-foreground">URL base:</p>
            <code className="block bg-secondary p-2 rounded text-xs break-all">{API_BASE}</code>
            <p className="text-sm text-muted-foreground mt-3">Header obrigatório em todas as chamadas:</p>
            <code className="block bg-secondary p-2 rounded text-xs">x-api-key: gnd_live_xxxxxxxx...</code>
          </Card>

          <Card className="p-4 space-y-2">
            <h3 className="font-heading text-lg">Exemplos</h3>
            <p className="text-sm font-semibold mt-2">Listar recebimentos (paginado)</p>
            <code className="block bg-secondary p-2 rounded text-xs whitespace-pre-wrap break-all">
{`curl "${API_BASE}/recebimentos?page=1&limit=20" \\
  -H "x-api-key: SUA_CHAVE"`}
            </code>
            <p className="text-sm font-semibold mt-3">Buscar com filtros</p>
            <code className="block bg-secondary p-2 rounded text-xs whitespace-pre-wrap break-all">
{`curl "${API_BASE}/recebimentos?fornecedor=eq.ACME&data_prevista=gte.2026-01-01" \\
  -H "x-api-key: SUA_CHAVE"`}
            </code>
            <p className="text-sm font-semibold mt-3">Obter um registro</p>
            <code className="block bg-secondary p-2 rounded text-xs whitespace-pre-wrap break-all">
{`curl "${API_BASE}/recebimentos/<uuid>" -H "x-api-key: SUA_CHAVE"`}
            </code>
            <p className="text-sm font-semibold mt-3">Criar</p>
            <code className="block bg-secondary p-2 rounded text-xs whitespace-pre-wrap break-all">
{`curl -X POST "${API_BASE}/recebimentos" \\
  -H "x-api-key: SUA_CHAVE" -H "Content-Type: application/json" \\
  -d '{"fornecedor":"ACME","numero_nf":"123","data_prevista":"2026-06-01"}'`}
            </code>
            <p className="text-sm font-semibold mt-3">Atualizar</p>
            <code className="block bg-secondary p-2 rounded text-xs whitespace-pre-wrap break-all">
{`curl -X PATCH "${API_BASE}/recebimentos/<uuid>" \\
  -H "x-api-key: SUA_CHAVE" -H "Content-Type: application/json" \\
  -d '{"observacoes":"Atualizado via API"}'`}
            </code>
            <p className="text-sm font-semibold mt-3">Excluir</p>
            <code className="block bg-secondary p-2 rounded text-xs whitespace-pre-wrap break-all">
{`curl -X DELETE "${API_BASE}/recebimentos/<uuid>" -H "x-api-key: SUA_CHAVE"`}
            </code>
          </Card>

          <Card className="p-4 space-y-2">
            <h3 className="font-heading text-lg">Operadores de filtro</h3>
            <p className="text-xs">Formato: <code>?coluna=operador.valor</code></p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-5">
              <li><b>eq</b>, <b>neq</b> — igual / diferente</li>
              <li><b>gt</b>, <b>gte</b>, <b>lt</b>, <b>lte</b> — maior/menor</li>
              <li><b>like</b>, <b>ilike</b> — texto (use %)</li>
              <li><b>in</b> — lista: <code>?id=in.(uuid1,uuid2)</code></li>
              <li><b>order</b>: <code>?order=data_criacao.desc</code></li>
            </ul>
          </Card>

          <Card className="p-4 space-y-2">
            <h3 className="font-heading text-lg">Recursos disponíveis</h3>
            <div className="flex flex-wrap gap-2">
              {RESOURCES.map(r => <Badge key={r} variant="secondary">{r}</Badge>)}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="integracoes" className="space-y-3 mt-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <p className="text-sm text-muted-foreground">Conecte ERPs externos (TOTVS, SAP, Bling) ou qualquer API. Bidirecional: chame via proxy ou receba via webhook.</p>
            <Button onClick={() => setOpenInteg(true)} className="gap-2"><Plus size={16} /> Nova Integração</Button>
          </div>

          {integracoes.length === 0 && <Card className="p-6 text-center text-muted-foreground">Nenhuma integração configurada.</Card>}
          {integracoes.map(i => (
            <Card key={i.id} className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{i.nome}</span>
                    <Badge variant="outline" className="uppercase text-xs">{i.tipo}</Badge>
                    {i.ativo ? <Badge className="bg-emerald-500/20 text-emerald-300">Ativa</Badge> : <Badge variant="secondary">Inativa</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">{i.base_url}</div>
                  <div className="text-xs text-muted-foreground">{i.total_chamadas} chamadas · Auth: {i.auth_tipo}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => toggleIntegAtivo(i)}>{i.ativo ? "Desativar" : "Ativar"}</Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteInteg(i.id)}><Trash2 size={14} /></Button>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold mb-1">Webhook URL (configure no ERP para enviar eventos):</p>
                <div className="flex gap-2">
                  <code className="flex-1 bg-secondary p-2 rounded text-xs break-all">{WEBHOOK_BASE}/{i.id}</code>
                  <Button size="sm" variant="outline" onClick={() => copy(`${WEBHOOK_BASE}/${i.id}`)}><Copy size={14} /></Button>
                </div>
                {i.webhook_secret && <p className="text-xs text-muted-foreground mt-1">Header obrigatório: <code>x-webhook-secret: {i.webhook_secret}</code></p>}
              </div>

              <div>
                <p className="text-xs font-semibold mb-1">Operações (clique para testar):</p>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(i.endpoints || {}).filter(k => k !== "webhook_map").map(op => (
                    <Button key={op} size="sm" variant="outline" disabled={!i.ativo || testing === i.id + op}
                      onClick={() => testIntegracao(i, op)}>
                      {testing === i.id + op ? "Testando…" : `▶ ${op}`}
                    </Button>
                  ))}
                  {Object.keys(i.endpoints || {}).filter(k => k !== "webhook_map").length === 0 && (
                    <span className="text-xs text-muted-foreground">Nenhuma operação mapeada</span>
                  )}
                </div>
              </div>
            </Card>
          ))}

          {testResult && (
            <Card className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Resultado: {testResult.integ} → {testResult.operacao}</h4>
                <Button size="sm" variant="ghost" onClick={() => setTestResult(null)}>Fechar</Button>
              </div>
              <pre className="text-xs bg-secondary p-3 rounded max-h-64 overflow-auto">{JSON.stringify(testResult.data || testResult.error, null, 2)}</pre>
            </Card>
          )}

          {syncLogs.length > 0 && (
            <Card className="p-4">
              <h4 className="font-semibold mb-2">Últimas sincronizações</h4>
              <div className="space-y-1">
                {syncLogs.slice(0, 20).map(l => (
                  <div key={l.id} className="flex items-center gap-2 text-xs">
                    <Badge variant={l.sucesso ? "default" : "destructive"}>{l.status_code || "ERR"}</Badge>
                    <span className="font-mono">{l.direcao}</span>
                    <span className="flex-1 truncate">{l.integracao_nome} · {l.operacao}</span>
                    <span className="text-muted-foreground">{l.duracao_ms}ms</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="swagger" className="mt-4 space-y-3">
          <Card className="p-3 flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-sm font-semibold">Spec OpenAPI 3.0</p>
              <code className="text-xs text-muted-foreground break-all">{OPENAPI_URL}</code>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => copy(OPENAPI_URL)}><Copy size={14} className="mr-1" />URL</Button>
              <a href={OPENAPI_URL} download="granado-openapi.json"><Button size="sm">Download spec</Button></a>
            </div>
          </Card>
          <div className="bg-white rounded-lg overflow-hidden swagger-wrapper">
            <SwaggerUI url={OPENAPI_URL} />
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={openNew} onOpenChange={(o) => { setOpenNew(o); if (!o) setCreatedKey(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{createdKey ? "Chave gerada — copie agora!" : "Nova Chave de API"}</DialogTitle></DialogHeader>
          {createdKey ? (
            <div className="space-y-3">
              <p className="text-sm text-amber-400">Esta chave será mostrada apenas uma vez. Copie e guarde em local seguro.</p>
              <div className="flex gap-2">
                <code className="flex-1 bg-secondary p-3 rounded text-xs break-all">{createdKey}</code>
                <Button onClick={() => copy(createdKey)}><Copy size={16} /></Button>
              </div>
              <Button onClick={() => { setOpenNew(false); setCreatedKey(null); }} className="w-full">Fechar</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Nome da integração</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex.: ERP TOTVS" />
              </div>
              <div>
                <Label>Permissões de Leitura</Label>
                <div className="grid grid-cols-2 gap-2 mt-2 max-h-48 overflow-y-auto p-2 bg-secondary/30 rounded">
                  {RESOURCES.map(r => (
                    <label key={"r"+r} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={newRead.includes(r)} onCheckedChange={() => toggleRes(newRead, setNewRead, r)} />
                      {r}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label>Permissões de Escrita (criar/editar/excluir)</Label>
                <div className="grid grid-cols-2 gap-2 mt-2 max-h-48 overflow-y-auto p-2 bg-secondary/30 rounded">
                  {RESOURCES.map(r => (
                    <label key={"w"+r} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={newWrite.includes(r)} onCheckedChange={() => toggleRes(newWrite, setNewWrite, r)} />
                      {r}
                    </label>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenNew(false)}>Cancelar</Button>
                <Button onClick={createKey}>Gerar Chave</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}