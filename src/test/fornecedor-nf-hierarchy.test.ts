import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const pages = [
  "src/pages/AgendaPage.tsx",
  "src/pages/CalendarioPage.tsx",
  "src/pages/DescargaPage.tsx",
  "src/pages/ArmazenagemPage.tsx",
  "src/pages/ValoresDescargaPage.tsx",
];

describe("Hierarquia visual Fornecedor > NF", () => {
  for (const p of pages) {
    it(`${p} exibe fornecedor antes da NF`, () => {
      const src = readFileSync(resolve(process.cwd(), p), "utf8");
      const f = src.indexOf('data-testid="fornecedor-nome"');
      const n = src.indexOf('data-testid="nf-secundario"');
      expect(f, "fornecedor-nome ausente").toBeGreaterThan(-1);
      expect(n, "nf-secundario ausente").toBeGreaterThan(-1);
      expect(f).toBeLessThan(n);
    });
  }
});