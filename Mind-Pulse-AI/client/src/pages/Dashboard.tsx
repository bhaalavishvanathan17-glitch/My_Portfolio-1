import { useMemo } from "react";
import { motion } from "framer-motion";
import { NavBar } from "@/components/NavBar";
import { useMoods } from "@/hooks/use-moods";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell,
  CartesianGrid
} from "recharts";
import { Loader2, Activity, PieChart as PieChartIcon, BarChart3, Database } from "lucide-react";

const COLORS = ['#8b5cf6', '#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#64748b'];

export default function Dashboard() {
  const { data: moods, isLoading, error } = useMoods();

  const stats = useMemo(() => {
    if (!moods) return { total: 0, text: 0, face: 0, chartData: [], pieData: [] };
    
    let textCount = 0;
    let faceCount = 0;
    const counts: Record<string, number> = {};

    moods.forEach(m => {
      if (m.inputType === 'text') textCount++;
      if (m.inputType === 'face') faceCount++;
      
      const emotion = m.emotion.charAt(0).toUpperCase() + m.emotion.slice(1);
      counts[emotion] = (counts[emotion] || 0) + 1;
    });

    const chartData = Object.entries(counts)
      .map(([name, value]) => ({ name, count: value }))
      .sort((a, b) => b.count - a.count);

    return {
      total: moods.length,
      text: textCount,
      face: faceCount,
      chartData,
      pieData: chartData
    };
  }, [moods]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !moods) {
    return (
      <div className="min-h-screen flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="glass-card p-8 rounded-2xl text-center max-w-md">
            <Activity className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Failed to load analytics</h2>
            <p className="text-muted-foreground">Please try refreshing the page.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-10">
        
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-display font-bold mb-2">Analytics Overview</h1>
          <p className="text-muted-foreground">Insights and historical data of detected emotions.</p>
        </div>

        {/* Top Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6 rounded-3xl"
          >
            <div className="flex items-center gap-4 mb-4 text-primary">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Database className="w-6 h-6" />
              </div>
              <h3 className="font-semibold">Total Scans</h3>
            </div>
            <p className="text-5xl font-display font-bold">{stats.total}</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-6 rounded-3xl"
          >
            <div className="flex items-center gap-4 mb-4 text-blue-400">
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="font-semibold">Text Analysis</h3>
            </div>
            <p className="text-5xl font-display font-bold">{stats.text}</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-6 rounded-3xl"
          >
            <div className="flex items-center gap-4 mb-4 text-fuchsia-400">
              <div className="p-3 bg-fuchsia-500/10 rounded-xl">
                <PieChartIcon className="w-6 h-6" />
              </div>
              <h3 className="font-semibold">Face Scans</h3>
            </div>
            <p className="text-5xl font-display font-bold">{stats.face}</p>
          </motion.div>
        </div>

        {stats.total > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Bar Chart */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="glass-card p-6 sm:p-8 rounded-3xl"
            >
              <h3 className="text-xl font-display font-semibold mb-8">Emotion Distribution</h3>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      contentStyle={{ 
                        backgroundColor: 'rgba(15,23,42,0.9)', 
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        backdropFilter: 'blur(8px)',
                        color: 'white'
                      }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {stats.chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Pie Chart */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="glass-card p-6 sm:p-8 rounded-3xl flex flex-col"
            >
              <h3 className="text-xl font-display font-semibold mb-4">Breakdown Overview</h3>
              <div className="h-[350px] w-full flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="count"
                      stroke="none"
                    >
                      {stats.pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(15,23,42,0.9)', 
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        color: 'white'
                      }}
                      itemStyle={{ color: 'white' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-4 mt-2">
                {stats.pieData.map((entry, index) => (
                  <div key={`legend-${index}`} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    {entry.name}
                  </div>
                ))}
              </div>
            </motion.div>
            
          </div>
        ) : (
          <div className="glass-card p-12 rounded-3xl text-center">
            <Database className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-medium mb-2">No Data Yet</h3>
            <p className="text-muted-foreground">Head over to the detection page to run your first scan!</p>
          </div>
        )}

      </main>
    </div>
  );
}
