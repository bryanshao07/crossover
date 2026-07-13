import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export const useFavorites = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["favorites"],
    queryFn: () => api.getFavorites(),
    enabled: !!user,
  });
};

export const useAddFavorite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (playerName) => api.createFavorite(playerName),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["favorites"] }),
    onError: (err) => {
      // 409 means it's already favorited (unique constraint) — treat as success, just resync.
      if (err.response?.status === 409) {
        queryClient.invalidateQueries({ queryKey: ["favorites"] });
      }
    },
  });
};

export const useRemoveFavorite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.deleteFavorite(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["favorites"] }),
  });
};
