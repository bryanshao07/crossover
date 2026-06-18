import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

export const useSearch = (filters) =>
  useQuery({ queryKey: ["search", filters], queryFn: () => api.search(filters) });
