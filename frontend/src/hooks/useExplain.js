import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

export const useExplain = (a, b, { enabled } = { enabled: false }) =>
  useQuery({ queryKey: ["explain", a, b], queryFn: () => api.explain(a, b), enabled });
