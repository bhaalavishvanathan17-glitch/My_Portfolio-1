import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const moods = pgTable("moods", {
  id: serial("id").primaryKey(),
  inputType: text("input_type").notNull(), // 'text' or 'face'
  emotion: text("emotion").notNull(), // 'positive', 'neutral', 'negative', 'happy', 'sad', 'angry', 'surprise', 'fear'
  originalText: text("original_text"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMoodSchema = createInsertSchema(moods).omit({ 
  id: true, 
  createdAt: true 
});

export type Mood = typeof moods.$inferSelect;
export type InsertMood = z.infer<typeof insertMoodSchema>;
