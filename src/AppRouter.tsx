import { lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
import NotFound from "./pages/NotFound";

const Home = lazy(() => import("./pages/Home"));
const CampaignBoard = lazy(() => import("./pages/CampaignBoard"));
const AuthorView = lazy(() => import("./pages/AuthorView"));
const About = lazy(() => import("./pages/About"));

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/campaign/:naddr" element={<CampaignBoard />} />
        <Route path="/a/:npub" element={<AuthorView />} />
        <Route path="/about" element={<About />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;
