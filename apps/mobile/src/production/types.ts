export type StatsRow = {
  size: string;
  min: number;
  max: number;
  avg: number;
  forecast: number;
  freqDays: number;
  freqPct: number;
};
export type DailyProgramming = {
  weekday: string;
  n: number;
  pct: number;
  stats: {
    sizes: string[];
    perSize: StatsRow[];
    lastByDate: { dateInt: number; counts: Record<string, number> }[];
  };
};
export type WeeklyHistory = {
  weeksCount: number;
  weeklyBySize: { size: string; min: number; max: number; total: number }[];
};
