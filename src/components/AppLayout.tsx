import { ReactNode, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useInactivityTimeout } from "@/hooks/useInactivityTimeout";
import { useNavigate, useLocation } from "react-router-dom";
import ParticlesBackground from "@/components/ParticlesBackground";
import Watermark from "@/components/Watermark";
import GlobalMessageListener from "@/components/GlobalMessageListener";
import logoGranado from "@/assets/logo-granado.png";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  LayoutDashboard, CalendarDays, Truck, Package, Users, History, LogOut, Menu, X, BarChart3,
  DollarSign, ShoppingCart, AlertTriangle, Wallet, Shield, Calendar, FileText, Send, Bell
} from "lucide-react";

const allNavItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/", page: "dashboard" },
  { label: "Agenda", icon: CalendarDays, path: "/agenda", page: "agenda" },
  { label: "Calendário", icon: Calendar, path: "/calendario", page: "calendario" },
  { label: "Descarga", icon: Truck, path: "/descarga", page: "descarga" },
  { label: "Armazenagem", icon: Package, path: "/armazenagem", page: "armazenagem" },
  { label: "Compras", icon: ShoppingCart, path: "/compras", page: "compras" },
  { label: "Relatórios", icon: BarChart3, path: "/relatorios", page: "relatorios" },
  { label: "Histórico", icon: History, path: "/historico", page: "historico" },
  { label: "Fornecedores", icon: AlertTriangle, path: "/fornecedores", page: "fornecedores" },
  { label: "Valores", icon: DollarSign, path: "/valores", page: "valores" },
  { label: "Financeiro", icon: Wallet, path: "/financeiro", page: "financeiro" },
  { label: "Usuários", icon: Users, path: "/usuarios", page: "usuarios" },
  { label: "Permissões", icon: Shield, path: "/permissoes", page: "usuarios" },
  { label: "Solicitações", icon: FileText, path: "/solicitacoes", page: "compras" },
];

const AppLayout = ({ children }: { children: ReactNode }) => {
  const { profile, signOut } = useAuth();
  const { hasAccess, isAdmin } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgText, setMsgText] = useState("");
  const [msgDestinatarios, setMsgDestinatarios] = useState<string[]>(["todos"]);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // Auto-logout after 30 min inactivity
  useInactivityTimeout();

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    const { data } = await supabase.from("usuarios").select("nome, user_id").eq("ativo", true);
    setAllUsers(data || []);
  }, [isAdmin]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSendMsg = async () => {
    if (!msgText.trim()) { toast.error("Digite a mensagem"); return; }
    const { error } = await supabase.from("mensagens_globais").insert([{
      mensagem: msgText,
      enviado_por: profile?.nome,
      enviado_por_user_id: (await supabase.auth.getUser()).data.user?.id,
      destinatarios: msgDestinatarios,
    }] as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Mensagem enviada!");
    setMsgOpen(false);
    setMsgText("");
    setMsgDestinatarios(["todos"]);
  };

  const toggleDestinatario = (nome: string) => {
    if (nome === "todos") {
      setMsgDestinatarios(["todos"]);
      return;
    }
    let updated = msgDestinatarios.filter(d => d !== "todos");
    if (updated.includes(nome)) {
      updated = updated.filter(d => d !== nome);
    } else {
      updated.push(nome);
    }
    setMsgDestinatarios(updated.length === 0 ? ["todos"] : updated);
  };

  const filteredNav = allNavItems.filter(item => {
    if (item.path === "/permissoes") return isAdmin;
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
        <img src={logoGranado} alt="Granado" className="h-8 w-8 rounded" />
        <span className="font-heading text-xl neon-text tracking-wider hidden sm:block">GDR</span>
        <span className="text-muted-foreground text-xs hidden sm:block">Granado Distribuidora</span>
        <div className="ml-auto flex items-center gap-3">
          {isAdmin && (
            <Button variant="ghost" size="icon" onClick={() => setMsgOpen(true)} title="Enviar mensagem global">
              <Bell className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
          <span className="text-sm text-foreground">{profile?.nome}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary font-semibold">{profile?.cargo}</span>
          <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden lg:flex flex-col w-56 min-h-[calc(100vh-3.5rem)] border-r border-border bg-card/50 backdrop-blur-sm p-3 gap-1 relative z-10">
          {filteredNav.map(item => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active ? "bg-primary/15 text-primary neon-border" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            );
          })}
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMobileOpen(false)}>
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
            <aside className="absolute left-0 top-14 bottom-0 w-64 border-r border-border bg-card p-3 space-y-1" onClick={e => e.stopPropagation()}>
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

      {/* Send global message modal */}
      <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
        <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading neon-text">Enviar Mensagem Global</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Textarea placeholder="Digite sua mensagem..." value={msgText} onChange={e => setMsgText(e.target.value)} className="bg-secondary" rows={3} />
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Destinatários</label>
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={msgDestinatarios.includes("todos")} onCheckedChange={() => toggleDestinatario("todos")} />
                  <span className="text-sm text-foreground">Todos</span>
                </label>
                {allUsers.map(u => (
                  <label key={u.user_id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox 
                      checked={msgDestinatarios.includes(u.nome)} 
                      onCheckedChange={() => toggleDestinatario(u.nome)}
                      disabled={msgDestinatarios.includes("todos")}
                    />
                    <span className="text-sm text-foreground">{u.nome}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button onClick={handleSendMsg} className="w-full bg-primary text-primary-foreground hover:bg-primary/80">
              <Send className="mr-2 h-4 w-4" /> Enviar Mensagem
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AppLayout;
