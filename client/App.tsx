import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Blogs from "./pages/Blogs";
import Events from "./pages/Events";
import FamilyTree from "./pages/FamilyTree";
import WhyFamilyVibes from "./pages/WhyFamilyVibes";
import JoinFamily from "./pages/JoinFamily";
import FamilySettings from "./pages/FamilySettings";
import Portal from "./pages/Portal";
import PublicEvent from "./pages/PublicEvent";
import PublicStory from "./pages/PublicStory";
import SiteHeader from "./components/layout/SiteHeader";
import SiteFooter from "./components/layout/SiteFooter";
import { AuthProvider } from "./contexts/AuthContext";
import { EventProvider } from "./contexts/EventContext";
import { FamilyProvider } from "./contexts/FamilyContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <FamilyProvider>
        <EventProvider>
          <BrowserRouter>
            <div className="flex min-h-screen flex-col">
              <SiteHeader />
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/stories" element={<Blogs />} />
                  <Route path="/events" element={<Events />} />
                  <Route path="/family-tree" element={<FamilyTree />} />
                  <Route path="/why-family-vibes" element={<WhyFamilyVibes />} />
                  <Route path="/join/:code" element={<JoinFamily />} />
                  <Route path="/family-settings" element={<FamilySettings />} />
                  <Route path="/portal" element={<Portal />} />
                  <Route path="/events/:id" element={<PublicEvent />} />
                  <Route path="/stories/:id" element={<PublicStory />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
              <SiteFooter />
            </div>
          </BrowserRouter>
        </EventProvider>
        </FamilyProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

const container = document.getElementById("root")! as any;
const existingRoot = container.__reactRoot as
  | ReturnType<typeof createRoot>
  | undefined;
const root = existingRoot ?? createRoot(container);
root.render(<App />);
container.__reactRoot = root;
