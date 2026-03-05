import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";

const GlobalMessageListener = () => {
  const { user, profile } = useAuth();
  const [message, setMessage] = useState<any>(null);

  const checkMessages = useCallback(async () => {
    if (!user || !profile) return;
    const { data } = await supabase
      .from("mensagens_globais")
      .select("*")
      .order("data_criacao", { ascending: false })
      .limit(20);

    if (!data) return;

    // Find first unread message for this user
    for (const msg of data) {
      const destinatarios = msg.destinatarios as string[];
      const lidaPor = (msg.lida_por || []) as string[];
      const isForMe = destinatarios.includes("todos") || destinatarios.includes(profile.nome);
      const alreadyRead = lidaPor.includes(user.id);

      if (isForMe && !alreadyRead) {
        setMessage(msg);
        break;
      }
    }
  }, [user, profile]);

  useEffect(() => {
    checkMessages();
  }, [checkMessages]);

  // Listen realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("mensagens-globais-listener")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensagens_globais" }, () => {
        checkMessages();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, checkMessages]);

  const markAsRead = async () => {
    if (!message || !user) return;
    const lidaPor = (message.lida_por || []) as string[];
    await supabase.from("mensagens_globais").update({
      lida_por: [...lidaPor, user.id],
    } as any).eq("id", message.id);
    setMessage(null);
    // Check for next unread
    setTimeout(checkMessages, 500);
  };

  if (!message) return null;

  return (
    <Dialog open={!!message} onOpenChange={(open) => { if (!open) markAsRead(); }}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-heading neon-text flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" /> Mensagem do Administrador
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">De: {message.enviado_por}</p>
          <div className="p-4 rounded-lg border border-primary/30 bg-primary/5">
            <p className="text-foreground whitespace-pre-wrap">{message.mensagem}</p>
          </div>
          <Button onClick={markAsRead} className="w-full bg-primary text-primary-foreground hover:bg-primary/80">
            Entendido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GlobalMessageListener;
