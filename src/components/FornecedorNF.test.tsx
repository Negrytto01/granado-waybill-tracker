import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FornecedorNF } from "./FornecedorNF";

describe("FornecedorNF", () => {
  it("destaca o fornecedor e mostra NFs como secundário", () => {
    render(<FornecedorNF fornecedor="Pandurata Linha" numeroNf="12345 / 67890" />);
    const f = screen.getByTestId("fornecedor-nome");
    const n = screen.getByTestId("nf-secundario");
    expect(f).toHaveTextContent("Pandurata Linha");
    expect(n).toHaveTextContent("NF 12.345");
    expect(n).toHaveTextContent("NF 67.890");
    // hierarquia DOM: fornecedor antes da NF
    expect(f.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renderiza placeholder quando fornecedor ausente", () => {
    render(<FornecedorNF fornecedor={null} numeroNf={null} />);
    expect(screen.getByTestId("fornecedor-nome")).toHaveTextContent("—");
    expect(screen.queryByTestId("nf-secundario")).toBeNull();
  });
});