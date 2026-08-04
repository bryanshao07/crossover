import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

// `options` is an optional react-query options passthrough. Smart search uses it
// to stay disabled until the user submits a query, so that typing never
// triggers a billable Gemini embedding call.
export const useSearch = (filters, options = {}) =>
  useQuery({
    queryKey: ["search", filters],
    queryFn: () => api.search(filters),
    ...options,
  });
