import { useState, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Camera, Sparkles, Loader2, RefreshCcw } from "lucide-react";
import { useAnalyzeText, useSaveFaceEmotion } from "@/hooks/use-moods";
import { ResultCard } from "@/components/ResultCard";
import { NavBar } from "@/components/NavBar";

export default function Home() {
  const [activeMode, setActiveMode] = useState<"text" | "face">("text");
  const [text, setText] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<{ emotion: string, type: "text" | "face", original?: string } | null>(null);
  
  const textMutation = useAnalyzeText();
  const faceMutation = useSaveFaceEmotion();
  
  const webcamRef = useRef<Webcam>(null);

  const handleAnalyzeText = async () => {
    if (!text.trim()) return;
    try {
      const res = await textMutation.mutateAsync(text);
      setResult({ emotion: res.emotion, type: "text", original: res.originalText || text });
    } catch (err) {
      console.error(err);
    }
  };

  const handleScanFace = async () => {
    setIsScanning(true);
    setResult(null);
    
    // Simulate complex AI scanning process
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    // Mock emotion detection
    const emotions = ['happy', 'sad', 'angry', 'neutral', 'surprise', 'fear'];
    const detected = emotions[Math.floor(Math.random() * emotions.length)];
    
    try {
      const res = await faceMutation.mutateAsync(detected);
      setResult({ emotion: res.emotion, type: "face" });
    } catch (err) {
      console.error(err);
    } finally {
      setIsScanning(false);
    }
  };

  const reset = () => {
    setResult(null);
    setText("");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-12 flex flex-col items-center">
        
        <div className="text-center max-w-2xl mb-12">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl sm:text-6xl font-display font-extrabold mb-6 tracking-tight leading-tight"
          >
            Understand <span className="text-gradient">Emotions</span> in Seconds
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-lg sm:text-xl text-muted-foreground"
          >
            Experience next-generation AI that analyzes sentiment from text or detects subtle micro-expressions in real-time.
          </motion.p>
        </div>

        {/* Mode Toggle */}
        <div className="glass-card p-1 rounded-2xl flex gap-1 mb-10 w-full max-w-md mx-auto">
          <button
            onClick={() => { setActiveMode("text"); setResult(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all ${
              activeMode === "text" 
                ? "bg-white/10 text-white shadow-sm" 
                : "text-muted-foreground hover:text-white hover:bg-white/5"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Text Analysis
          </button>
          <button
            onClick={() => { setActiveMode("face"); setResult(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all ${
              activeMode === "face" 
                ? "bg-white/10 text-white shadow-sm" 
                : "text-muted-foreground hover:text-white hover:bg-white/5"
            }`}
          >
            <Camera className="w-4 h-4" />
            Face Scan
          </button>
        </div>

        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div 
              key={`mode-${activeMode}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full max-w-2xl mx-auto"
            >
              {activeMode === "text" ? (
                <div className="glass-card p-6 sm:p-8 rounded-3xl">
                  <label className="block text-sm font-medium text-muted-foreground mb-3 ml-1">
                    What's on your mind?
                  </label>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type a sentence, paragraph, or paste text here..."
                    className="w-full h-40 bg-black/20 border border-white/10 rounded-2xl p-5 text-lg text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none transition-all mb-6"
                  />
                  <div className="flex justify-end">
                    <button 
                      onClick={handleAnalyzeText}
                      disabled={!text.trim() || textMutation.isPending}
                      className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center"
                    >
                      {textMutation.isPending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Sparkles className="w-5 h-5" />
                      )}
                      {textMutation.isPending ? "Analyzing..." : "Analyze Mood"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="glass-card p-6 sm:p-8 rounded-3xl flex flex-col items-center">
                  <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black/50 border border-white/10 mb-8 flex items-center justify-center shadow-inner">
                    <Webcam
                      ref={webcamRef}
                      audio={false}
                      mirrored={true}
                      className="w-full h-full object-cover"
                      videoConstraints={{ facingMode: "user" }}
                    />
                    {isScanning && (
                      <>
                        <div className="absolute inset-0 bg-primary/10 backdrop-blur-[2px]" />
                        <div className="scanner-line" />
                        <div className="absolute flex flex-col items-center gap-3">
                          <Loader2 className="w-8 h-8 text-primary animate-spin" />
                          <span className="text-white font-medium bg-black/40 px-4 py-1.5 rounded-full backdrop-blur-md">
                            Analyzing micro-expressions...
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  
                  <button 
                    onClick={handleScanFace}
                    disabled={isScanning}
                    className="btn-primary w-full sm:w-auto flex items-center justify-center gap-3 text-lg px-8 py-4"
                  >
                    <Camera className="w-5 h-5" />
                    {isScanning ? "Scanning..." : "Start Face Scan"}
                  </button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full"
            >
              <ResultCard 
                emotion={result.emotion} 
                inputType={result.type} 
                originalText={result.original} 
              />
              <div className="mt-8 flex justify-center">
                <button 
                  onClick={reset}
                  className="flex items-center gap-2 text-muted-foreground hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-6 py-3 rounded-full font-medium"
                >
                  <RefreshCcw className="w-4 h-4" />
                  Analyze Another
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
