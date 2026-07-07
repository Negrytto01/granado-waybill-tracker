import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { DollarSign, Plus, TrendingUp, TrendingDown, Trash2, RefreshCw, Receipt, Download, Printer } from "lucide-react";
import { formatDateTime, formatNF } from "@/lib/helpers";
import { buildRecibo, formatBRL, formatDataExtenso, formatNFList, type ReciboData } from "@/lib/recibo";
import jsPDF from "jspdf";

const FluxoFinanceiroPage = () => {
  const { profile } = useAuth();
  const [fluxos, setFluxos] = useState<any[]>([]);
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({ descricao: "", valor: "" });
  const [mesRef, setMesRef] = useState(new Date().toISOString().slice(0, 7));
  const [recibo, setRecibo] = useState<null | ReciboData>(null);
  // Formulário editável antes de gerar o recibo
  const [reciboForm, setReciboForm] = useState<null | {
    transportadora: string;
    valor: string;
    numeroNf: string;
    fornecedor: string;
    cidade: string;
    data: string; // yyyy-mm-dd
  }>(null);
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

  const abrirFormulario = async (f: any) => {
    if (!f.recebimento_id) { toast.error("Este lançamento não está vinculado a um recebimento."); return; }
    const { data: r, error } = await supabase
      .from("recebimentos")
      .select("transportadora, fornecedor, numero_nf, valor_cobrado, is_pallet")
      .eq("id", f.recebimento_id)
      .maybeSingle();
    if (error || !r) { toast.error("Não foi possível carregar os dados do recebimento."); return; }

    // Excluir NFs de pallets: apenas NFs vinculadas ao recebimento principal
    const nfs = (r.numero_nf || "")
      .split(/\s*\/\s*/)
      .map((s: string) => s.trim())
      .filter(Boolean);
    const nfPrincipal = r.is_pallet ? [] : nfs;

    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    setReciboForm({
      transportadora: r.transportadora || "",
      valor: String(Number(f.valor || r.valor_cobrado || 0)),
      numeroNf: nfPrincipal.join(" / "),
      fornecedor: r.fornecedor || "",
      cidade: "Sorocaba",
      data: iso,
    });
  };

  const buildFromForm = (): ReciboData | null => {
    if (!reciboForm) return null;
    const [y, m, d] = reciboForm.data.split("-").map(Number);
    return {
      transportadora: reciboForm.transportadora.trim() || "________________________________",
      valorFmt: formatBRL(reciboForm.valor),
      nfsFmt: formatNFList(reciboForm.numeroNf),
      fornecedor: reciboForm.fornecedor.trim() || "-",
      dataFmt: formatDataExtenso(new Date(y, (m || 1) - 1, d || 1), reciboForm.cidade.trim() || "Sorocaba"),
    };
  };

  const visualizarRecibo = () => {
    const data = buildFromForm();
    if (data) setRecibo(data);
  };

  const construirPdf = (data: ReciboData): jsPDF => {
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 22;
    const contentW = pageW - margin * 2;

    // Borda externa
    pdf.setDrawColor(30);
    pdf.setLineWidth(0.6);
    pdf.rect(margin - 6, margin - 6, contentW + 12, pageH - (margin - 6) * 2);

    // Cabeçalho
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(90);
    pdf.text("GRANADO DISTRIBUIDORA", margin, margin + 2);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text("Recibo de Descarga", pageW - margin, margin + 2, { align: "right" });
    pdf.setDrawColor(180);
    pdf.setLineWidth(0.2);
    pdf.line(margin, margin + 6, pageW - margin, margin + 6);

    // Título
    pdf.setTextColor(20);
    pdf.setFont("times", "bold");
    pdf.setFontSize(22);
    pdf.text("RECIBO DE DESCARGA", pageW / 2, margin + 28, { align: "center" });

    // Valor em destaque
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(20);
    pdf.text(`VALOR: R$ ${data.valorFmt}`, pageW / 2, margin + 40, { align: "center" });
    pdf.setDrawColor(30);
    pdf.setLineWidth(0.4);
    pdf.line(margin + 20, margin + 46, pageW - margin - 20, margin + 46);

    // Corpo
    pdf.setFont("times", "normal");
    pdf.setFontSize(12);
    pdf.setTextColor(30);
    const corpo = `Recebemos da Transportadora ${data.transportadora} a quantia de R$ ${data.valorFmt} (${porExtenso(data.valorFmt)}) referente à descarga da NF nº ${data.nfsFmt} da ${data.fornecedor}.`;
    const linhas = pdf.splitTextToSize(corpo, contentW);
    pdf.text(linhas, margin, margin + 60, { align: "justify", maxWidth: contentW });

    // Bloco de dados
    const yBox = margin + 60 + linhas.length * 6 + 12;
    pdf.setDrawColor(200);
    pdf.setLineWidth(0.2);
    pdf.rect(margin, yBox, contentW, 34);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(110);
    pdf.text("TRANSPORTADORA", margin + 3, yBox + 6);
    pdf.text("FORNECEDOR", margin + 3, yBox + 20);
    pdf.text("NF Nº", pageW - margin - 60, yBox + 6);
    pdf.text("VALOR", pageW - margin - 60, yBox + 20);
    pdf.setFont("times", "normal");
    pdf.setFontSize(11);
    pdf.setTextColor(20);
    pdf.text(data.transportadora, margin + 3, yBox + 12, { maxWidth: contentW - 65 });
    pdf.text(data.fornecedor, margin + 3, yBox + 26, { maxWidth: contentW - 65 });
    pdf.text(data.nfsFmt, pageW - margin - 60, yBox + 12);
    pdf.text(`R$ ${data.valorFmt}`, pageW - margin - 60, yBox + 26);

    // Data e assinatura
    const yData = yBox + 55;
    pdf.setFont("times", "italic");
    pdf.setFontSize(11);
    pdf.text(data.dataFmt, pageW - margin, yData, { align: "right" });

    const ySig = yData + 40;
    pdf.setDrawColor(30);
    pdf.setLineWidth(0.3);
    pdf.line(pageW / 2 - 55, ySig, pageW / 2 + 55, ySig);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(90);
    pdf.text("Assinatura do Responsável", pageW / 2, ySig + 5, { align: "center" });

    // Rodapé
    pdf.setFontSize(8);
    pdf.setTextColor(140);
    pdf.text("Documento gerado eletronicamente pelo sistema Granado Distribuidora.", pageW / 2, pageH - margin + 2, { align: "center" });
    return pdf;
  };

  const baixarPdf = () => {
    const data = buildFromForm();
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
    const pdf = construirPdf(recibo);
    const blobUrl = pdf.output("bloburl") as unknown as string;
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    iframe.src = blobUrl;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      setTimeout(() => {
        try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); }
        catch { toast.error("Falha ao imprimir."); }
        setTimeout(() => document.body.removeChild(iframe), 3000);
      }, 300);
    };
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
                <Button variant="ghost" size="icon" onClick={() => abrirFormulario(f)} title="Emitir recibo" className="text-primary hover:text-primary">
                  <Receipt className="h-4 w-4" />
                </Button>
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

      {/* Formulário editável antes da geração */}
      <Dialog open={!!reciboForm} onOpenChange={(o) => { if (!o) setReciboForm(null); }}>
        <DialogContent className="bg-card border-border max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-heading neon-text">Emitir Recibo de Descarga</DialogTitle>
          </DialogHeader>
          {reciboForm && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Confira e ajuste as informações. NFs de pallets não são incluídas — apenas as vinculadas ao recebimento.</p>
              <div>
                <Label className="text-xs">Transportadora</Label>
                <Input value={reciboForm.transportadora} onChange={e => setReciboForm({ ...reciboForm, transportadora: e.target.value })} className="bg-secondary" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Valor (R$)</Label>
                  <Input type="number" step="0.01" value={reciboForm.valor} onChange={e => setReciboForm({ ...reciboForm, valor: e.target.value })} className="bg-secondary" />
                </div>
                <div>
                  <Label className="text-xs">NF nº (separe por / )</Label>
                  <Input value={reciboForm.numeroNf} onChange={e => setReciboForm({ ...reciboForm, numeroNf: e.target.value })} className="bg-secondary" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Fornecedor</Label>
                <Input value={reciboForm.fornecedor} onChange={e => setReciboForm({ ...reciboForm, fornecedor: e.target.value })} className="bg-secondary" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Cidade</Label>
                  <Input value={reciboForm.cidade} onChange={e => setReciboForm({ ...reciboForm, cidade: e.target.value })} className="bg-secondary" />
                </div>
                <div>
                  <Label className="text-xs">Data</Label>
                  <Input type="date" value={reciboForm.data} onChange={e => setReciboForm({ ...reciboForm, data: e.target.value })} className="bg-secondary" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setReciboForm(null)}>Cancelar</Button>
                <Button variant="outline" onClick={visualizarRecibo}>
                  <Receipt className="mr-2 h-4 w-4" /> Prévia
                </Button>
                <Button onClick={baixarPdf} className="bg-primary text-primary-foreground">
                  <Download className="mr-2 h-4 w-4" /> Baixar PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!recibo} onOpenChange={(o) => { if (!o) setRecibo(null); }}>
        <DialogContent className="bg-white text-black max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-center tracking-widest uppercase border-b border-black pb-3 text-black">Prévia do Recibo</DialogTitle>
          </DialogHeader>
          {recibo && (
            <div className="py-4 font-serif text-[15px] leading-relaxed border border-neutral-300 p-6 rounded">
              <div className="text-center border-b border-black pb-2 mb-6">
                <p className="text-[10px] tracking-widest text-neutral-600">GRANADO DISTRIBUIDORA</p>
                <h2 className="font-heading text-2xl tracking-widest">RECIBO DE DESCARGA</h2>
                <p className="mt-2 font-bold">VALOR: R$ {recibo.valorFmt}</p>
              </div>
              <p className="text-justify mb-6">
                Recebemos da Transportadora <strong>{recibo.transportadora}</strong> a quantia de <strong>R$ {recibo.valorFmt}</strong> referente à descarga da NF nº <strong>{recibo.nfsFmt}</strong> da <strong>{recibo.fornecedor}</strong>.
              </p>
              <div className="grid grid-cols-2 gap-3 border border-neutral-300 p-3 text-sm mb-8">
                <div><span className="text-[10px] text-neutral-500 block">TRANSPORTADORA</span>{recibo.transportadora}</div>
                <div><span className="text-[10px] text-neutral-500 block">NF Nº</span>{recibo.nfsFmt}</div>
                <div><span className="text-[10px] text-neutral-500 block">FORNECEDOR</span>{recibo.fornecedor}</div>
                <div><span className="text-[10px] text-neutral-500 block">VALOR</span>R$ {recibo.valorFmt}</div>
              </div>
              <p className="text-right italic">{recibo.dataFmt}</p>
              <div className="mt-16 mx-auto w-64 border-t border-black text-center pt-1 text-xs">Assinatura do Responsável</div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setRecibo(null)} className="text-black">Fechar</Button>
            <Button variant="outline" onClick={imprimirRecibo} className="text-black">
              <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
            <Button onClick={() => { const pdf = construirPdf(recibo!); pdf.save(`recibo-${recibo!.nfsFmt.replace(/[^\d]/g, "-") || "descarga"}.pdf`); }} className="bg-primary text-primary-foreground">
              <Download className="mr-2 h-4 w-4" /> Baixar PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FluxoFinanceiroPage;
