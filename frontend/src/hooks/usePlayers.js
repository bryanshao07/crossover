import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

export const usePlayers = () =>
  useQuery({ queryKey: ["players"], queryFn: api.getPlayers, staleTime: Infinity });
