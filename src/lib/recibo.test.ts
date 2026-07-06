import { describe, it, expect } from "vitest";
import { formatBRL, formatDataExtenso, formatNFList, buildRecibo, MESES_PT } from "./recibo";

describe("formatBRL", () => {
  it("formata valores inteiros e decimais no padrão brasileiro", () => {
    expect(formatBRL(560)).toBe("560,00");
    expect(formatBRL(1234.5)).toBe("1.234,50");
    expect(formatBRL("1234567.891")).toBe("1.234.567,89");
    expect(formatBRL(0)).toBe("0,00");
    expect(formatBRL(null)).toBe("0,00");
    expect(formatBRL(undefined)).toBe("0,00");
    expect(formatBRL("abc")).toBe("0,00");
  });
});

describe("formatDataExtenso", () => {
  it("gera a data no formato 'Cidade, DD de Mês de AAAA'", () => {
    const d = new Date(2026, 6, 6); // 6 Julho 2026
    expect(formatDataExtenso(d)).toBe("Sorocaba, 06 de Julho de 2026");
  });
  it("aceita cidade personalizada e dia com 1 dígito é preenchido com zero", () => {
    const d = new Date(2026, 0, 3);
    expect(formatDataExtenso(d, "Campinas")).toBe("Campinas, 03 de Janeiro de 2026");
  });
  it("cobre todos os 12 meses em português", () => {
    for (let m = 0; m < 12; m++) {
      const d = new Date(2026, m, 15);
      expect(formatDataExtenso(d)).toContain(`de ${MESES_PT[m]} de`);
    }
  });
});

describe("formatNFList", () => {
  it("aplica separador de milhar em cada NF e mantém o divisor '/'", () => {
    expect(formatNFList("858658")).toBe("858.658");
    expect(formatNFList("444618 / 444567")).toBe("444.618 / 444.567");
    expect(formatNFList("")).toBe("-");
    expect(formatNFList(null)).toBe("-");
  });
});

describe("buildRecibo", () => {
  it("monta o payload padronizado do recibo", () => {
    const r = buildRecibo({
      transportadora: "COOPERATIVA DE TRANSPORTES DE CARGAS",
      valor: 560,
      numeroNf: "858658",
      fornecedor: "PANDURATA ALIMENTOS LTDA",
      data: new Date(2026, 6, 6),
    });
    expect(r.transportadora).toBe("COOPERATIVA DE TRANSPORTES DE CARGAS");
    expect(r.valorFmt).toBe("560,00");
    expect(r.nfsFmt).toBe("858.658");
    expect(r.fornecedor).toBe("PANDURATA ALIMENTOS LTDA");
    expect(r.dataFmt).toBe("Sorocaba, 06 de Julho de 2026");
  });

  it("usa placeholders quando faltam transportadora ou fornecedor", () => {
    const r = buildRecibo({ transportadora: null, valor: 0, numeroNf: null, fornecedor: "  " });
    expect(r.transportadora).toMatch(/_+/);
    expect(r.fornecedor).toBe("-");
    expect(r.nfsFmt).toBe("-");
  });
});
