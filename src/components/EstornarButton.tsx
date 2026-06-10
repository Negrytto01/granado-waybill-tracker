import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  recebimento: { id: string; fornecedor?: string | null; numero_nf?: string | null; status?: string | null };
  onDone?: () => void;
  size?: "sm" | "default";
  variant?: "ghost" | "outline" | "destructive";
  iconOnly?: boolean;
}

/**
 * Botão de Estornar entrada — restrito a Master.
 * Reverte o recebimento ao status AGENDADO, limpa horários/valores/quantidades
 * e remove armazenagem, fluxo financeiro e registros de "não veio" vinculados.
 */
export const EstornarButton = ({ recebimento, onDone, size = "sm", variant = "outline", iconOnly = false }: Props) => {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  if (profile?.cargo !== "Master") return null;
  // Só faz sentido estornar entradas que já tiveram algum lançamento
  if (!recebimento.status || recebimento.status === "AGENDADO") return null;

  const handleEstorno = async () => {
    setLoading(true);
    try {
      // Remover vínculos
      await supabase.from("armazenagem").delete().eq("recebimento_id", recebimento.id);
      await supabase.from("fluxo_financeiro").delete().eq("recebimento_id", recebimento.id);
      await supabase.from("fornecedores_nao_vieram").delete().eq("recebimento_id", recebimento.id);

      // Reverter o recebimento
      const { error } = await supabase
        .from("recebimentos")
        .update({
          status: "AGENDADO" as any,
          hora_chegada: null,
          hora_acoplagem: null,
          hora_inicio_descarga: null,
          hora_fim_descarga: null,
          hora_desacoplagem: null,
          caixas_batidas: 0,
          pallets_descarregados: 0,
          toneladas: 0,
          valor_cobrado: 0,
          tipo_descarga: null,
          nfd_numero: null,
        })
        .eq("id", recebimento.id);
      if (error) throw error;

      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (userId) {
        await supabase.from("atividades_usuarios").insert([
          {
            user_id: userId,
            usuario_nome: profile?.nome || "",
            acao: "Estorno de entrada",
            detalhes: `${recebimento.fornecedor || "-"} - NF ${recebimento.numero_nf || "-"} (status anterior: ${recebimento.status})`,
          },
        ] as any);
      }

      toast.success("Entrada estornada com sucesso!");
      setOpen(false);
      onDone?.();
    } catch (e: any) {
      toast.error("Não foi possível estornar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        size={size}
        variant={variant}
        onClick={() => setOpen(true)}
        className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
        title="Estornar entrada (Master)"
      >
        <Undo2 className={iconOnly ? "h-3 w-3" : "mr-1 h-3 w-3"} />
        {!iconOnly && "Estornar"}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading text-amber-400">Estornar entrada?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Esta ação vai reverter o recebimento de <strong className="text-foreground">{recebimento.fornecedor || "-"}</strong> ao status <strong>AGENDADO</strong> e remover:
              <ul className="list-disc ml-5 mt-2 text-xs space-y-0.5">
                <li>Horários de chegada, acoplagem, descarga e desacoplagem</li>
                <li>Caixas batidas, pallets, toneladas e valor cobrado</li>
                <li>Registros de armazenagem vinculados</li>
                <li>Lançamentos financeiros vinculados</li>
                <li>Registro de "não veio" vinculado, se houver</li>
              </ul>
              <p className="mt-2 text-xs">Apenas Master pode realizar essa ação. Não é possível desfazer.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleEstorno(); }}
              disabled={loading}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {loading ? "Estornando..." : "Confirmar estorno"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EstornarButton;