import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user_id, nova_senha } = await req.json();
    if (!user_id || !nova_senha) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios não preenchidos" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (nova_senha.length < 6) {
      return new Response(JSON.stringify({ error: "Senha deve ter pelo menos 6 caracteres" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: callerProfile } = await supabaseAdmin.from("usuarios").select("cargo").eq("user_id", caller.id).single();
    if (callerProfile?.cargo !== "Master") {
      return new Response(JSON.stringify({ error: "Apenas o Master pode redefinir senhas" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Reset the user's password
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      password: nova_senha,
    });

    if (error) {
      console.error("Reset password error:", error);
      return new Response(JSON.stringify({ error: "Falha ao redefinir senha." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Erro interno do servidor." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
