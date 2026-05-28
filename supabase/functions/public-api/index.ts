import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

const ALLOWED_RESOURCES = [
  "recebimentos", "armazenagem", "solicitacoes_compras",
  "fornecedores_urgencia", "fornecedores_nao_vieram",
  "portaria_registros", "veiculos", "motoristas",
  "ocorrencias_armazenagem", "ocorrencias_tipos",
  "fluxo_financeiro", "valores_descarga", "relatorios_mensais",
  "etiquetas_pallet",
];

const FILTER_OPS: Record<string, string> = {
  eq: "eq", neq: "neq", gt: "gt", gte: "gte", lt: "lt", lte: "lte",
  like: "like", ilike: "ilike", in: "in", is: "is",
};

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const url = new URL(req.url);
  // Path format: /public-api/v1/{resource}/{id?}
  const parts = url.pathname.split("/").filter(Boolean);
  const vIdx = parts.indexOf("v1");
  if (vIdx === -1 || !parts[vIdx + 1]) {
    return jsonResponse({ error: "Use /public-api/v1/{recurso}" }, 404);
  }
  const resource = parts[vIdx + 1];
  const recordId = parts[vIdx + 2];

  // OpenAPI spec — public, no auth
  if (resource === "openapi.json") {
    return jsonResponse(buildOpenApiSpec(url.origin + url.pathname.replace(/\/openapi\.json.*$/, "")));
  }

  // Authentication
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return jsonResponse({ error: "Header x-api-key obrigatório" }, 401);

  const keyHash = await sha256(apiKey);
  const { data: keyRow } = await supabase
    .from("api_keys")
    .select("*")
    .eq("key_hash", keyHash)
    .eq("ativo", true)
    .maybeSingle();

  if (!keyRow) return jsonResponse({ error: "Chave inválida ou inativa" }, 401);
  if (keyRow.data_expiracao && new Date(keyRow.data_expiracao) < new Date()) {
    return jsonResponse({ error: "Chave expirada" }, 401);
  }

  if (!ALLOWED_RESOURCES.includes(resource)) {
    return jsonResponse({ error: `Recurso '${resource}' não disponível` }, 404);
  }

  const isWrite = ["POST", "PATCH", "DELETE", "PUT"].includes(req.method);
  const perms = (keyRow.permissoes || {}) as { read?: string[]; write?: string[] };
  const hasAccess = isWrite
    ? (perms.write || []).includes(resource) || (perms.write || []).includes("*")
    : (perms.read || []).includes(resource) || (perms.read || []).includes("*");

  if (!hasAccess) {
    await logCall(supabase, keyRow, req, resource, 403);
    return jsonResponse({ error: "Sem permissão para esse recurso/método" }, 403);
  }

  let status = 200;
  let body: unknown;

  try {
    if (req.method === "GET") {
      if (recordId) {
        const { data, error } = await supabase.from(resource).select("*").eq("id", recordId).maybeSingle();
        if (error) throw error;
        body = { data, error: null };
        if (!data) status = 404;
      } else {
        const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
        const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "50")));
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let q = supabase.from(resource).select("*", { count: "exact" });
        for (const [key, raw] of url.searchParams.entries()) {
          if (["page", "limit", "order"].includes(key)) continue;
          const m = raw.match(/^(\w+)\.(.+)$/);
          if (m && FILTER_OPS[m[1]]) {
            // @ts-ignore dynamic op
            q = q[FILTER_OPS[m[1]]](key, m[2]);
          } else {
            q = q.eq(key, raw);
          }
        }
        const order = url.searchParams.get("order");
        if (order) {
          const [col, dir] = order.split(".");
          q = q.order(col, { ascending: dir !== "desc" });
        } else {
          q = q.order("data_criacao", { ascending: false });
        }
        const { data, error, count } = await q.range(from, to);
        if (error) throw error;
        body = { data, error: null, meta: { count, page, limit } };
      }
    } else if (req.method === "POST") {
      const payload = await req.json();
      const { data, error } = await supabase.from(resource).insert(payload).select().single();
      if (error) throw error;
      body = { data, error: null };
      status = 201;
    } else if (req.method === "PATCH" || req.method === "PUT") {
      if (!recordId) { status = 400; body = { error: "ID obrigatório no path" }; }
      else {
        const payload = await req.json();
        const { data, error } = await supabase.from(resource).update(payload).eq("id", recordId).select().single();
        if (error) throw error;
        body = { data, error: null };
      }
    } else if (req.method === "DELETE") {
      if (!recordId) { status = 400; body = { error: "ID obrigatório no path" }; }
      else {
        const { error } = await supabase.from(resource).delete().eq("id", recordId);
        if (error) throw error;
        body = { data: { deleted: true }, error: null };
      }
    } else {
      status = 405;
      body = { error: "Método não suportado" };
    }
  } catch (e) {
    status = 500;
    body = { error: (e as Error).message };
  }

  // Update usage stats + log (fire and forget)
  supabase.from("api_keys").update({
    ultimo_uso: new Date().toISOString(),
    total_chamadas: (keyRow.total_chamadas || 0) + 1,
  }).eq("id", keyRow.id).then(() => {});

  logCall(supabase, keyRow, req, resource + (recordId ? `/${recordId}` : ""), status).catch(() => {});

  return jsonResponse(body, status);
});

