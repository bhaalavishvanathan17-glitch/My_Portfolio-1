import { motion } from "framer-motion";
import { Smile, Frown, Meh, Angry, Frown as Fear, Sparkles, BrainCircuit } from "lucide-react";

interface ResultCardProps {
  emotion: string;
  inputType: "text" | "face";
  originalText?: string | null;
}

const emotionMap: Record<string, { icon: React.ElementType, color: string, label: string }> = {
  positive: { icon: Smile, color: "from-emerald-400 to-emerald-600", label: "Positive" },
  neutral: { icon: Meh, color: "from-blue-400 to-blue-600", label: "Neutral" },
  negative: { icon: Frown, color: "from-rose-400 to-rose-600", label: "Negative" },
  happy: { icon: Smile, color: "from-amber-300 to-orange-500", label: "Happy" },
  sad: { icon: Frown, color: "from-indigo-400 to-blue-600", label: "Sad" },
  angry: { icon: Angry, color: "from-red-500 to-rose-700", label: "Angry" },
  surprise: { icon: Sparkles, color: "from-fuchsia-400 to-purple-600", label: "Surprised" },
  fear: { icon: Fear, color: "from-slate-400 to-slate-600", label: "Fearful" },
};

export function ResultCard({ emotion, inputType, originalText }: ResultCardProps) {
  const config = emotionMap[emotion.toLowerCase()] || { icon: BrainCircuit, color: "from-primary to-secondary", label: emotion };
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="glass-card rounded-3xl p-8 max-w-md w-full mx-auto relative overflow-hidden"
    >
      <div className={`absolute inset-0 opacity-10 bg-gradient-to-br ${config.color}`} />
      
      <div className="relative z-10 flex flex-col items-center text-center">
        <div className={`w-24 h-24 rounded-full mb-6 flex items-center justify-center bg-gradient-to-br ${config.color} shadow-lg shadow-black/20`}>
          <Icon className="w-12 h-12 text-white" />
        </div>
        
        <h3 className="text-sm font-semibold tracking-widest uppercase text-muted-foreground mb-2">
          Detected {inputType === "text" ? "Sentiment" : "Emotion"}
        </h3>
        
        <p className={`text-5xl font-display font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-br ${config.color}`}>
          {config.label}
        </p>

        {originalText && (
          <div className="w-full bg-black/20 rounded-xl p-4 border border-white/5">
            <p className="text-sm text-muted-foreground italic line-clamp-3">
              "{originalText}"
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
