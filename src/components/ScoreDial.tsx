import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Stop } from 'react-native-svg';

interface Props {
  score: number | null; // 0 to 100, null before a valid measurement
  size?: number;
  subtitle?: string;
  statusLabel?: string;
}

export const ScoreDial: React.FC<Props> = ({
  score,
  size = 190,
  subtitle = 'Puntos de Salud Biomecánica',
  statusLabel,
}) => {
  const displayScore = score ?? 0;
  const strokeWidth = 10;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (Math.min(Math.max(displayScore, 0), 100) / 100) * circumference;

  let computedStatus = statusLabel;
  if (!computedStatus) {
    if (score === null) computedStatus = 'Sin medición';
    else if (score >= 88) computedStatus = 'Alineación Óptima';
    else if (score >= 70) computedStatus = 'Leve Fatiga Postural';
    else computedStatus = 'Corrección Requerida';
  }

  const statusColorClass =
    score === null
      ? 'text-slate-400'
      : score >= 88
      ? 'text-[#2563eb]'
      : score >= 70
      ? 'text-[#f59e0b]'
      : 'text-[#ef4444]';

  return (
    <View className="flex-col items-center justify-center">
      <View
        className="relative items-center justify-center"
        style={{ width: size, height: size }}
      >
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#2563eb" />
              <Stop offset="100%" stopColor="#06b6d4" />
            </LinearGradient>
          </Defs>

          <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
            {/* Track */}
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#f1f5f9"
              strokeWidth={strokeWidth}
            />

            {/* Progress Arc */}
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="url(#scoreGradient)"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </G>
        </Svg>

        {/* Center telemetry */}
        <View className="absolute inset-0 items-center justify-center">
          <Text className="font-sans-black text-4xl text-[#0f172a] tracking-tight leading-none">
             {score === null ? '—' : Math.round(score)}
          </Text>
          <Text className="text-[10px] font-sans-bold tracking-wider text-slate-400 uppercase mt-1">
            Índice Ergo
          </Text>
          <Text className={`text-xs font-sans-bold mt-1 ${statusColorClass}`}>
            {computedStatus}
          </Text>
        </View>
      </View>

      {subtitle ? (
        <Text className="text-xs text-slate-500 font-sans-medium text-center mt-2">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
};
