interface PointBadgeProps {
  point: number;
  showPlus?: boolean;
}

export default function PointBadge({ point, showPlus = true }: PointBadgeProps) {
  const cls = point > 0 ? "positive" : point < 0 ? "negative" : "text-gray-400";
  const prefix = point > 0 && showPlus ? "+" : "";
  return <span className={cls}>{prefix}{point}p</span>;
}
