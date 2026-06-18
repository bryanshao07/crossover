import { Routes, Route } from "react-router-dom";
import PageShell from "./components/layout/PageShell";
import HomePage from "./pages/HomePage";
import PlayerProfilePage from "./pages/PlayerProfilePage";
import ComparisonPage from "./pages/ComparisonPage";
import ComparePickerPage from "./pages/ComparePickerPage";
import UniversePage from "./pages/UniversePage";
import SearchResultsPage from "./pages/SearchResultsPage";

export default function App() {
  return (
    <PageShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/player/:name" element={<PlayerProfilePage />} />
        <Route path="/compare" element={<ComparePickerPage />} />
        <Route path="/compare/:a/:b" element={<ComparisonPage />} />
        <Route path="/universe" element={<UniversePage />} />
        <Route path="/search" element={<SearchResultsPage />} />
      </Routes>
    </PageShell>
  );
}
