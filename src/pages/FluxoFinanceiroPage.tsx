import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { DollarSign, Plus, TrendingUp, TrendingDown, Trash2, RefreshCw, Receipt, Download, Printer } from "lucide-react";
import { formatDateTime, formatNF } from "@/lib/helpers";
import { buildRecibo, type ReciboData } from "@/lib/recibo";
import jsPDF from "jspdf";

const FluxoFinanceiroPage = () => {
  const { profile } = useAuth();
  const [fluxos, setFluxos] = useState<any[]>([]);
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({ descricao: "", valor: "" });
  const [mesRef, setMesRef] = useState(new Date().toISOString().slice(0, 7));
  const [recibo, setRecibo] = useState<null | ReciboData>(null);
  const isAdmin = profile?.cargo === "Master";

  const fetchData = useCallback(async () => {
    const startDate = `${mesRef}-01`;
    const endDate = new Date(Number(mesRef.split("-")[0]), Number(mesRef.split("-")[1]), 0).toISOString().split("T")[0];
    
    const { data } = await supabase.from("fluxo_financeiro").select("*")
      .gte("mes_referencia", startDate)
      .lte("mes_referencia", endDate)
      .order("data_criacao", { ascending: false });
    setFluxos(data || []);
  }, [mesRef]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel("realtime-fluxo_financeiro")
      .on("postgres_changes", { event: "*", schema: "public", table: "fluxo_financeiro" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  // Sync financeiro with recebimentos that have valor_cobrado
  const syncFinanceiro = async () => {
    const startDate = `${mesRef}-01`;
    const endDate = new Date(Number(mesRef.split("-")[0]), Number(mesRef.split("-")[1]), 0).toISOString().split("T")[0];

    // Get all recebimentos with valor_cobrado > 0 for this month
    const { data: recs } = await supabase.from("recebimentos").select("*")
      .gt("valor_cobrado", 0)
      .gte("hora_fim_descarga", `${startDate}T00:00:00`)
      .lte("hora_fim_descarga", `${endDate}T23:59:59`);

    // Get existing fluxo entries for this month
    const { data: existingFluxos } = await supabase.from("fluxo_financeiro").select("recebimento_id")
      .gte("mes_referencia", startDate)
      .lte("mes_referencia", endDate)
      .eq("tipo", "ENTRADA");

    const existingIds = new Set((existingFluxos || []).map(f => f.recebimento_id).filter(Boolean));
    const toInsert = (recs || []).filter(r => !existingIds.has(r.id));

    if (toInsert.length === 0) {
      toast.info("Tudo sincronizado!");
      return;
    }

    for (const r of toInsert) {
      await supabase.from("fluxo_financeiro").insert([{
        tipo: "ENTRADA",
        descricao: `Descarga NF ${r.numero_nf} - ${r.fornecedor}`,
        valor: r.valor_cobrado,
        recebimento_id: r.id,
        criado_por: r.usuario_responsavel,
        mes_referencia: startDate,
      }] as any);
    }

    toast.success(`${toInsert.length} lançamento(s) sincronizado(s)!`);
    fetchData();
  };

  const handleAddSaida = async () => {
    if (!form.descricao || !form.valor) { toast.error("Preencha todos os campos"); return; }
    const { error } = await supabase.from("fluxo_financeiro").insert([{
      tipo: "SAIDA",
      descricao: form.descricao,
      valor: parseFloat(form.valor),
      mes_referencia: `${mesRef}-01`,
      criado_por: profile?.nome,
    }]);
    if (error) { toast.error(error.message); return; }
    toast.success("Saída registrada!");
    setOpenNew(false);
    setForm({ descricao: "", valor: "" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover?")) return;
    const { error } = await supabase.from("fluxo_financeiro").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Removido!");
    fetchData();
  };

  const carregarRecebimento = async (f: any): Promise<ReciboData | null> => {
    if (!f.recebimento_id) { toast.error("Este lançamento não está vinculado a um recebimento."); return null; }
    const { data: r, error } = await supabase.from("recebimentos").select("transportadora, fornecedor, numero_nf, valor_cobrado").eq("id", f.recebimento_id).maybeSingle();
    if (error || !r) { toast.error("Não foi possível carregar os dados do recebimento."); return null; }
    return buildRecibo({
      transportadora: r.transportadora,
      valor: Number(f.valor || r.valor_cobrado || 0),
      numeroNf: r.numero_nf,
      fornecedor: r.fornecedor,
    });
  };

  const gerarRecibo = async (f: any) => {
    const data = await carregarRecebimento(f);
    if (data) setRecibo(data);
  };

  const construirPdf = (data: ReciboData): jsPDF => {
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const margin = 25;
    const contentW = pageW - margin * 2;

    pdf.setFont("times", "bold");
    pdf.setFontSize(18);
    pdf.text("RECIBO DE DESCARGA", pageW / 2, 35, { align: "center" });
    pdf.setLineWidth(0.5);
    pdf.line(margin, 40, pageW - margin, 40);

    pdf.setFont("times", "normal");
    pdf.setFontSize(12);
    const corpo = `Recebemos da Transportadora ${data.transportadora} a quantia de R$ ${data.valorFmt} referente à descarga da NF nº ${data.nfsFmt} da ${data.fornecedor}.`;
    const linhas = pdf.splitTextToSize(corpo, contentW);
    pdf.text(linhas, margin, 60, { align: "justify", maxWidth: contentW });

    const yData = 60 + linhas.length * 7 + 30;
    pdf.text(data.dataFmt, margin, yData);
    pdf.text("Ass.: ____________________________________", margin, yData + 30);
    return pdf;
  };

  const baixarPdf = async (f: any) => {
    const data = await carregarRecebimento(f);
    if (!data) return;
    const pdf = construirPdf(data);
    const nomeArquivo = `recibo-${data.nfsFmt.replace(/[^\d]/g, "-") || "descarga"}.pdf`;
    pdf.save(nomeArquivo);
    toast.success("PDF gerado!");
  };

  const baixarPdfAtual = () => {
    if (!recibo) return;
    const pdf = construirPdf(recibo);
    pdf.save(`recibo-${recibo.nfsFmt.replace(/[^\d]/g, "-") || "descarga"}.pdf`);
  };

  const imprimirRecibo = () => {
    if (!recibo) return;
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Recibo de Descarga</title>
<style>
  @page { size: A4; margin: 25mm; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #111; max-width: 720px; margin: 0 auto; padding: 24px; line-height: 1.8; }
  h1 { text-align: center; letter-spacing: 4px; font-size: 22px; margin: 0 0 40px; text-transform: uppercase; border-bottom: 2px solid #111; padding-bottom: 12px; }
  p { font-size: 16px; text-align: justify; margin: 0 0 32px; }
  .data { margin-top: 60px; }
  .assinatura { margin-top: 60px; }
</style></head><body>
<h1>Recibo de Descarga</h1>
<p>Recebemos da Transportadora <strong>${recibo.transportadora}</strong> a quantia de <strong>R$ ${recibo.valorFmt}</strong> referente à descarga da NF nº <strong>${recibo.nfsFmt}</strong> da <strong>${recibo.fornecedor}</strong>.</p>
<p class="data">${recibo.dataFmt}</p>
<p class="assinatura">Ass.:____________________________________</p>
<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 200); };<\/script>
</body></html>`;
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) { toast.error("Não foi possível preparar a impressão."); return; }
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => { try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch (e) { toast.error("Falha ao imprimir."); } setTimeout(() => document.body.removeChild(iframe), 2000); }, 400);
  };

  const renderNFsInDescription = (desc: string) => {
    // Try to extract NFs from description like "Descarga NF 444618 / 444567 - Fornecedor"
    const nfMatch = desc.match(/NF\s+(.+?)\s*-/);
    if (!nfMatch) return desc;
    const nfPart = nfMatch[1];
    const nfs = nfPart.split(/\s*\/\s*/);
    if (nfs.length <= 1) {
      return desc.replace(/NF\s+(.+?)\s*-/, `NF ${formatNF(nfs[0].trim())} -`);
    }
    return (
      <span>
        Descarga{" "}
        {nfs.map((nf, i) => (
          <span key={i}>
            <span className="inline-block px-1 py-0.5 rounded bg-secondary text-xs">NF {formatNF(nf.trim())}</span>
            {i < nfs.length - 1 && " "}
          </span>
        ))}
        {" - "}{desc.split(" - ").slice(1).join(" - ")}
      </span>
    );
  };

  const totalEntradas = fluxos.filter(f => f.tipo === "ENTRADA").reduce((a, f) => a + Number(f.valor), 0);
  const totalSaidas = fluxos.filter(f => f.tipo === "SAIDA").reduce((a, f) => a + Number(f.valor), 0);
  const saldo = totalEntradas - totalSaidas;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-heading text-3xl neon-text">Fluxo Financeiro</h1>
        <div className="flex gap-2 items-center">
          <Input type="month" value={mesRef} onChange={e => setMesRef(e.target.value)} className="bg-secondary w-44" />
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={syncFinanceiro} title="Sincronizar com histórico" className="border-primary/50 text-primary">
                <RefreshCw className="mr-2 h-4 w-4" /> Sincronizar
              </Button>
              <Dialog open={openNew} onOpenChange={setOpenNew}>
                <DialogTrigger asChild>
                  <Button className="bg-destructive text-destructive-foreground hover:bg-destructive/80">
                    <Plus className="mr-2 h-4 w-4" /> Nova Saída
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader><DialogTitle className="font-heading neon-text">Registrar Saída</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <Input placeholder="Descrição *" value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} className="bg-secondary" />
                    <Input type="number" step="0.01" placeholder="Valor (R$) *" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} className="bg-secondary" />
                    <Button onClick={handleAddSaida} className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/80">Salvar Saída</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <span className="text-xs text-muted-foreground uppercase">Entradas</span>
          </div>
          <p className="font-heading text-2xl text-emerald-400">R$ {totalEntradas.toFixed(2)}</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="h-4 w-4 text-red-400" />
            <span className="text-xs text-muted-foreground uppercase">Saídas</span>
          </div>
          <p className="font-heading text-2xl text-red-400">R$ {totalSaidas.toFixed(2)}</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground uppercase">Saldo</span>
          </div>
          <p className={`font-heading text-2xl ${saldo >= 0 ? "text-emerald-400" : "text-red-400"}`}>R$ {saldo.toFixed(2)}</p>
        </div>
      </div>

      <div className="space-y-2">
        {fluxos.map(f => (
          <div key={f.id} className="p-3 rounded-lg border border-border bg-card/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {f.tipo === "ENTRADA" ? <TrendingUp className="h-4 w-4 text-emerald-400" /> : <TrendingDown className="h-4 w-4 text-red-400" />}
              <div>
                <p className="text-foreground">{renderNFsInDescription(f.descricao)}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(f.data_criacao)} · {f.criado_por}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`font-heading text-lg ${f.tipo === "ENTRADA" ? "text-emerald-400" : "text-red-400"}`}>
                {f.tipo === "ENTRADA" ? "+" : "-"} R$ {Number(f.valor).toFixed(2)}
              </span>
              {f.tipo === "ENTRADA" && f.recebimento_id && (
                <>
                  <Button variant="ghost" size="icon" onClick={() => gerarRecibo(f)} title="Prévia do recibo" className="text-primary hover:text-primary">
                    <Receipt className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => baixarPdf(f)} title="Baixar PDF do recibo" className="text-primary hover:text-primary">
                    <Download className="h-4 w-4" />
                  </Button>
                </>
              )}
              {isAdmin && (
                <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
        {fluxos.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Nenhum registro neste mês</p>
        )}
      </div>

      <Dialog open={!!recibo} onOpenChange={(o) => { if (!o) setRecibo(null); }}>
        <DialogContent className="bg-white text-black max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-center tracking-widest uppercase border-b border-black pb-3 text-black">Recibo de Descarga</DialogTitle>
          </DialogHeader>
          {recibo && (
            <div className="space-y-8 py-4 font-serif text-[15px] leading-relaxed">
              <p className="text-justify">
                Recebemos da Transportadora <strong>{recibo.transportadora}</strong> a quantia de <strong>R$ {recibo.valorFmt}</strong> referente à descarga da NF nº <strong>{recibo.nfsFmt}</strong> da <strong>{recibo.fornecedor}</strong>.
              </p>
              <p className="pt-8">{recibo.dataFmt}</p>
              <p className="pt-8">Ass.:____________________________________</p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setRecibo(null)} className="text-black">Fechar</Button>
            <Button variant="outline" onClick={imprimirRecibo} className="text-black">
              <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
            <Button onClick={baixarPdfAtual} className="bg-primary text-primary-foreground">
              <Download className="mr-2 h-4 w-4" /> Baixar PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FluxoFinanceiroPage;
