import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import { BugReportFab } from "./components/BugReportFab";
import { RouteParamSanitizer } from "./components/RouteParamSanitizer";

// Heavy KommunePage (Leaflet choropleth) in its own chunk to keep the
// main bundle lean. Leaflet is already a dependency but the choropleth
// layer uses a separate GeoJSON file (~400 KB).
const KommunePage = lazy(() => import("./pages/KommunePage"));
const KommuneDetailPage = lazy(() => import("./pages/KommuneDetailPage"));

const DataMetodePage = lazy(() => import("./pages/DataMetodePage"));
const VidenscenterPage = lazy(() => import("./pages/VidenscenterPage"));

const queryClient = new QueryClient();

/**
 * Root application component.
 *
 * URL structure:
 *   /                        → overview landing (no pillar pre-selected)
 *   /kvælstof                → Nitrogen pillar
 *   /lavbund                 → Lowland extraction pillar
 *   /skovrejsning            → Afforestation pillar
 *   /co2                     → CO₂ emissions pillar
 *   /natur                   → Protected nature pillar
 *   /data-og-metode           → Data sources, methodology, transparency
 *   /videnscenter             → Knowledge center (SGAV background articles)
 *   /videnscenter/:articleSlug → Single article
 *   /kommuner                → Municipality overview (choropleth + table)
 *   /kommuner/:kommuneSlug   → Deep-linked kommune detail
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
        <RouteParamSanitizer />
        <BugReportFab />
        <Routes>
          {/* Root: overview landing — no pillar pre-selected */}
          <Route path="/" element={<Index />} />

          {/* Data & Methodology — transparency page */}
          <Route
            path="/data-og-metode"
            element={
              <Suspense fallback={null}>
                <DataMetodePage />
              </Suspense>
            }
          />

          {/* Videnscenter — SGAV background articles for SEO */}
          <Route
            path="/videnscenter"
            element={
              <Suspense fallback={null}>
                <VidenscenterPage />
              </Suspense>
            }
          />
          <Route
            path="/videnscenter/:articleSlug"
            element={
              <Suspense fallback={null}>
                <VidenscenterPage />
              </Suspense>
            }
          />

          {/* Municipality view — choropleth map + sortable table */}
          <Route
            path="/kommuner"
            element={
              <Suspense fallback={null}>
                <KommunePage />
              </Suspense>
            }
          />
          <Route
            path="/kommuner/:kommuneSlug"
            element={
              <Suspense fallback={null}>
                <KommuneDetailPage />
              </Suspense>
            }
          />

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
