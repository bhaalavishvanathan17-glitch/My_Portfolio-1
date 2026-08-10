import { db } from "./db";
import { moods, type Mood, type InsertMood } from "@shared/schema";
import { desc } from "drizzle-orm";

export interface IStorage {
  getMoods(): Promise<Mood[]>;
  createMood(mood: InsertMood): Promise<Mood>;
}

export class DatabaseStorage implements IStorage {
  async getMoods(): Promise<Mood[]> {
    return await db.select().from(moods).orderBy(desc(moods.createdAt));
  }

  async createMood(insertMood: InsertMood): Promise<Mood> {
    const [mood] = await db.insert(moods).values(insertMood).returning();
    return mood;
  }
}

export const storage = new DatabaseStorage();