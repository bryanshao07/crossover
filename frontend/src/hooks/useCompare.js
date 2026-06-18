import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

export const useCompare = (a, b) =>
  useQuery({ queryKey: ["compare", a, b], queryFn: () => api.compare(a, b), enabled: !!a && !!b });
