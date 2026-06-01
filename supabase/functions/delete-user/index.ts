import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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
      return new Response(JSON.stringify({ error: "Apenas o Master pode excluir usuários" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (caller.id === user_id) {
      return new Response(JSON.stringify({ error: "Você não pode excluir a si mesmo" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Delete profile first
    const { error: profileErr } = await supabaseAdmin.from("usuarios").delete().eq("user_id", user_id);
    if (profileErr) {
      console.error("Profile delete error:", profileErr);
    }

    // Delete auth user
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (authErr) {
      console.error("Auth delete error:", authErr);
      return new Response(JSON.stringify({ error: "Falha ao excluir usuário." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Erro interno do servidor." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});