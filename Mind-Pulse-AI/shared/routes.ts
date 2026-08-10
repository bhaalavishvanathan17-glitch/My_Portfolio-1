import { z } from 'zod';
import { insertMoodSchema, moods } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  moods: {
    list: {
      method: 'GET' as const,
      path: '/api/moods' as const,
      responses: {
        200: z.array(z.custom<typeof moods.$inferSelect>()),
      },
    },
    analyzeText: {
      method: 'POST' as const,
      path: '/api/moods/text' as const,
      input: z.object({
        text: z.string().min(1, "Text is required"),
      }),
      responses: {
        201: z.custom<typeof moods.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    saveFaceEmotion: {
      method: 'POST' as const,
      path: '/api/moods/face' as const,
      input: z.object({
        emotion: z.string().min(1, "Emotion is required"),
      }),
      responses: {
        201: z.custom<typeof moods.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
