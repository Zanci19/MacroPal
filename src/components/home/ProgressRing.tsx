import React from "react";

type ProgressRingProps = {
  progress: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  size = 64,
  stroke = 8,
  children,
}) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = clamp(progress ?? 0, 0, 1);
  const dash = pct * circumference;

  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-center">
        {children ?? <div className="ring-pct">{Math.round(pct * 100)}%</div>}
      </div>
    </div>
  );
};

export default ProgressRing;
