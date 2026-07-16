import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TZ = "America/Sao_Paulo";

// Horário de funcionamento da Doca 2 (recebimento) em minutos desde 00:00
// dow: 0=Dom, 1=Seg ... 5=Sex, 6=Sáb
function janelasDoDia(dow: number): Array<[number, number]> {
  if (dow >= 1 && dow <= 4) {
    return [[8 * 60, 12 * 60 + 30], [13 * 60 + 30, 15 * 60]];
  }
  if (dow === 5) {
    return [[8 * 60, 12 * 60 + 30], [13 * 60 + 30, 14 * 60]];
  }
  return []; // Sáb/Dom fechado
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}
function fromMin(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

// Retorna a data (YYYY-MM-DD) em SP para "hoje + offset dias"
function dataSP(offsetDias: number): { iso: string; dow: number; label: string } {
  const agora = new Date();
  const spNow = new Date(agora.toLocaleString("en-US", { timeZone: TZ }));
  spNow.setDate(spNow.getDate() + offsetDias);
  const iso = spNow.toISOString().split("T")[0];
  const dow = spNow.getDay();
  const label = spNow.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
  return { iso, dow, label };
}

function subtrairOcupados(janelas: Array<[number, number]>, ocupados: Array<[number, number]>): Array<[number, number]> {
  let livres: Array<[number, number]> = [...janelas];
  for (const [oi, of_] of ocupados) {
    const novas: Array<[number, number]> = [];
    for (const [li, lf] of livres) {
      if (of_ <= li || oi >= lf) { novas.push([li, lf]); continue; }
      if (oi > li) novas.push([li, Math.min(oi, lf)]);
      if (of_ < lf) novas.push([Math.max(of_, li), lf]);
    }
    livres = novas.filter(([a, b]) => b - a > 0);
  }
  return livres;
}

function janelasQueCabem(livres: Array<[number, number]>, duracaoMin: number): Array<[number, number]> {
  return livres.filter(([a, b]) => b - a >= duracaoMin).map(([a, b]) => [a, a + duracaoMin] as [number, number]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada");

    const body = await req.json();
    const fornecedor: string = body.fornecedor || "";
    const volumes: number = Number(body.volumes || body.quantidade_volumes || 0);
    const pedidoLivre: string = body.pedido_livre || body.observacao || "";

    if (!fornecedor) throw new Error("Campo 'fornecedor' obrigatório");
    if (!volumes || volumes <= 0) throw new Error("Campo 'volumes' obrigatório e > 0");

    const duracaoMin = volumes >= 1000 ? 150 : 90;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // próximos 14 dias
    const hoje = dataSP(0).iso;
    const ate = dataSP(14).iso;

    const { data: agendados, error } = await supabase
      .from("recebimentos")
      .select("data_prevista, horario_agenda, quantidade_volumes, fornecedor, status")
      .gte("data_prevista", hoje)
      .lte("data_prevista", ate)
      .not("status", "in", "(FINALIZADO,NAO_VEIO)")
      .not("horario_agenda", "is", null);

    if (error) throw error;

    // Monta mapa de ocupação
    type Dia = { iso: string; dow: number; label: string; janelas: [number, number][]; ocupados: [number, number][]; livres: [number, number][]; sugestoes: [number, number][] };
    const dias: Dia[] = [];
    for (let i = 0; i <= 14; i++) {
      const d = dataSP(i);
      const janelas = janelasDoDia(d.dow);
      if (janelas.length === 0) continue;
      const ocupadosDoDia: [number, number][] = (agendados || [])
        .filter((r: any) => r.data_prevista === d.iso && r.horario_agenda)
        .map((r: any) => {
          const ini = toMin(r.horario_agenda.slice(0, 5));
          const dur = (Number(r.quantidade_volumes) || 0) >= 1000 ? 150 : 90;
          return [ini, ini + dur] as [number, number];
        });
      const livres = subtrairOcupados(janelas, ocupadosDoDia);
      const sugestoes = janelasQueCabem(livres, duracaoMin);
      dias.push({ ...d, janelas, ocupados: ocupadosDoDia, livres, sugestoes });
    }

    // Se hoje for o dia atual, remove slots já passados
    const nowSP = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
    const minutosAgora = nowSP.getHours() * 60 + nowSP.getMinutes();
    if (dias[0]?.iso === hoje) {
      dias[0].sugestoes = dias[0].sugestoes.filter(([ini]) => ini > minutosAgora + 15);
    }

    // Contexto textual pro Claude
    const contextoDias = dias.map(d => {
      const janelasStr = d.janelas.map(([a, b]) => `${fromMin(a)}-${fromMin(b)}`).join(", ");
      const ocupStr = d.ocupados.length ? d.ocupados.map(([a, b]) => `${fromMin(a)}-${fromMin(b)}`).join(", ") : "nenhum";
      const sugStr = d.sugestoes.length ? d.sugestoes.slice(0, 6).map(([a, b]) => `${fromMin(a)}-${fromMin(b)}`).join(", ") : "sem espaço";
      return `- ${d.label} (${d.iso}): horário útil ${janelasStr} | ocupado ${ocupStr} | slots livres p/ ${duracaoMin}min: ${sugStr}`;
    }).join("\n");

    const prompt = `Você é assistente de agendamento de descarga da Doca 2 (única doca de recebimento, sequencial, sem sobreposição).

PEDIDO ATUAL:
- Fornecedor: ${fornecedor}
- Volumes: ${volumes} (duração estimada: ${duracaoMin} min = ${Math.floor(duracaoMin/60)}h${duracaoMin%60 ? (duracaoMin%60)+'min':''})
- Pedido/restrição do fornecedor: "${pedidoLivre || 'nenhum'}"

AGENDA DOS PRÓXIMOS 14 DIAS (fuso America/Sao_Paulo, hoje é ${hoje}):
${contextoDias}

REGRAS:
1. Priorize o dia mais próximo com slot livre.
2. Se o fornecedor mencionou restrição (ex: "até quinta", "só de manhã"), respeite.
3. Evite deixar buracos pequenos (<45min) inutilizáveis. Se possível, encaixe adjacente a um agendamento existente.
4. Nunca sugira horário fora dos slots livres listados.
5. Retorne SOMENTE JSON válido no formato:
{
  "sugestao_principal": { "data": "YYYY-MM-DD", "horario_inicio": "HH:MM", "horario_fim": "HH:MM", "justificativa": "..." },
  "sugestao_alternativa": { "data": "YYYY-MM-DD", "horario_inicio": "HH:MM", "horario_fim": "HH:MM", "justificativa": "..." }
}`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Anthropic ${resp.status}: ${err}`);
    }

    const data = await resp.json();
    const texto: string = data.content?.[0]?.text || "";
    const match = texto.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Resposta do modelo sem JSON: " + texto);
    const sugestao = JSON.parse(match[0]);

    return new Response(JSON.stringify({
      duracao_estimada_min: duracaoMin,
      ...sugestao,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});