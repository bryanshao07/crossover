import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

export const usePlayer = (name) =>
  useQuery({ queryKey: ["player", name], queryFn: () => api.getPlayer(name), enabled: !!name });
