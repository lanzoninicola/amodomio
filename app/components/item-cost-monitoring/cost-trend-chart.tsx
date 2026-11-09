type TrendPoint = {
  date: string;
  label: string;
  value: number;
  count: number;
};

const CHART_WIDTH = 360;
const CHART_HEIGHT = 124;
const CHART_PADDING_X = 12;
const CHART_PADDING_Y = 12;

function buildPath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ");
}

export function CostTrendChart({
  data,
  emptyLabel = "Sem histórico suficiente para montar o gráfico.",
}: {
  data: TrendPoint[];
  emptyLabel?: string;
}) {
  const values = data.map((point) => point.value).filter((value) => Number.isFinite(value));

  if (values.length === 0) {
    return (
      <div className="flex h-36 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-500">
        {emptyLabel}
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const plotWidth = CHART_WIDTH - CHART_PADDING_X * 2;
  const plotHeight = CHART_HEIGHT - CHART_PADDING_Y * 2;

  const points = data.map((point, index) => {
    const x = CHART_PADDING_X + (index * plotWidth) / Math.max(data.length - 1, 1);
    const normalized = (point.value - min) / range;
    const y = CHART_HEIGHT - CHART_PADDING_Y - normalized * plotHeight;
    return { ...point, x, y };
  });

  const linePath = buildPath(points);
  const areaPath = `${linePath} L${points[points.length - 1].x} ${CHART_HEIGHT - CHART_PADDING_Y} L${points[0].x} ${CHART_HEIGHT - CHART_PADDING_Y} Z`;
  const tickStep = Math.max(1, Math.ceil(data.length / 4));

  return (
    <div>
      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-36 w-full overflow-visible">
        <defs>
          <linearGradient id="cost-trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0f172a" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line
          x1={CHART_PADDING_X}
          x2={CHART_WIDTH - CHART_PADDING_X}
          y1={CHART_HEIGHT - CHART_PADDING_Y}
          y2={CHART_HEIGHT - CHART_PADDING_Y}
          stroke="#cbd5e1"
          strokeDasharray="3 4"
        />
        <path d={areaPath} fill="url(#cost-trend-fill)" />
        <path d={linePath} fill="none" stroke="#0f172a" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => (
          <circle key={point.date} cx={point.x} cy={point.y} r="2.6" fill="#0f172a" />
        ))}
      </svg>
      <div className="mt-2 flex justify-between gap-2 text-[11px] text-slate-500">
        {data.map((point, index) =>
          index % tickStep === 0 || index === data.length - 1 ? (
            <span key={point.date} className="min-w-0 truncate">
              {point.label}
            </span>
          ) : (
            <span key={point.date} className="invisible">
              {point.label}
            </span>
          )
        )}
      </div>
    </div>
  );
}
