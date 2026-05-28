import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Receptor de webhooks dos ERPs (TOTVS/SAP/Bling).
 * URL pública: /functions/v1/external-webhook/{integracao_id}
 * Header opcional: x-webhook-secret (valida contra integracoes_externas.webhook_secret se definido)
 *
 * Mapeia o payload recebido para tabelas internas via integ.endpoints.webhook_map:
 *   { "evento": { tabela: "recebimentos", mapeamento: { fornecedor: "supplier.name", numero_nf: "invoice.id" } } }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const integracaoId = parts[parts.length - 1];
  if (!integracaoId || integracaoId === "external-webhook") return json({ error: "integracao_id ausente no path" }, 400);

  const { data: integ } = await supabase.from("integracoes_externas").select("*").eq("id", integracaoId).eq("ativo", true).maybeSingle();
  if (!integ) return json({ error: "Integração não encontrada" }, 404);

  // Valida secret opcional
  if (integ.webhook_secret) {
    const provided = req.headers.get("x-webhook-secret");
    if (provided !== integ.webhook_secret) return json({ error: "Secret inválido" }, 401);
  }

  let body: any;
  try { body = await req.json(); } catch { body = await req.text(); }

  const evento = body?.evento || body?.event || body?.type || "default";
  const map = (integ.endpoints?.webhook_map || {})[evento];

  let registroId: string | null = null;
  let erro: string | null = null;

  if (map?.tabela && map?.mapeamento) {
    try {
      const dado: Record<string, any> = {};
      for (const [destCol, sourcePath] of Object.entries(map.mapeamento as Record<string, string>)) {
        dado[destCol] = getPath(body, sourcePath);
      }
      const { data, error } = await supabase.from(map.tabela).insert(dado).select("id").single();
      if (error) throw error;
      registroId = data.id;
    } catch (e) {
      erro = (e as Error).message;
    }
  }

  supabase.from("integracoes_sync_logs").insert({
    integracao_id: integ.id,
    integracao_nome: integ.nome,
    operacao: `webhook:${evento}`,
    direcao: "inbound",
    status_code: erro ? 500 : 200,
    sucesso: !erro,
    payload_req: body,
    payload_resp: registroId ? { id: registroId, tabela: map?.tabela } : null,
    erro,
    duracao_ms: 0,
  }).then(() => {});

  return json({ ok: !erro, registro_id: registroId, erro }, erro ? 500 : 200);
});

function getPath(obj: any, path: string): any {
  return path.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}