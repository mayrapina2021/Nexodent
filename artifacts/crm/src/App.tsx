import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Patients from "@/pages/patients";
import Appointments from "@/pages/appointments";
import Conversations from "@/pages/conversations";
import WhatsApp from "@/pages/whatsapp";
import Automations from "@/pages/automations";
import Settings from "@/pages/settings";
import AITraining from "@/pages/ai-training";
import Quotations from "@/pages/quotations";
import ClinicalHistory from "@/pages/clinical-history";
import Inventory from "@/pages/inventory";
import Treatments from "@/pages/treatments";
import Billing from "@/pages/billing";
import Pipeline from "@/pages/pipeline";
import Lab from "@/pages/lab";
import Marketing from "@/pages/marketing";
import PortalBooking from "@/pages/portal-booking";
import PortalConsent from "@/pages/portal-consent";


import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import { getAuthToken } from "@/lib/auth-token";

// Configuración de la API en producción
if (import.meta.env.PROD) {
  // NEXODENT: Actualizar esta URL con la URL real de Render después del despliegue
  setBaseUrl(import.meta.env.VITE_API_URL ?? "https://nexodent-api.onrender.com");
}

// Token-based auth — bypasses all cross-origin cookie restrictions
setAuthTokenGetter(getAuthToken);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 30000,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/patients" component={Patients} />
      <Route path="/appointments" component={Appointments} />
      <Route path="/conversations" component={Conversations} />
      <Route path="/whatsapp" component={WhatsApp} />
      <Route path="/automations" component={Automations} />
      <Route path="/settings" component={Settings} />
      <Route path="/ai-training" component={AITraining} />
      <Route path="/quotations" component={Quotations} />
      <Route path="/billing" component={Billing} />
      <Route path="/clinical/:patientId" component={ClinicalHistory} />
      <Route path="/inventory" component={Inventory} />
      <Route path="/treatments" component={Treatments} />
      <Route path="/pipeline" component={Pipeline} />
      <Route path="/lab" component={Lab} />
      <Route path="/marketing" component={Marketing} />
      <Route path="/portal/agendar" component={PortalBooking} />
      <Route path="/portal/consent/:token" component={PortalConsent} />
      <Route path="/" component={Dashboard} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
