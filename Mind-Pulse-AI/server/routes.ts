import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

// A simple mock for sentiment analysis
function analyzeSentiment(text: string) {
  const positiveWords = ['happy', 'great', 'awesome', 'good', 'excellent', 'love', 'wonderful', 'fantastic', 'joy'];
  const negativeWords = ['sad', 'bad', 'terrible', 'awful', 'hate', 'depressed', 'angry', 'upset', 'worst'];
  
  const words = text.toLowerCase().match(/\b(\w+)\b/g) || [];
  let score = 0;
  
  words.forEach(word => {
    if (positiveWords.includes(word)) score++;
    if (negativeWords.includes(word)) score--;
  });
  
  if (score > 0) return 'positive';
  if (score < 0) return 'negative';
  return 'neutral';
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get(api.moods.list.path, async (req, res) => {
    try {
      const moods = await storage.getMoods();
      res.json(moods);
    } catch (err) {
      res.status(500).json({ message: "Failed to get moods" });
    }
  });

  app.post(api.moods.analyzeText.path, async (req, res) => {
    try {
      const input = api.moods.analyzeText.input.parse(req.body);
      const emotion = analyzeSentiment(input.text);
      
      const mood = await storage.createMood({
        inputType: 'text',
        emotion,
        originalText: input.text
      });
      res.status(201).json(mood);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.moods.saveFaceEmotion.path, async (req, res) => {
    try {
      const input = api.moods.saveFaceEmotion.input.parse(req.body);
      
      const mood = await storage.createMood({
        inputType: 'face',
        emotion: input.emotion,
      });
      res.status(201).json(mood);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Seed database
  const existingMoods = await storage.getMoods();
  if (existingMoods.length === 0) {
    await storage.createMood({ inputType: 'text', emotion: 'positive', originalText: 'I am feeling great today!' });
    await storage.createMood({ inputType: 'text', emotion: 'neutral', originalText: 'It is an okay day.' });
    await storage.createMood({ inputType: 'text', emotion: 'negative', originalText: 'I feel a bit sad and tired.' });
    await storage.createMood({ inputType: 'face', emotion: 'happy' });
    await storage.createMood({ inputType: 'face', emotion: 'sad' });
    await storage.createMood({ inputType: 'face', emotion: 'surprise' });
  }

  return httpServer;
}