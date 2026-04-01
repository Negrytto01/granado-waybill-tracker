import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import LoginPage from "@/pages/LoginPage";
import AppLayout from "@/components/AppLayout";
import DashboardPage from "@/pages/DashboardPage";
import AgendaPage from "@/pages/AgendaPage";
import DescargaPage from "@/pages/DescargaPage";
import ArmazenagemPage from "@/pages/ArmazenagemPage";
import HistoricoPage from "@/pages/HistoricoPage";
import UsuariosPage from "@/pages/UsuariosPage";
import RelatoriosPage from "@/pages/RelatoriosPage";
import ValoresDescargaPage from "@/pages/ValoresDescargaPage";
import ComprasPage from "@/pages/ComprasPage";
import FornecedoresUrgenciaPage from "@/pages/FornecedoresUrgenciaPage";
import FluxoFinanceiroPage from "@/pages/FluxoFinanceiroPage";
import PermissoesPage from "@/pages/PermissoesPage";
import CalendarioPage from "@/pages/CalendarioPage";
import SolicitacoesComprasPage from "@/pages/SolicitacoesComprasPage";
import CadastroVeiculosPage from "@/pages/CadastroVeiculosPage";
import HistPortariaPage from "@/pages/HistPortariaPage";
import AtividadesAdminPage from "@/pages/AtividadesAdminPage";
import FornecedoresNaoVieramPage from "@/pages/FornecedoresNaoVieramPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="neon-text font-heading text-2xl animate-pulse">Carregando...</div></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="neon-text font-heading text-2xl animate-pulse">Carregando...</div></div>;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/agenda" element={<ProtectedRoute><AgendaPage /></ProtectedRoute>} />
            <Route path="/descarga" element={<ProtectedRoute><DescargaPage /></ProtectedRoute>} />
            <Route path="/armazenagem" element={<ProtectedRoute><ArmazenagemPage /></ProtectedRoute>} />
            <Route path="/historico" element={<ProtectedRoute><HistoricoPage /></ProtectedRoute>} />
            <Route path="/usuarios" element={<ProtectedRoute><UsuariosPage /></ProtectedRoute>} />
            <Route path="/relatorios" element={<ProtectedRoute><RelatoriosPage /></ProtectedRoute>} />
            <Route path="/valores" element={<ProtectedRoute><ValoresDescargaPage /></ProtectedRoute>} />
            <Route path="/compras" element={<ProtectedRoute><ComprasPage /></ProtectedRoute>} />
            <Route path="/fornecedores" element={<ProtectedRoute><FornecedoresUrgenciaPage /></ProtectedRoute>} />
            <Route path="/financeiro" element={<ProtectedRoute><FluxoFinanceiroPage /></ProtectedRoute>} />
            <Route path="/permissoes" element={<ProtectedRoute><PermissoesPage /></ProtectedRoute>} />
            <Route path="/calendario" element={<ProtectedRoute><CalendarioPage /></ProtectedRoute>} />
            <Route path="/solicitacoes" element={<ProtectedRoute><SolicitacoesComprasPage /></ProtectedRoute>} />
            <Route path="/portaria" element={<ProtectedRoute><CadastroVeiculosPage /></ProtectedRoute>} />
            <Route path="/portaria-historico" element={<ProtectedRoute><HistPortariaPage /></ProtectedRoute>} />
            <Route path="/naovieram" element={<ProtectedRoute><FornecedoresNaoVieramPage /></ProtectedRoute>} />
            <Route path="/atividades" element={<ProtectedRoute><AtividadesAdminPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
