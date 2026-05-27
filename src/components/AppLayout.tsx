import { ReactNode, useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useInactivityTimeout } from "@/hooks/useInactivityTimeout";
import { useNavigate, useLocation } from "react-router-dom";
import ParticlesBackground from "@/components/ParticlesBackground";
import Watermark from "@/components/Watermark";
import GlobalMessageListener from "@/components/GlobalMessageListener";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  LayoutDashboard, CalendarDays, Truck, Package, Users, History, LogOut, Menu, X, BarChart3,
  ShoppingCart, AlertTriangle, Wallet, Shield, Calendar, FileText, Send, Bell, Activity, Car, DoorOpen, Ban, DollarSign
  , Code2
} from "lucide-react";

const allNavItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/", page: "dashboard" },
  { label: "Calendário", icon: Calendar, path: "/calendario", page: "calendario" },
  { label: "Agenda", icon: CalendarDays, path: "/agenda", page: "agenda" },
  { label: "Descarga", icon: Truck, path: "/descarga", page: "descarga" },
  { label: "Armazenagem", icon: Package, path: "/armazenagem", page: "armazenagem" },
  { label: "Compras", icon: ShoppingCart, path: "/compras", page: "compras" },
  { label: "Financeiro", icon: Wallet, path: "/financeiro", page: "financeiro" },
  { label: "Fornecedores", icon: AlertTriangle, path: "/fornecedores", page: "fornecedores" },
  { label: "Solicitações", icon: FileText, path: "/solicitacoes", page: "solicitacoes" },
  { label: "Histórico", icon: History, path: "/historico", page: "historico" },
  { label: "Relatórios", icon: BarChart3, path: "/relatorios", page: "relatorios" },
  { label: "Não Vieram", icon: Ban, path: "/naovieram", page: "naovieram" },
  { label: "Cad. Veículos", icon: Car, path: "/portaria", page: "portaria" },
  { label: "Hist. Portaria", icon: DoorOpen, path: "/portaria-historico", page: "portaria_historico" },
  { label: "Valores", icon: DollarSign, path: "/valores", page: "valores" },
  { label: "Usuários", icon: Users, path: "/usuarios", page: "usuarios" },
  { label: "Permissões", icon: Shield, path: "/permissoes", page: "permissoes" },
  { label: "API", icon: Code2, path: "/api", page: "api", masterOnly: true },
];

const AppLayout = ({ children }: { children: ReactNode }) => {
  const { profile, signOut } = useAuth();
  const { hasAccess, isAdmin } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgText, setMsgText] = useState("");
  const [urgentAlert, setUrgentAlert] = useState(false);
  const [urgentFornecedores, setUrgentFornecedores] = useState<string[]>([]);

  useInactivityTimeout();

  useEffect(() => {
    const checkAlert = async () => {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const dayOfMonth = today.getDate();
      if (dayOfWeek !== 1 || dayOfMonth < 15) return;
      if (!hasAccess("agenda") && !hasAccess("compras") && !isAdmin) return;
      const dismissedKey = `urgent_alert_${today.toISOString().split("T")[0]}`;
      if (localStorage.getItem(dismissedKey)) return;
      const { data } = await supabase.from("fornecedores_urgencia").select("nome_fornecedor").order("contagem_urgencias", { ascending: false });
      if (data && data.length > 0) {
        setUrgentFornecedores(data.map((f: any) => f.nome_fornecedor));
        setUrgentAlert(true);
      }
    };
    checkAlert();
  }, [hasAccess, isAdmin]);

  const dismissAlert = () => {
    const dismissedKey = `urgent_alert_${new Date().toISOString().split("T")[0]}`;
    localStorage.setItem(dismissedKey, "true");
    setUrgentAlert(false);
  };

  const handleSendMsg = async () => {
    if (!msgText.trim()) { toast.error("Digite a mensagem"); return; }
    const { error } = await supabase.from("mensagens_globais").insert([{
      mensagem: msgText,
      enviado_por: profile?.nome,
      enviado_por_user_id: (await supabase.auth.getUser()).data.user?.id,
      destinatarios: ["todos"],
    }] as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Mensagem enviada!");
    setMsgOpen(false);
    setMsgText("");
  };

  const filteredNav = allNavItems.filter(item => {
    if (item.path === "/permissoes") return isAdmin;
    if ((item as any).masterOnly) return isAdmin;
    return hasAccess(item.page);
  });

  return (
    <div className="min-h-screen bg-background relative">
      <ParticlesBackground />
      <Watermark />

      <header className="sticky top-0 z-50 h-14 border-b border-border bg-card/90 backdrop-blur-md flex items-center px-4 gap-3">
        <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden text-foreground">
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <img src="/logo-granado-icon.png" alt="Granado" className="h-8 w-8 rounded" />
        <span className="font-heading text-lg neon-text tracking-wider hidden sm:block">Granado Distribuidora</span>
        <div className="ml-auto flex items-center gap-3">
          {isAdmin && (
            <>
              <Button variant="ghost" size="icon" onClick={() => navigate("/atividades")} title="Atividades em tempo real">
                <Activity className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setMsgOpen(true)} title="Enviar mensagem global">
                <Bell className="h-4 w-4 text-muted-foreground" />
              </Button>
            </>
          )}
          <span className="text-sm text-foreground">{profile?.nome}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary font-semibold">{profile?.cargo}</span>
          <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden lg:flex flex-col w-56 min-h-[calc(100vh-3.5rem)] border-r border-border bg-card/50 backdrop-blur-sm p-3 gap-1 relative z-10 overflow-y-auto">
          {filteredNav.map(item => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  active ? "bg-primary/15 text-primary neon-border" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <item.icon size={16} />
                {item.label}
              </button>
            );
          })}
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMobileOpen(false)}>
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
            <aside className="absolute left-0 top-14 bottom-0 w-64 border-r border-border bg-card p-3 space-y-1 overflow-y-auto" onClick={e => e.stopPropagation()}>
              {filteredNav.map(item => {
                const active = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => { navigate(item.path); setMobileOpen(false); }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all w-full ${
                      active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    <item.icon size={18} />
                    {item.label}
                  </button>
                );
              })}
            </aside>
          </div>
        )}

        <main className="flex-1 relative z-10 p-4 md:p-6 overflow-auto min-h-[calc(100vh-3.5rem)]">
          {children}
        </main>
      </div>

      <GlobalMessageListener />

      <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="font-heading neon-text">Enviar Mensagem Global</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Textarea placeholder="Digite sua mensagem para todos os usuários..." value={msgText} onChange={e => setMsgText(e.target.value)} className="bg-secondary" rows={3} />
            <Button onClick={handleSendMsg} className="w-full bg-primary text-primary-foreground hover:bg-primary/80">
              <Send className="mr-2 h-4 w-4" /> Enviar para Todos
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={urgentAlert} onOpenChange={(open) => { if (!open) dismissAlert(); }}>
        <DialogContent className="bg-card border-red-500/30">
          <DialogHeader>
            <DialogTitle className="font-heading text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-6 w-6" />
              ATENÇÃO URGENTE
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ficar atento com esses fornecedores que precisa entregar dentro do Mês:
            </p>
            <div className="space-y-2">
              {urgentFornecedores.map((f, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg border border-red-500/20 bg-red-500/5">
                  <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
                  <span className="text-foreground font-medium">{f}</span>
                </div>
              ))}
            </div>
            <Button onClick={dismissAlert} className="w-full bg-red-600 text-white hover:bg-red-700">Entendido</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AppLayout;
