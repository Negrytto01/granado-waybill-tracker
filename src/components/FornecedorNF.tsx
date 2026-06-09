import { formatNF } from "@/lib/helpers";
import { cn } from "@/lib/utils";

interface Props {
  fornecedor?: string | null;
  numeroNf?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  children?: React.ReactNode;
}

/**
 * Componente padrão para exibir Fornecedor (destaque) e NF (secundário).
 * Use em todos os cards, modais e tabelas para manter hierarquia consistente.
 */
export const FornecedorNF = ({ fornecedor, numeroNf, size = "md", className, children }: Props) => {
  const headingSize = size === "lg" ? "text-lg" : size === "sm" ? "text-sm" : "text-base";
  const nfs = (numeroNf || "").split(/\s*\/\s*/).map(s => s.trim()).filter(Boolean);
  return (
    <div className={cn("min-w-0", className)}>
      <h3
        data-testid="fornecedor-nome"
        title={fornecedor || undefined}
        className={cn("font-heading text-foreground leading-tight truncate", headingSize)}
      >
        {fornecedor || "—"}
      </h3>
      {nfs.length > 0 && (
        <div data-testid="nf-secundario" className="flex flex-wrap gap-1 items-center mt-0.5">
          {nfs.map((nf, i) => (
            <span key={i} className="inline-block px-1.5 py-0.5 rounded bg-secondary text-xs text-muted-foreground">
              NF {formatNF(nf)}
            </span>
          ))}
        </div>
      )}
      {children}
    </div>
  );
};

export default FornecedorNF;