import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Proxy genérico para sistemas externos (TOTVS Protheus, SAP Business One, Bling, custom).
 *
 * Body esperado:
 * {
 *   integracao_id: "uuid",
 *   operacao: "sincronizar_fornecedores" | "enviar_recebimento" | "custom",
 *   metodo?: "GET" | "POST" | "PATCH" | "DELETE",   // p/ custom
 *   endpoint?: "/path",                              // p/ custom (sobrescreve mapping)
 *   payload?: any,
 *   query?: Record<string,string>
 * }
 *
 * Autenticação suportada (auth_tipo na tabela integracoes_externas):
 *  - oauth2:        { token_url, client_id, client_secret, scope?, grant_type? }
 *  - basic:         { username, password }
 *  - bearer:        { token }
 *  - apikey_header: { header_name, key }
 *  - cookie:        { login_url, login_body, cookie_name? }   (ex.: SAP B1 Service Layer)
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // Auth: aceita JWT do usuário OU x-api-key da public API
  const apiKey = req.headers.get("x-api-key");
  const authHeader = req.headers.get("Authorization");
  let authorized = false;

  if (apiKey) {
    const hash = await sha256(apiKey);
    const { data } = await supabase.from("api_keys").select("id,ativo").eq("key_hash", hash).eq("ativo", true).maybeSingle();
    if (data) authorized = true;
  } else if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: cl } = await userClient.auth.getClaims(token);
    if (cl?.claims?.sub) {
      const { data: u } = await supabase.from("usuarios").select("cargo").eq("user_id", cl.claims.sub).maybeSingle();
      if (u?.cargo === "Master") authorized = true;
    }
  }

  if (!authorized) return json({ error: "Unauthorized" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

  const { integracao_id, operacao, metodo, endpoint, payload, query } = body || {};
  if (!integracao_id || !operacao) return json({ error: "integracao_id e operacao são obrigatórios" }, 400);

  const { data: integ, error: ie } = await supabase
    .from("integracoes_externas").select("*").eq("id", integracao_id).eq("ativo", true).maybeSingle();
  if (ie || !integ) return json({ error: "Integração não encontrada ou inativa" }, 404);

  const started = Date.now();
  let status = 0; let respBody: any = null; let erro: string | null = null;

  try {
    // Resolve o endpoint do mapeamento
    const mapping = (integ.endpoints || {}) as Record<string, { metodo?: string; path: string }>;
    let resolvedPath: string;
    let resolvedMethod: string;

    if (operacao === "custom") {
      if (!endpoint) throw new Error("endpoint é obrigatório para operação custom");
      resolvedPath = endpoint;
      resolvedMethod = (metodo || "GET").toUpperCase();
    } else {
      const m = mapping[operacao];
      if (!m) throw new Error(`Operação '${operacao}' não mapeada nesta integração`);
      resolvedPath = m.path;
      resolvedMethod = (m.metodo || metodo || "GET").toUpperCase();
    }

    // Build URL com query
    const url = new URL(resolvedPath.startsWith("http") ? resolvedPath : integ.base_url.replace(/\/$/, "") + "/" + resolvedPath.replace(/^\//, ""));
    if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));

    // Auth
    const headers: Record<string, string> = { "Content-Type": "application/json", ...(integ.headers_extras || {}) };
    const cfg = integ.auth_config || {};

    if (integ.auth_tipo === "bearer") {
      headers["Authorization"] = `Bearer ${cfg.token}`;
    } else if (integ.auth_tipo === "basic") {
      headers["Authorization"] = "Basic " + btoa(`${cfg.username}:${cfg.password}`);
    } else if (integ.auth_tipo === "apikey_header") {
      headers[cfg.header_name || "x-api-key"] = cfg.key;
    } else if (integ.auth_tipo === "oauth2") {
      const tokenRes = await fetch(cfg.token_url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: cfg.grant_type || "client_credentials",
          client_id: cfg.client_id,
          client_secret: cfg.client_secret,
          ...(cfg.scope ? { scope: cfg.scope } : {}),
        }),
      });
      const tokenJson = await tokenRes.json();
      if (!tokenJson.access_token) throw new Error("Falha OAuth2: " + JSON.stringify(tokenJson));
      headers["Authorization"] = `Bearer ${tokenJson.access_token}`;
    } else if (integ.auth_tipo === "cookie") {
      // Ex.: SAP B1 Service Layer — POST /Login com { CompanyDB, UserName, Password }
      const loginRes = await fetch(cfg.login_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg.login_body || {}),
      });
      const setCookie = loginRes.headers.get("set-cookie") || "";
      if (!setCookie) throw new Error("Login cookie não retornado");
      headers["Cookie"] = setCookie.split(";")[0];
    }

    const fetchOpts: RequestInit = { method: resolvedMethod, headers };
    if (payload && !["GET", "HEAD"].includes(resolvedMethod)) fetchOpts.body = JSON.stringify(payload);

    const resp = await fetch(url.toString(), fetchOpts);
    status = resp.status;
    const text = await resp.text();
    try { respBody = JSON.parse(text); } catch { respBody = text; }

    if (!resp.ok) erro = `HTTP ${status}`;
  } catch (e) {
    erro = (e as Error).message;
    status = status || 500;
  }

  // Log + stats
  supabase.from("integracoes_sync_logs").insert({
    integracao_id: integ.id,
    integracao_nome: integ.nome,
    operacao,
    direcao: "outbound",
    status_code: status,
    sucesso: !erro,
    payload_req: payload || null,
    payload_resp: typeof respBody === "string" ? { raw: respBody.slice(0, 4000) } : respBody,
    erro,
    duracao_ms: Date.now() - started,
  }).then(() => {});

  supabase.from("integracoes_externas").update({
    ultimo_uso: new Date().toISOString(),
    total_chamadas: (integ.total_chamadas || 0) + 1,
  }).eq("id", integ.id).then(() => {});

  return json({ data: respBody, status, erro }, erro ? (status >= 400 ? status : 502) : 200);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}