import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

/**
 * Root application component.
 *
 * URL structure:
 *   /              → redirects to /kvælstof (default pillar)
 *   /kvælstof      → Nitrogen pillar
 *   /lavbund       → Lowland extraction pillar
 *   /skovrejsning  → Afforestation pillar
 *   /co2           → CO₂ emissions pillar
 *   /natur         → Protected nature pillar
 *
 * Sub-state is encoded as query params — see DenmarkMap and DataTable for details.
 * The Cloudflare Pages `public/_redirects` file ensures all paths serve index.html (SPA mode).
 */
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Root: overview landing — no pillar pre-selected */}
          <Route path="/" element={<Index />} />

          {/* Pillar views — Index reads the slug from useParams */}
          <Route path="/:pillarSlug" element={<Index />} />

          {/* Catch-all 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
