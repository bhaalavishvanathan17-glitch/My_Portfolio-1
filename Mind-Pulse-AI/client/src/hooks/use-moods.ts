import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";

// Utility to parse and log Zod errors safely
function parseWithLogging<T>(schema: any, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[Zod] ${label} validation failed:`, result.error.format());
    throw new Error(`Invalid response structure for ${label}`);
  }
  return result.data;
}

export function useMoods() {
  return useQuery({
    queryKey: [api.moods.list.path],
    queryFn: async () => {
      const res = await fetch(api.moods.list.path, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch moods');
      const data = await res.json();
      return parseWithLogging<typeof api.moods.list.responses[200]._type>(
        api.moods.list.responses[200], 
        data, 
        "moods.list"
      );
    },
  });
}

export function useAnalyzeText() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (text: string) => {
      const validatedInput = api.moods.analyzeText.input.parse({ text });
      
      const res = await fetch(api.moods.analyzeText.path, {
        method: api.moods.analyzeText.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validatedInput),
        credentials: "include",
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to analyze text');
      }
      
      const data = await res.json();
      return parseWithLogging<typeof api.moods.analyzeText.responses[201]._type>(
        api.moods.analyzeText.responses[201],
        data,
        "moods.analyzeText"
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.moods.list.path] });
    },
  });
}

export function useSaveFaceEmotion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (emotion: string) => {
      const validatedInput = api.moods.saveFaceEmotion.input.parse({ emotion });
      
      const res = await fetch(api.moods.saveFaceEmotion.path, {
        method: api.moods.saveFaceEmotion.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validatedInput),
        credentials: "include",
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to save face emotion');
      }
      
      const data = await res.json();
      return parseWithLogging<typeof api.moods.saveFaceEmotion.responses[201]._type>(
        api.moods.saveFaceEmotion.responses[201],
        data,
        "moods.saveFaceEmotion"
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.moods.list.path] });
    },
  });
}
