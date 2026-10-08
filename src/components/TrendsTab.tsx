import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Svg, { G, Path, Circle, Ellipse } from 'react-native-svg';
import { Award, Layers, Sparkles, Calendar } from 'lucide-react-native';
import { BodyPartDiscomfort } from '../types';
import { Gradient } from './Gradient';
import { useAuth } from '../auth/AuthContext';
import {
  getBreaksByDay,
  getPostureAveragesByDay,
  getDashboardStats,
  getCompletedBreaksCount,
  getDiscomforts,
  setDiscomfort,
} from '../db/repos';

interface Props {
  onOpenBreakModal: (index?: number) => void;
}

interface WeekDay {
  day: string;
  score: number | null;
  breaks: number;
}

type DiscomfortSeverity = 'none' | 'mild' | 'moderate';

const DEFAULT_DISCOMFORTS: Record<string, DiscomfortSeverity> = {
  neck: 'none',
  shoulders: 'none',
  lowerBack: 'none',
  wrists: 'none',
  eyes: 'none',
};

export const TrendsTab: React.FC<Props> = ({ onOpenBreakModal }) => {
  const { userId } = useAuth();

  // Weekly scores data
  const [weeklyData, setWeeklyData] = useState<WeekDay[]>([
    { day: 'Lun', score: null, breaks: 0 },
    { day: 'Mar', score: null, breaks: 0 },
    { day: 'Mié', score: null, breaks: 0 },
    { day: 'Jue', score: null, breaks: 0 },
    { day: 'Vie', score: null, breaks: 0 },
    { day: 'Sáb', score: null, breaks: 0 },
    { day: 'Dom', score: null, breaks: 0 },
  ]);
  const [avgScore, setAvgScore] = useState<number | null>(null);
  const [deltaPercent, setDeltaPercent] = useState<number | null>(null);
  const [completedBreaks, setCompletedBreaks] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Interactive Body Discomfort points
  const [discomforts, setDiscomforts] = useState<Record<string, DiscomfortSeverity>>(
    DEFAULT_DISCOMFORTS
  );

  const [selectedBodyPart, setSelectedBodyPart] = useState<string>('neck');

  const loadData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setLoadError('No hay una sesión disponible para cargar tus tendencias.');
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [breaksByDay, postureByDay, dashboardStats, completed, dbDiscomforts] =
        await Promise.all([
          getBreaksByDay(userId, 7),
          getPostureAveragesByDay(userId, 7),
          getDashboardStats(userId),
          getCompletedBreaksCount(userId),
          getDiscomforts(userId),
        ]);

      const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const next: WeekDay[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
          d.getDate()
        ).padStart(2, '0')}`;
        next.push({
          day: `${dayNames[d.getDay()]}${i === 0 ? ' (Hoy)' : ''}`,
          score: postureByDay.get(key) ?? null,
          breaks: breaksByDay.get(key)?.completedBreaks ?? 0,
        });
      }
      setWeeklyData(next);
      setAvgScore(dashboardStats.postureAverage7Days);

      const avg7 = dashboardStats.postureAverage7Days;
      const previousAvg = dashboardStats.postureAveragePrevious7Days;
      setDeltaPercent(
        avg7 !== null && previousAvg !== null && previousAvg > 0
          ? ((avg7 - previousAvg) / previousAvg) * 100
          : null
      );

      setCompletedBreaks(completed);

      const merged: Record<string, DiscomfortSeverity> = { ...DEFAULT_DISCOMFORTS };
      for (const [key, severity] of Object.entries(dbDiscomforts)) {
        merged[key] = severity === 'high' ? 'moderate' : severity;
      }
      setDiscomforts(merged);
    } catch (error) {
      console.warn(error);
      setLoadError('No pudimos cargar los datos locales de tendencias.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const toggleDiscomfort = async (part: string) => {
    setSelectedBodyPart(part);
    setSaveError(null);
    const current = discomforts[part] || 'none';
    const next: DiscomfortSeverity =
      current === 'none' ? 'mild' : current === 'mild' ? 'moderate' : 'none';
    setDiscomforts((prev) => ({ ...prev, [part]: next }));
    if (!userId) {
      setDiscomforts((prev) => ({ ...prev, [part]: current }));
      setSaveError('No hay una sesión disponible para guardar el cambio.');
      return;
    }
    try {
      await setDiscomfort(userId, part, next);
    } catch (error) {
      console.warn(error);
      setDiscomforts((prev) =>
        prev[part] === next ? { ...prev, [part]: current } : prev
      );
      setSaveError('No pudimos guardar la molestia. El cambio fue revertido.');
    }
  };

  const bodyPartDetails: Record<
    string,
    { name: string; desc: string; exerciseIndex: number; solution: string }
  > = {
    neck: {
      name: 'Columna Cervical (C1 - C7)',
      desc: 'Tensión por flexión continuada al mirar monitores o laptops bajas.',
      exerciseIndex: 0,
      solution: 'Retracción Cervical (Chin Tuck) y elevación de pantalla a la altura de los ojos.',
    },
    shoulders: {
      name: 'Trapecios & Cintura Escapular',
      desc: 'Sobrecarga estática en hombros al escribir sin reposabrazos o con tensión.',
      exerciseIndex: 1,
      solution: 'Rotación Escapular y ajuste de la altura de los apoyabrazos a 90°.',
    },
    lowerBack: {
      name: 'Región Lumbar & Cuadrado Lumbar',
      desc: 'Presión por sentarse en el borde sin soporte lumbar ergonómico.',
      exerciseIndex: 2,
      solution: 'Extensión Torácica y activación de soporte lumbar firme.',
    },
    wrists: {
      name: 'Muñecas & Flexores del Carpo',
      desc: 'Desviación radial o extensión excesiva por teclado inclinado.',
      exerciseIndex: 3,
      solution: 'Estiramiento de flexores y uso de muñequera o teclado plano.',
    },
    eyes: {
      name: 'Músculos Extraoculares & Visión',
      desc: 'Sequedad y astenopía por disminución de la tasa de parpadeo.',
      exerciseIndex: 4,
      solution: 'Descanso 20-20-20 y ejercicio de palming con calor palmar.',
    },
  };

  const activePart = bodyPartDetails[selectedBodyPart] || bodyPartDetails.neck;

  const scoredDays = weeklyData.filter((d) => d.score !== null).length;
  const goalDays = weeklyData.filter((d) => d.score !== null && d.score >= 85).length;
  const compliancePercent = scoredDays === 0 ? null : Math.round((goalDays / scoredDays) * 100);

  return (
    <View className="gap-6">
      {/* Trends Header */}
      <View className="bg-white rounded-2xl p-5 border border-slate-200/80 flex-col items-start justify-between gap-4">
        <View>
          <Text className="text-xs font-sans-semibold text-[#004ac6] uppercase tracking-wider">
            Histórico & Hábitos Ergonómicos
          </Text>
          <Text className="text-2xl font-sans-extrabold text-[#131b2e] tracking-tight">
            Tendencias & Mapa de Bienestar
          </Text>
          <Text className="text-xs text-[#434655] font-sans mt-0.5">
            Analiza tu evolución postural a lo largo de las semanas y rastrea puntos de tensión corporal.
          </Text>
        </View>

        <View className="flex-row items-center gap-2 bg-[#f2f3ff] px-4 py-2 rounded-full border border-slate-200/60">
          <Calendar size={16} color="#004ac6" />
          <Text className="text-xs font-sans-bold text-[#004ac6]">
            {loading
              ? 'Cargando datos locales...'
              : avgScore === null
              ? 'Últimos 7 días · Sin datos'
              : `Últimos 7 días · Promedio: ${avgScore.toFixed(1)} pts`}
          </Text>
        </View>

        {loadError ? (
          <View className="w-full flex-row items-center justify-between gap-3 rounded-xl bg-rose-50 p-3">
            <Text className="flex-1 text-xs font-sans-medium text-rose-700">{loadError}</Text>
            <Pressable onPress={() => void loadData()}>
              <Text className="text-xs font-sans-bold text-rose-700">Reintentar</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* Weekly Progress Bar Chart & Standing Desk Ratio */}
      <View className="flex-col gap-6">
        {/* Weekly Chart */}
        <View className="bg-white rounded-2xl p-6 border border-slate-200/80">
          <View className="flex-row items-center justify-between pb-3 border-b border-slate-100 mb-6">
            <View>
              <Text className="text-xs font-sans-semibold text-slate-500 uppercase tracking-wider">
                Evolución Diaria
              </Text>
              <Text className="text-base font-sans-bold text-[#131b2e]">Score Postural Semanal</Text>
            </View>
            {deltaPercent !== null && (
              <Text className="text-xs font-sans-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                {(deltaPercent >= 0 ? '+' : '−') +
                  Math.abs(deltaPercent).toFixed(1) +
                  '% vs semana pasada'}
              </Text>
            )}
          </View>

          {/* Bar Chart Visualization */}
          <View className="h-52 flex-row items-end justify-between gap-2 px-2 pt-4">
            {weeklyData.map((item, idx) => {
              const score = item.score;
              const hasScore = score !== null;
              const heightPercent = hasScore ? (score / 100) * 100 : 4;
              const isToday = idx === weeklyData.length - 1;

              return (
                <View key={item.day} className="flex-1 flex-col items-center gap-2">
                  <Text className="text-[10px] font-sans-bold text-slate-500 mb-1">
                    {hasScore ? `${score} pts` : '—'}
                  </Text>

                  <View className="w-full bg-[#f2f3ff] rounded-t-xl overflow-hidden h-40 flex-col justify-end">
                    {!hasScore ? (
                      <View
                        className="w-full rounded-t-xl bg-slate-200"
                        style={{ height: `${heightPercent}%` }}
                      />
                    ) : isToday ? (
                      <Gradient
                        direction="t"
                        from="#004ac6"
                        to="#06b6d4"
                        className="w-full rounded-t-xl"
                        style={{ height: `${heightPercent}%` }}
                      />
                    ) : (
                      <View
                        className="w-full rounded-t-xl bg-[#2563eb]/70"
                        style={{ height: `${heightPercent}%` }}
                      />
                    )}
                  </View>

                  <Text
                    className={`text-[11px] ${
                      isToday ? 'font-sans-bold text-[#004ac6]' : 'font-sans-semibold text-slate-500'
                    }`}
                  >
                    {item.day}
                  </Text>
                  <Text className="text-[9px] font-sans-medium text-slate-400">
                    {item.breaks} pausas
                  </Text>
                </View>
              );
            })}
          </View>

          <View className="pt-4 mt-2 border-t border-slate-100 flex-row items-center justify-between">
            <Text className="text-xs text-slate-500 font-sans">
              Objetivo ergonómico diario: {'>'} 85 puntos
            </Text>
            <Text className="text-xs font-sans-semibold text-[#004ac6]">
              {scoredDays === 0
                ? 'Sin datos'
                : `Cumplimiento: ${compliancePercent}% (${goalDays}/${scoredDays}) · Cobertura: ${scoredDays}/7`}
            </Text>
          </View>
        </View>

        {/* Sitting vs Standing Distribution */}
        <View className="bg-white rounded-2xl p-6 border border-slate-200/80 flex-col justify-between">
          <View>
            <View className="flex-row items-center gap-2 mb-1">
              <Layers size={16} color="#2563eb" />
              <Text className="text-xs font-sans-semibold text-slate-500 uppercase tracking-wider">
                Distribución de Postura
              </Text>
            </View>
            <Text className="text-base font-sans-bold text-[#131b2e]">Sentado vs. De Pie</Text>
            <Text className="text-xs text-[#434655] font-sans mt-1 leading-relaxed">
              El modo de pie todavía no registra intervalos históricos.
            </Text>
          </View>

          <View className="my-6 rounded-xl border border-slate-200 bg-[#faf8ff] p-4">
            <Text className="text-sm font-sans-bold text-[#131b2e]">Seguimiento no disponible</Text>
            <Text className="text-xs font-sans text-slate-600 mt-1 leading-relaxed">
              Podremos calcular esta distribución cuando los intervalos sentado y de pie se registren en el historial local.
            </Text>
          </View>

          <Text className="p-3 bg-[#faf8ff] rounded-xl border border-slate-100 text-xs text-slate-600 font-sans">
            <Text className="font-sans-bold">Consejo:</Text> alterná posiciones y movimiento según tu comodidad durante la jornada.
          </Text>
        </View>
      </View>

      {/* Interactive Body Discomfort Heatmap Tracker */}
      <View className="bg-white rounded-2xl p-6 border border-slate-200/80">
        <View className="pb-3 border-b border-slate-100 mb-6">
          <Text className="text-xs font-sans-semibold text-[#004ac6] uppercase tracking-wider">
            Autodiagnóstico Biomecánico
          </Text>
          <Text className="text-lg font-sans-bold text-[#131b2e]">
            Mapa Corporal Interactivo de Molestias
          </Text>
          <Text className="text-xs text-[#434655] font-sans mt-0.5">
            Haz clic en cualquier punto del cuerpo para registrar micro-tensiones y obtener su estiramiento específico.
          </Text>
          {saveError ? (
            <Text className="text-xs font-sans-semibold text-rose-700 mt-2">{saveError}</Text>
          ) : null}
        </View>

        <View className="flex-col gap-8">
          {/* Anatomical Silhouette Diagram */}
          <View className="flex-row justify-center">
            <View className="relative w-56 h-80 bg-[#f8fafc] rounded-2xl border border-slate-200/80 p-4 items-center justify-center">
              <Svg viewBox="0 0 200 320" width="100%" height="100%">
                {/* Silhouette paths */}
                {/* Head */}
                <Ellipse cx="100" cy="45" rx="20" ry="24" fill="#dae2fd" stroke="#737686" strokeWidth="2" />
                {/* Neck */}
                <Path d="M92 68 L92 82 M108 68 L108 82" stroke="#737686" strokeWidth="2.5" />
                {/* Torso & Shoulders */}
                <Path
                  d="M50 95 C65 82 135 82 150 95 L142 180 C130 190 70 190 58 180 Z"
                  fill="#eaedff"
                  stroke="#737686"
                  strokeWidth="2"
                />
                {/* Arms */}
                <Path d="M50 95 L32 150 L25 200" stroke="#737686" strokeWidth="3" strokeLinecap="round" />
                <Path d="M150 95 L168 150 L175 200" stroke="#737686" strokeWidth="3" strokeLinecap="round" />
                {/* Legs */}
                <Path d="M78 185 L75 250 L72 300" stroke="#737686" strokeWidth="4" strokeLinecap="round" />
                <Path d="M122 185 L125 250 L128 300" stroke="#737686" strokeWidth="4" strokeLinecap="round" />

                {/* Interactive Clickable Hotspots */}
                {/* 1. Neck */}
                <G onPress={() => toggleDiscomfort('neck')}>
                  <Circle
                    cx="100"
                    cy="75"
                    r={discomforts.neck !== 'none' ? '12' : '8'}
                    fill={discomforts.neck === 'none' ? '#004ac6' : discomforts.neck === 'mild' ? '#f59e0b' : '#ef4444'}
                  />
                  <Circle cx="100" cy="75" r="16" stroke="#2563eb" strokeWidth="1" strokeDasharray="2 2" />
                </G>

                {/* 2. Shoulders */}
                <G onPress={() => toggleDiscomfort('shoulders')}>
                  <Circle
                    cx="65"
                    cy="98"
                    r={discomforts.shoulders !== 'none' ? '11' : '7'}
                    fill={discomforts.shoulders === 'none' ? '#004ac6' : discomforts.shoulders === 'mild' ? '#f59e0b' : '#ef4444'}
                  />
                  <Circle
                    cx="135"
                    cy="98"
                    r={discomforts.shoulders !== 'none' ? '11' : '7'}
                    fill={discomforts.shoulders === 'none' ? '#004ac6' : discomforts.shoulders === 'mild' ? '#f59e0b' : '#ef4444'}
                  />
                </G>

                {/* 3. Lower Back */}
                <G onPress={() => toggleDiscomfort('lowerBack')}>
                  <Circle
                    cx="100"
                    cy="165"
                    r={discomforts.lowerBack !== 'none' ? '12' : '8'}
                    fill={discomforts.lowerBack === 'none' ? '#004ac6' : discomforts.lowerBack === 'mild' ? '#f59e0b' : '#ef4444'}
                  />
                </G>

                {/* 4. Wrists */}
                <G onPress={() => toggleDiscomfort('wrists')}>
                  <Circle
                    cx="25"
                    cy="195"
                    r={discomforts.wrists !== 'none' ? '10' : '6'}
                    fill={discomforts.wrists === 'none' ? '#004ac6' : discomforts.wrists === 'mild' ? '#f59e0b' : '#ef4444'}
                  />
                  <Circle
                    cx="175"
                    cy="195"
                    r={discomforts.wrists !== 'none' ? '10' : '6'}
                    fill={discomforts.wrists === 'none' ? '#004ac6' : discomforts.wrists === 'mild' ? '#f59e0b' : '#ef4444'}
                  />
                </G>

                {/* 5. Eyes */}
                <G onPress={() => toggleDiscomfort('eyes')}>
                  <Circle
                    cx="100"
                    cy="40"
                    r={discomforts.eyes !== 'none' ? '9' : '5'}
                    fill={discomforts.eyes === 'none' ? '#004ac6' : discomforts.eyes === 'mild' ? '#f59e0b' : '#ef4444'}
                  />
                </G>
              </Svg>
            </View>
          </View>

          {/* Right: Selected Zone Details & Targeted Action */}
          <View className="flex-col gap-4">
            <View className="p-5 bg-[#faf8ff] rounded-2xl border border-slate-200">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xs font-sans-bold text-[#004ac6] uppercase tracking-wider">
                  Zona Seleccionada
                </Text>
                <Text
                  className={`text-xs font-sans-bold px-2.5 py-0.5 rounded-full ${
                    discomforts[selectedBodyPart] === 'none'
                      ? 'bg-emerald-100 text-emerald-800'
                      : discomforts[selectedBodyPart] === 'mild'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {discomforts[selectedBodyPart] === 'none'
                    ? 'Sin molestias'
                    : discomforts[selectedBodyPart] === 'mild'
                    ? 'Tensión leve'
                    : 'Molestia moderada'}
                </Text>
              </View>

              <Text className="text-lg font-sans-bold text-[#131b2e]">{activePart.name}</Text>
              <Text className="text-xs text-[#434655] font-sans mt-1 leading-relaxed">{activePart.desc}</Text>

              <View className="mt-4 pt-3 border-t border-slate-200/80">
                <Text className="text-xs font-sans-semibold text-slate-700 mb-1">
                  Acción Terapéutica Recomendada:
                </Text>
                <Text className="text-xs text-[#00687a] font-sans-medium">{activePart.solution}</Text>
              </View>

              <View className="mt-4 flex-row flex-wrap items-center gap-3">
                <Pressable
                  onPress={() => onOpenBreakModal(activePart.exerciseIndex)}
                  className="flex-row items-center gap-2 px-5 py-2.5 rounded-full bg-[#2563eb] shadow-md"
                >
                  <Sparkles size={14} color="#ffffff" fill="#ffffff" />
                  <Text className="text-xs font-sans-bold text-white">Realizar Estiramiento Dirigido (15s)</Text>
                </Pressable>

                <Pressable
                  onPress={() => toggleDiscomfort(selectedBodyPart)}
                  className="px-4 py-2 rounded-full border border-slate-200 bg-white"
                >
                  <Text className="text-xs font-sans-semibold text-slate-700">Cambiar Nivel de Tensión</Text>
                </Pressable>
              </View>
            </View>

            {/* Quick quick toggles for body parts */}
            <View className="flex-row flex-wrap gap-2">
              {Object.keys(bodyPartDetails).map((key) => (
                <Pressable
                  key={key}
                  onPress={() => setSelectedBodyPart(key)}
                  className={`px-3 py-1.5 rounded-full border ${
                    selectedBodyPart === key
                      ? 'bg-[#eaedff] border-[#2563eb]'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <Text
                    className={`text-xs ${
                      selectedBodyPart === key
                        ? 'font-sans-bold text-[#004ac6]'
                        : 'font-sans-medium text-slate-600'
                    }`}
                  >
                    {bodyPartDetails[key].name.split(' ')[0]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* Ergonomic Habit Streaks & Badges */}
      <View className="bg-white rounded-2xl p-6 border border-slate-200/80">
        <View className="flex-row items-center gap-2 mb-4">
          <Award size={20} color="#f59e0b" />
          <Text className="text-base font-sans-bold text-[#131b2e]">Insignias de Salud Ocupacional</Text>
        </View>

        <View className="flex-col gap-4">
          <Text className="text-xs font-sans text-slate-500 leading-relaxed">
            Las insignias sin una fuente de datos verificable se habilitarán cuando esos hábitos se registren localmente.
          </Text>

          <Gradient
            direction="br"
            from="#faf8ff"
            to="#f2f3ff"
            className="p-4 rounded-xl border border-slate-200/70 flex-row items-start gap-3"
          >
            <View className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex-row items-center justify-center">
              <Text className="text-base font-sans">🧘</Text>
            </View>
            <View>
              <Text className="text-xs font-sans-bold text-[#131b2e]">Maestro Zen Postural</Text>
              <Text className="text-[11px] text-slate-500 font-sans mt-0.5">
                Completa 20 micro-pausas guiadas
              </Text>
              {completedBreaks >= 20 ? (
                <Text className="text-[10px] text-emerald-600 font-sans-bold mt-1">
                  ✓ Desbloqueada
                </Text>
              ) : (
                <Text className="text-[10px] text-[#004ac6] font-sans-bold mt-1">
                  Progreso: {completedBreaks}/20
                </Text>
              )}
            </View>
          </Gradient>
        </View>
      </View>
    </View>
  );
};
