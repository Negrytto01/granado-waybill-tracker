import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function generateKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const raw = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  return `gnd_live_${raw}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claims?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // Check is_admin
  const userId = claims.claims.sub;
  const { data: isAdminData } = await admin.rpc("is_admin", { _user_id: userId });
  if (!isAdminData) {
    return new Response(JSON.stringify({ error: "Apenas Master" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { action, payload } = await req.json();

    if (action === "create") {
      const key = generateKey();
      const hash = await sha256(key);
      const prefix = key.substring(0, 16);
      const { data: usuario } = await admin.from("usuarios").select("nome").eq("user_id", userId).maybeSingle();

      const { data, error } = await admin.from("api_keys").insert({
        nome: payload.nome,
        key_hash: hash,
        key_prefix: prefix,
        permissoes: payload.permissoes || { read: [], write: [] },
        data_expiracao: payload.data_expiracao || null,
        criado_por: usuario?.nome || "Master",
        criado_por_user_id: userId,
      }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ data, key }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});