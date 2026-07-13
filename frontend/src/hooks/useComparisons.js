import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export const useComparisons = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["comparisons"],
    queryFn: () => api.getComparisons(),
    enabled: !!user,
  });
};

export const useSaveComparison = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ player_a, player_b, similarity_score }) =>
      api.createComparison(player_a, player_b, similarity_score),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["comparisons"] }),
  });
};

export const useDeleteComparison = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.deleteComparison(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["comparisons"] }),
  });
};
