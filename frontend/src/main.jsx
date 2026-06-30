import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { TransitionProvider } from "./context/TransitionContext";
import { UniverseProvider } from "./context/UniverseContext";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 60_000 } },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <UniverseProvider>
          <TransitionProvider>
            <App />
          </TransitionProvider>
        </UniverseProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
