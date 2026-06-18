import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

export const useUniverse = () =>
  useQuery({ queryKey: ["universe"], queryFn: api.getUniverse, staleTime: Infinity });
