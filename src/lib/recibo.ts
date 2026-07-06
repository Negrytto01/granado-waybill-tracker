import { formatNF } from "./helpers";

export const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Formata um valor numérico como moeda brasileira: 560 -> "560,00", 1234.5 -> "1.234,50". */
export const formatBRL = (value: number | string | null | undefined): string => {
  const n = typeof value === "string" ? parseFloat(value) : (value ?? 0);
  if (!Number.isFinite(n as number)) return "0,00";
  return (n as number).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/** Formata uma data como "Sorocaba, 06 de Julho de 2026". */
export const formatDataExtenso = (date: Date = new Date(), cidade = "Sorocaba"): string => {
  const dia = String(date.getDate()).padStart(2, "0");
  const mes = MESES_PT[date.getMonth()];
  const ano = date.getFullYear();
  return `${cidade}, ${dia} de ${mes} de ${ano}`;
};

/** Formata uma lista de NFs "444618 / 444567" mantendo a separação e aplicando pontuação. */
export const formatNFList = (numeroNf: string | null | undefined): string => {
  const raw = (numeroNf || "").split(/\s*\/\s*/).map(s => s.trim()).filter(Boolean);
  return raw.map(formatNF).join(" / ") || "-";
};

export interface ReciboData {
  transportadora: string;
  valorFmt: string;
  nfsFmt: string;
  fornecedor: string;
  dataFmt: string;
}

/** Monta o payload padronizado do recibo, garantindo o mesmo formato em toda a aplicação. */
export const buildRecibo = (input: {
  transportadora?: string | null;
  valor: number | string | null | undefined;
  numeroNf?: string | null;
  fornecedor?: string | null;
  data?: Date;
}): ReciboData => ({
  transportadora: input.transportadora?.trim() || "________________________________",
  valorFmt: formatBRL(input.valor),
  nfsFmt: formatNFList(input.numeroNf),
  fornecedor: input.fornecedor?.trim() || "-",
  dataFmt: formatDataExtenso(input.data),
});