async function logCall(supabase: any, keyRow: any, req: Request, endpoint: string, status: number) {
  await supabase.from("api_logs").insert({
    api_key_id: keyRow.id,
    api_key_nome: keyRow.nome,
    endpoint: `/v1/${endpoint}`,
    method: req.method,
    status_code: status,
    ip: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
    user_agent: req.headers.get("user-agent"),
  });
}

function buildOpenApiSpec(baseUrl: string) {
  const resourceSchemas: Record<string, any> = {
    recebimentos: { fornecedor: "string", numero_nf: "string", data_prevista: "date", horario_agenda: "time", toneladas: "number", status: "string" },
    armazenagem: { recebimento_id: "uuid", status: "string", quantidade_volumes: "integer" },
    solicitacoes_compras: { fornecedor: "string", volumes: "integer", data_sugerida: "date", status: "string" },
    fornecedores_urgencia: { nome_fornecedor: "string", contagem_urgencias: "integer" },
    fornecedores_nao_vieram: { fornecedor: "string", motivo: "string", multa: "number" },
    portaria_registros: { veiculo_nome: "string", veiculo_placa: "string", motorista_nome: "string", km_chegada: "string" },
    veiculos: { nome: "string", placa: "string", modelo: "string" },
    motoristas: { nome: "string" },
    ocorrencias_armazenagem: { fornecedor: "string", ocorrencia: "string" },
    ocorrencias_tipos: { nome: "string" },
    fluxo_financeiro: { tipo: "string", descricao: "string", valor: "number", mes_referencia: "date" },
    valores_descarga: { valor_por_pallet: "number", valor_por_caixa: "number", valor_por_tonelada: "number", valor_multa: "number" },
    relatorios_mensais: { fornecedor: "string", mes_referencia: "date", total_descargas: "integer", total_volumes: "integer" },
    etiquetas_pallet: { descricao: "string", quantidade_caixa: "integer", validade: "date", peso: "string", usuario: "string" },
  };

  const paths: Record<string, any> = {};
  for (const r of Object.keys(resourceSchemas)) {
    const props: Record<string, any> = { id: { type: "string", format: "uuid" }, data_criacao: { type: "string", format: "date-time" } };
    for (const [k, t] of Object.entries(resourceSchemas[r])) {
      props[k] = t === "integer" ? { type: "integer" }
              : t === "number" ? { type: "number" }
              : t === "date" ? { type: "string", format: "date" }
              : t === "time" ? { type: "string", format: "time" }
              : t === "uuid" ? { type: "string", format: "uuid" }
              : { type: "string" };
    }
    const schemaRef = { type: "object", properties: props };
    paths[`/${r}`] = {
      get: {
        summary: `Listar ${r}`, tags: [r],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 200 } },
          { name: "order", in: "query", description: "Ex: data_criacao.desc", schema: { type: "string" } },
        ],
        responses: { "200": { description: "OK", content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: schemaRef }, meta: { type: "object" } } } } } } },
      },
      post: {
        summary: `Criar ${r}`, tags: [r],
        requestBody: { required: true, content: { "application/json": { schema: schemaRef } } },
        responses: { "201": { description: "Criado" } },
      },
    };
    paths[`/${r}/{id}`] = {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get: { summary: `Obter ${r}`, tags: [r], responses: { "200": { description: "OK" }, "404": { description: "Não encontrado" } } },
      patch: { summary: `Atualizar ${r}`, tags: [r], requestBody: { required: true, content: { "application/json": { schema: schemaRef } } }, responses: { "200": { description: "Atualizado" } } },
      delete: { summary: `Excluir ${r}`, tags: [r], responses: { "200": { description: "Excluído" } } },
    };
  }

  return {
    openapi: "3.0.3",
    info: {
      title: "Granado API",
      description: "API REST do sistema Granado Distribuidora. Autenticação via header `x-api-key`.",
      version: "1.0.0",
    },
    servers: [{ url: baseUrl, description: "Produção" }],
    components: {
      securitySchemes: { ApiKeyAuth: { type: "apiKey", in: "header", name: "x-api-key" } },
    },
    security: [{ ApiKeyAuth: [] }],
    tags: Object.keys(resourceSchemas).map(r => ({ name: r })),
    paths,
  };
}