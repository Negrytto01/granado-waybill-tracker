import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Sparkles, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type Msg =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; sugestao?: any; extraidos?: any };

export default function FloatingAgendaChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "assistant",
      text:
        "Oi! Me diga o que precisa agendar. Ex.: \"preciso agendar 800 volumes da Bauducco essa semana, só de manhã\".",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, open]);

  const send = async () => {
    const texto = input.trim();
    if (!texto || loading) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text: texto }]);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("assistente-agenda", {
        body: { texto_livre: texto },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const d: any = data;
      const p = d.sugestao_principal;
      const a = d.sugestao_alternativa;
      const fmtDate = (iso: string) => {
        const [y, mo, dd] = iso.split("-");
        return `${dd}/${mo}/${y}`;
      };
      const linhas = [
        d.dados_extraidos?.fornecedor
          ? `Entendi: ${d.dados_extraidos.fornecedor} • ${d.dados_extraidos.volumes} volumes${
              d.dados_extraidos.restricoes ? ` • ${d.dados_extraidos.restricoes}` : ""
            }`
          : "",
        "",
        `📅 Sugestão principal: ${fmtDate(p.data)} das ${p.horario_inicio} às ${p.horario_fim}`,
        p.justificativa ? `↳ ${p.justificativa}` : "",
        "",
        a
          ? `Alternativa: ${fmtDate(a.data)} das ${a.horario_inicio} às ${a.horario_fim}`
          : "",
        a?.justificativa ? `↳ ${a.justificativa}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      setMsgs((m) => [
        ...m,
        { role: "assistant", text: linhas, sugestao: d, extraidos: d.dados_extraidos },
      ]);
    } catch (e: any) {
      setMsgs((m) => [
        ...m,
        { role: "assistant", text: e.message || "Não consegui gerar sugestão. Tente reformular." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const usar = (sug: any, extra: any, alt = false) => {
    const s = alt ? sug.sugestao_alternativa : sug.sugestao_principal;
    if (!s) return;
    window.dispatchEvent(
      new CustomEvent("agenda:prefill", {
        detail: {
          fornecedor: extra?.fornecedor || "",
          volumes: extra?.volumes || 0,
          data: s.data,
          horario: s.horario_inicio,
        },
      })
    );
    setOpen(false);
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition"
          title="Assistente de agendamento"
          aria-label="Abrir assistente"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}
      {open && (
        <div className="fixed bottom-4 right-4 z-40 w-[92vw] sm:w-[380px] h-[70vh] sm:h-[520px] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary/40">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-heading text-sm neon-text">Assistente de Agenda</span>
            <button onClick={() => setOpen(false)} className="ml-auto text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[90%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground"
                  }`}
                >
                  {m.text}
                  {m.role === "assistant" && m.sugestao?.sugestao_principal && (
                    <div className="mt-3 flex flex-col gap-2">
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => usar(m.sugestao, m.extraidos, false)}
                      >
                        <CalendarPlus className="h-3.5 w-3.5 mr-1" /> Criar com horário principal
                      </Button>
                      {m.sugestao.sugestao_alternativa && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => usar(m.sugestao, m.extraidos, true)}
                        >
                          Criar com alternativa
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="text-xs text-muted-foreground italic">Analisando agenda...</div>
            )}
          </div>
          <div className="p-2 border-t border-border flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Descreva o agendamento..."
              className="bg-background"
              disabled={loading}
            />
            <Button size="icon" onClick={send} disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}