import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import ParticlesBackground from "@/components/ParticlesBackground";
import Watermark from "@/components/Watermark";
import logoGdr from "@/assets/logo-gdr.png";
import {
  LayoutDashboard, CalendarDays, Truck, Package, Tag, Users, History, LogOut, Menu, X, BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Agenda", icon: CalendarDays, path: "/agenda" },
  { label: "Descarga", icon: Truck, path: "/descarga" },
  { label: "Armazenagem", icon: Package, path: "/armazenagem" },
  { label: "Etiquetas", icon: Tag, path: "/etiquetas" },
  { label: "Relatórios", icon: BarChart3, path: "/relatorios" },
  { label: "Histórico", icon: History, path: "/historico" },
  { label: "Usuários", icon: Users, path: "/usuarios", adminOnly: true },
];

const AppLayout = ({ children }: { children: ReactNode }) => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = profile?.cargo === "Administrador";

  const filteredNav = navItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <div className="min-h-screen bg-background relative">
      <ParticlesBackground />
      <Watermark />

      {/* Top bar */}
      <header className="sticky top-0 z-50 h-14 border-b border-border bg-card/90 backdrop-blur-md flex items-center px-4 gap-3">
        <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden text-foreground">
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <img src={logoGdr} alt="GDR" className="h-8 w-8 rounded" />
        <span className="font-heading text-xl neon-text tracking-wider hidden sm:block">GDR</span>
        <span className="text-muted-foreground text-xs hidden sm:block">Granado Distribuidora</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-foreground">{profile?.nome}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary font-semibold">{profile?.cargo}</span>
          <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - desktop */}
        <aside className="hidden lg:flex flex-col w-56 min-h-[calc(100vh-3.5rem)] border-r border-border bg-card/50 backdrop-blur-sm p-3 gap-1 relative z-10">
          {filteredNav.map(item => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-primary/15 text-primary neon-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            );
          })}
        </aside>

        {/* Mobile nav */}
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
                      active
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
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

        {/* Main */}
        <main className="flex-1 relative z-10 p-4 md:p-6 overflow-auto min-h-[calc(100vh-3.5rem)]">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
