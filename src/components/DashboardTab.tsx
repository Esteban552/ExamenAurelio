import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Eye,
  Activity,
  Layers,
  Clock,
  Sun,
  Volume2,
} from 'lucide-react-native';
import { PostureMetrics, AmbientMetrics } from '../types';
import { ScoreDial } from './ScoreDial';
import { Gradient } from './Gradient';
import { soundService } from '../utils/audio';
import { useAuth } from '../auth/AuthContext';
import { DashboardStats, getDashboardStats } from '../db/repos';

const POMODORO_DURATION_MS = 25 * 60 * 1000;

interface PomodoroState {
  targetAt: number | null;
  remainingMs: number;
}

interface SedentaryState {
  elapsedMs: number;
  seatedSince: number | null;
}

interface Props {
  posture: PostureMetrics;
  ambient: AmbientMetrics;
  onOpenBreakModal: (index?: number) => void;
  isStandingMode: boolean;
  onToggleStanding: () => void;
  onNavigateToPosture: () => void;
  onNavigateToAmbient: () => void;
}

export const DashboardTab: React.FC<Props> = ({
  posture,
  ambient,
  onOpenBreakModal,
  isStandingMode,
  onToggleStanding,
  onNavigateToPosture,
  onNavigateToAmbient,
}) => {
  const { session, userId } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(Date.now());
  const [temporalReady, setTemporalReady] = useState(false);
  const [pomodoro, setPomodoro] = useState<PomodoroState>({
    targetAt: null,
    remainingMs: POMODORO_DURATION_MS,
  });
  const [sedentary, setSedentary] = useState<SedentaryState>({
    elapsedMs: 0,
    seatedSince: null,
  });
  const sedentaryRef = useRef(sedentary);
  const previousStandingRef = useRef(isStandingMode);
  const handledExpiryRef = useRef<number | null>(null);
  const openBreakModalRef = useRef(onOpenBreakModal);
  sedentaryRef.current = sedentary;
  openBreakModalRef.current = onOpenBreakModal;

  const loadStats = useCallback(async () => {
    if (!userId) {
      setStats(null);
      setStatsLoading(false);
      setStatsError('No hay una sesión disponible para cargar tus datos.');
      return;
    }
    setStatsLoading(true);
    setStatsError(null);
    try {
      setStats(await getDashboardStats(userId));
    } catch (error) {
      console.warn(error);
      setStats(null);
      setStatsError('No pudimos cargar el resumen local.');
    } finally {
      setStatsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (!userId) {
      setTemporalReady(false);
      return;
    }
    let cancelled = false;
    const sedentaryKey = `ergofocus:sedentary:${userId}`;
    const pomodoroKey = `ergofocus:pomodoro:${userId}`;
    setTemporalReady(false);
    handledExpiryRef.current = null;

    Promise.all([AsyncStorage.getItem(sedentaryKey), AsyncStorage.getItem(pomodoroKey)])
      .then(([savedSedentary, savedPomodoro]) => {
        if (cancelled) return;
        const currentTime = Date.now();
        let nextSedentary: SedentaryState = {
          elapsedMs: 0,
          seatedSince: isStandingMode ? null : currentTime,
        };
        let nextPomodoro: PomodoroState = {
          targetAt: null,
          remainingMs: POMODORO_DURATION_MS,
        };

        try {
          const parsed = savedSedentary ? (JSON.parse(savedSedentary) as SedentaryState) : null;
          if (
            parsed &&
            Number.isFinite(parsed.elapsedMs) &&
            (parsed.seatedSince === null || Number.isFinite(parsed.seatedSince))
          ) {
            nextSedentary = isStandingMode
              ? { elapsedMs: 0, seatedSince: null }
              : {
                  elapsedMs: Math.max(0, parsed.elapsedMs),
                  seatedSince: parsed.seatedSince ?? currentTime,
                };
          }
        } catch {}

        try {
          const parsed = savedPomodoro ? (JSON.parse(savedPomodoro) as PomodoroState) : null;
          if (
            parsed &&
            (parsed.targetAt === null || Number.isFinite(parsed.targetAt)) &&
            Number.isFinite(parsed.remainingMs)
          ) {
            nextPomodoro = {
              targetAt: parsed.targetAt,
              remainingMs: Math.max(0, parsed.remainingMs),
            };
          }
        } catch {}

        setClockNow(currentTime);
        sedentaryRef.current = nextSedentary;
        setSedentary(nextSedentary);
        setPomodoro(nextPomodoro);
        previousStandingRef.current = isStandingMode;
        setTemporalReady(true);
      })
      .catch((error) => {
        console.warn(error);
        if (!cancelled) {
          const currentTime = Date.now();
          const next = { elapsedMs: 0, seatedSince: isStandingMode ? null : currentTime };
          sedentaryRef.current = next;
          setSedentary(next);
          setTemporalReady(true);
        }
      });

    return () => {
      cancelled = true;
      const current = sedentaryRef.current;
      const elapsedMs =
        current.elapsedMs + (current.seatedSince === null ? 0 : Date.now() - current.seatedSince);
      void AsyncStorage.setItem(
        sedentaryKey,
        JSON.stringify({ elapsedMs, seatedSince: current.seatedSince === null ? null : Date.now() })
      );
    };
  }, [userId]);

  useEffect(() => {
    if (!temporalReady || !userId) return;
    const key = `ergofocus:sedentary:${userId}`;
    if (isStandingMode) {
      const next = { elapsedMs: 0, seatedSince: null };
      sedentaryRef.current = next;
      setSedentary(next);
      void AsyncStorage.setItem(key, JSON.stringify(next));
    } else if (previousStandingRef.current) {
      const next = { elapsedMs: 0, seatedSince: Date.now() };
      sedentaryRef.current = next;
      setSedentary(next);
      void AsyncStorage.setItem(key, JSON.stringify(next));
    }
    previousStandingRef.current = isStandingMode;
  }, [isStandingMode, temporalReady, userId]);

  useEffect(() => {
    if (!temporalReady) return;
    const timer = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [temporalReady]);

  useEffect(() => {
    const targetAt = pomodoro.targetAt;
    if (!temporalReady || !userId || targetAt === null || targetAt > clockNow) return;
    if (handledExpiryRef.current === targetAt) return;
    handledExpiryRef.current = targetAt;
    setPomodoro({ targetAt: null, remainingMs: 0 });
    void (async () => {
      try {
        await AsyncStorage.removeItem(`ergofocus:pomodoro:${userId}`);
      } catch (error) {
        console.warn(error);
      }
      soundService.playSuccessChime();
      openBreakModalRef.current();
    })();
  }, [clockNow, pomodoro.targetAt, temporalReady, userId]);

  const isPomodoroActive = pomodoro.targetAt !== null;
  const pomodoroRemainingMs = isPomodoroActive
    ? Math.max(0, pomodoro.targetAt! - clockNow)
    : pomodoro.remainingMs;
  const totalPomodoroSeconds = Math.ceil(pomodoroRemainingMs / 1000);
  const pomodoroMinutes = Math.floor(totalPomodoroSeconds / 60);
  const pomodoroSeconds = totalPomodoroSeconds % 60;
  const sedentaryElapsedMs =
    sedentary.elapsedMs +
    (sedentary.seatedSince === null ? 0 : Math.max(0, clockNow - sedentary.seatedSince));
  const sedentaryMinutes = Math.floor(sedentaryElapsedMs / 60000);

  const togglePomodoro = () => {
    if (!userId || !temporalReady) return;
    const key = `ergofocus:pomodoro:${userId}`;
    if (isPomodoroActive) {
      const next = {
        targetAt: null,
        remainingMs: Math.max(0, pomodoro.targetAt! - Date.now()),
      };
      setPomodoro(next);
      void AsyncStorage.setItem(key, JSON.stringify(next));
      return;
    }
    const remainingMs = pomodoro.remainingMs > 0 ? pomodoro.remainingMs : POMODORO_DURATION_MS;
    const next = { targetAt: Date.now() + remainingMs, remainingMs };
    handledExpiryRef.current = null;
    setPomodoro(next);
    void AsyncStorage.setItem(key, JSON.stringify(next));
  };

  const resetPomodoro = () => {
    setPomodoro({ targetAt: null, remainingMs: POMODORO_DURATION_MS });
    handledExpiryRef.current = null;
    if (userId) void AsyncStorage.removeItem(`ergofocus:pomodoro:${userId}`);
  };

  const formattedTime = `${String(pomodoroMinutes).padStart(2, '0')}:${String(
    pomodoroSeconds
  ).padStart(2, '0')}`;
  const metadata = session?.user.user_metadata as Record<string, unknown> | undefined;
  const metadataName = metadata?.full_name ?? metadata?.name;
  const greetingName =
    (typeof metadataName === 'string' && metadataName.trim()) ||
    session?.user.email?.split('@')[0] ||
    'usuario';
  const detectorActive = posture.detected && posture.source === 'detector';
  const detectorLabel = !detectorActive
    ? 'Sin detección postural'
    : posture.status === 'optimal'
    ? 'Postura detectada · estable'
    : posture.status === 'warning'
    ? 'Postura detectada · atención'
    : posture.status === 'alert'
    ? 'Postura detectada · corrección necesaria'
    : 'Postura detectada';
  const detectorDotClass = !detectorActive
    ? 'bg-slate-300'
    : posture.status === 'optimal'
    ? 'bg-emerald-500'
    : posture.status === 'warning'
    ? 'bg-amber-500'
    : posture.status === 'alert'
    ? 'bg-rose-500'
    : 'bg-blue-500';
  const detectorNarrative = detectorActive
    ? posture.statusMessage || 'El detector registró una muestra postural.'
    : 'Abrí la vista de postura y ubicá el torso completo para iniciar una medición.';
  const weeklyDelta =
    stats?.postureAverage7Days !== null &&
    stats?.postureAverage7Days !== undefined &&
    stats.postureAveragePrevious7Days !== null &&
    stats.postureAveragePrevious7Days !== undefined
      ? stats.postureAverage7Days - stats.postureAveragePrevious7Days
      : null;
  const luxLabel =
    ambient.luxStatus === 'optima'
      ? 'Rango óptimo'
      : ambient.luxStatus === 'baja'
      ? 'Iluminación baja'
      : 'Iluminación excesiva';
  const noiseLabel =
    ambient.decibels === 0
      ? 'Sin medición'
      : ambient.noiseStatus === 'silencioso'
      ? 'Ambiente silencioso'
      : ambient.noiseStatus === 'moderado'
      ? 'Ruido moderado'
      : 'Ambiente ruidoso';

  return (
    <View className="gap-6">
      {/* Top Welcome & Ergonomic Status Banner */}
      <View className="bg-white rounded-2xl p-5 border border-slate-200/80 flex-col items-start justify-between gap-4">
        <View>
          <View className="flex-row items-center gap-2 mb-1">
            <View
              className={`w-2.5 h-2.5 rounded-full ${detectorDotClass}`}
            />
            <Text className="text-xs font-sans-semibold text-[#00687a] tracking-wide uppercase">
              {detectorLabel}
            </Text>
          </View>
          <Text className="text-2xl font-sans-extrabold text-[#131b2e] tracking-tight">
            Hola, {greetingName}
          </Text>
          <Text className="text-xs text-[#434655] font-sans mt-0.5">
            {detectorNarrative}
          </Text>
        </View>

        {/* Quick Mode Toggle */}
        <View className="flex-row items-center gap-3 w-full">
          <Pressable
            onPress={onToggleStanding}
            className={`flex-1 flex-row items-center justify-center gap-2 px-4 py-2.5 rounded-full border ${
              isStandingMode
                ? 'bg-[#eaedff] border-[#2563eb]/40 shadow-sm'
                : 'bg-[#faf8ff] border-slate-200'
            }`}
          >
            <Layers size={16} color="#2563eb" />
            <Text
              className={`text-xs font-sans-semibold ${
                isStandingMode ? 'text-[#004ac6]' : 'text-[#434655]'
              }`}
            >
              {isStandingMode ? 'Trabajando de Pie' : 'Trabajando Sentado'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => onOpenBreakModal()}
            className="flex-1 flex-row items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#2563eb] shadow-md"
          >
            <Sparkles size={16} color="#ffffff" fill="#ffffff" />
            <Text className="text-xs font-sans-bold text-white">Pausa Activa (60s)</Text>
          </Pressable>
        </View>
      </View>

      {/* Hero Grid: Ergonomic Score Dial & Focus Timer */}
      <View className="flex-col gap-6">
        {/* Main Dial Card */}
        <View className="bg-white rounded-2xl p-6 border border-slate-200/80 flex-col justify-between">
          <View className="flex-row items-center justify-between pb-3 border-b border-slate-100">
            <View>
              <Text className="text-xs font-sans-semibold text-slate-500 uppercase tracking-wider">
                Índice de Telemetría Biomecánica
              </Text>
              <Text className="text-lg font-sans-bold text-[#131b2e]">Score Postural en Tiempo Real</Text>
            </View>
            <Pressable
              onPress={onNavigateToPosture}
              accessibilityLabel="Calibrar Visión"
              className="flex-row items-center gap-1"
            >
              <Text className="text-xs font-sans-semibold text-[#004ac6]">Calibrar Visión</Text>
              <ArrowUpRight size={14} color="#004ac6" />
            </Pressable>
          </View>

          <View className="py-6 flex-col items-center justify-around gap-6">
            <ScoreDial score={posture.score} />

            <View className="gap-3.5 w-full">
              <View className="flex-row items-center gap-2.5">
                <View className="w-2 h-2 rounded-full bg-emerald-500" />
                <View>
                  <Text className="text-xs text-slate-500 font-sans">Tendencia semanal</Text>
                  <Text className="text-sm font-sans-bold text-[#131b2e]">
                    {statsLoading
                      ? 'Cargando datos...'
                      : weeklyDelta === null
                      ? 'Sin datos comparables'
                      : `${weeklyDelta >= 0 ? '+' : '−'}${Math.abs(weeklyDelta).toFixed(
                          1
                        )} pts vs semana anterior`}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center gap-2.5">
                <View className="w-2 h-2 rounded-full bg-[#2563eb]" />
                <View>
                  <Text className="text-xs text-slate-500 font-sans">Postura sostenida</Text>
                  <Text className="text-sm font-sans-bold text-[#131b2e]">
                    {statsLoading
                      ? 'Cargando datos...'
                      : stats?.neutralPosturePercent7Days === null ||
                        stats?.neutralPosturePercent7Days === undefined
                      ? 'Sin muestras en los últimos 7 días'
                      : `${Math.round(stats.neutralPosturePercent7Days)}% de muestras con score ≥ 85`}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center gap-2.5">
                <View className="w-2 h-2 rounded-full bg-[#06b6d4]" />
                <View>
                  <Text className="text-xs text-slate-500 font-sans">Micro-pausas hoy</Text>
                  <Text className="text-sm font-sans-bold text-[#131b2e]">
                    {statsLoading
                      ? 'Cargando datos...'
                      : `${stats?.completedBreaksToday ?? 0} sesiones completadas`}
                  </Text>
                </View>
              </View>

              {statsError ? (
                <View className="flex-row items-center justify-between gap-3 rounded-xl bg-rose-50 p-3">
                  <Text className="flex-1 text-xs font-sans-medium text-rose-700">{statsError}</Text>
                  <Pressable onPress={() => void loadStats()}>
                    <Text className="text-xs font-sans-bold text-rose-700">Reintentar</Text>
                  </Pressable>
                </View>
              ) : !statsLoading && stats?.postureSamples7Days === 0 ? (
                <Text className="text-xs font-sans-medium text-slate-500">
                  Todavía no hay muestras posturales para este período.
                </Text>
              ) : null}
            </View>
          </View>

          <View className="pt-3 border-t border-slate-100 flex-row items-center justify-between">
            <Text className="text-xs text-slate-500 font-sans">
              {posture.measuredAt
                ? `Última medición: ${new Date(posture.measuredAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : 'Aún no hay una medición postural'}
            </Text>
            <View className="flex-row items-center gap-1">
              <ShieldCheck size={14} color={detectorActive ? '#059669' : '#94a3b8'} />
              <Text
                className={`text-xs font-sans-semibold ${
                  detectorActive ? 'text-emerald-600' : 'text-slate-500'
                }`}
              >
                {detectorActive ? 'Muestra detectada' : 'Detector en espera'}
              </Text>
            </View>
          </View>
        </View>

        {/* Focus & Posture Timer (Pomodoro) */}
        <Gradient
          direction="br"
          from="#ffffff"
          to="#f2f3ff"
          className="rounded-2xl p-6 border border-slate-200/80 flex-col justify-between"
        >
          <View>
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center gap-1">
                <Clock size={14} color="#004ac6" />
                <Text className="text-xs font-sans-semibold text-[#004ac6] uppercase tracking-wider">
                  Enfoque Ergonómico
                </Text>
              </View>
              <Text className="text-[11px] font-sans-bold px-2 py-0.5 rounded-full bg-[#eaedff] text-[#004ac6]">
                25m Trabajo / 5m Estiramiento
              </Text>
            </View>
            <Text className="text-lg font-sans-bold text-[#131b2e]">Bloque de Concentración</Text>
            <Text className="text-xs text-[#434655] font-sans mt-1">
              Previene fatiga ocular y sedentarismo prolongado programando descansos activos.
            </Text>
          </View>

          <View className="my-6">
            <Text className="text-5xl font-sans-black text-[#004ac6] tracking-tight text-center">
              {formattedTime}
            </Text>
            <Text className="text-xs font-sans-medium text-slate-500 mt-1 text-center">
              {isPomodoroActive
                ? 'Monitoreando postura en sesión de trabajo...'
                : pomodoro.remainingMs < POMODORO_DURATION_MS
                ? 'Sesión pausada'
                : 'Listo para comenzar tu intervalo'}
            </Text>
          </View>

          <View className="flex-row items-center justify-center gap-3">
            <Pressable
              onPress={togglePomodoro}
              className="flex-1 flex-row items-center justify-center gap-2 py-3 px-6 rounded-full bg-[#2563eb] shadow-md"
            >
              {isPomodoroActive ? (
                <>
                  <Pause size={16} color="#ffffff" fill="#ffffff" />
                  <Text className="text-sm font-sans-bold text-white">Pausar Sesión</Text>
                </>
              ) : (
                <>
                  <Play size={16} color="#ffffff" fill="#ffffff" />
                  <Text className="text-sm font-sans-bold text-white">Iniciar Enfoque</Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={resetPomodoro}
              accessibilityLabel="Reiniciar temporizador"
              className="p-3 rounded-full border border-slate-200"
            >
              <RotateCcw size={16} color="#475569" />
            </Pressable>
          </View>
        </Gradient>
      </View>

      {/* 4 Core Biometric Telemetry Cards */}
      <View className="flex-col gap-4">
        {/* Cervical Alignment */}
        <View className="bg-white rounded-2xl p-5 border border-slate-200/80">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xs font-sans-semibold uppercase tracking-wider text-slate-500">
              Alineación Cervical
            </Text>
            <Activity size={16} color="#2563eb" />
          </View>
          <Text className="text-3xl font-sans-black text-[#131b2e]">
            {posture.cervicalAngle === null ? '—' : `${posture.cervicalAngle}°`}
          </Text>
          <View className="mt-2 flex-row items-center justify-between">
            <Text className="text-xs text-slate-500 font-sans">Inclinación sagital</Text>
            <Text className="text-xs font-sans-bold text-slate-600">
              {posture.cervicalAngle === null
                ? 'Sin medición'
                : posture.cervicalAngle >= 10 && posture.cervicalAngle <= 15
                ? 'Rango neutro'
                : 'Fuera del rango 10-15°'}
            </Text>
          </View>
          <View className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
            <View
              className="bg-[#2563eb] h-1.5 rounded-full"
              style={{ width: `${posture.cervicalAngle === null ? 0 : Math.min(100, Math.max(10, 100 - posture.cervicalAngle * 2))}%` }}
            />
          </View>
        </View>

        {/* Screen Distance */}
        <View className="bg-white rounded-2xl p-5 border border-slate-200/80">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xs font-sans-semibold uppercase tracking-wider text-slate-500">
              Distancia de Pantalla
            </Text>
            <Eye size={16} color="#06b6d4" />
          </View>
          <Text className="text-3xl font-sans-black text-[#131b2e]">
            {posture.distanceCm === null ? '—' : `${posture.distanceCm} cm`}
          </Text>
          <View className="mt-2 flex-row items-center justify-between">
            <Text className="text-xs text-slate-500 font-sans">Rango ergonómico</Text>
            <Text className="text-xs font-sans-bold text-emerald-600">50 - 70 cm</Text>
          </View>
          <View className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
            <View
              className="bg-[#06b6d4] h-1.5 rounded-full"
              style={{ width: `${posture.distanceCm === null ? 0 : Math.min(100, (posture.distanceCm / 70) * 100)}%` }}
            />
          </View>
        </View>

        {/* Shoulder Symmetry */}
        <View className="bg-white rounded-2xl p-5 border border-slate-200/80">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xs font-sans-semibold uppercase tracking-wider text-slate-500">
              Simetría Escapular
            </Text>
            <ShieldCheck size={16} color="#2563eb" />
          </View>
          <Text className="text-3xl font-sans-black text-[#131b2e]">
            {posture.shoulderAlignment === null ? '—' : `${posture.shoulderAlignment}%`}
          </Text>
          <View className="mt-2 flex-row items-center justify-between">
            <Text className="text-xs text-slate-500 font-sans">Nivel de hombros</Text>
            <Text className="text-xs font-sans-bold text-slate-600">
              {posture.shoulderAlignment === null ? 'Sin medición' : 'Medición del detector'}
            </Text>
          </View>
          <View className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
            <View
              className="bg-[#2563eb] h-1.5 rounded-full"
              style={{ width: `${posture.shoulderAlignment ?? 0}%` }}
            />
          </View>
        </View>

        {/* Sedentary Limit */}
        <View className="bg-white rounded-2xl p-5 border border-slate-200/80">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xs font-sans-semibold uppercase tracking-wider text-slate-500">
              Tiempo Sedentario
            </Text>
            <Clock size={16} color="#f59e0b" />
          </View>
          <Text className="text-3xl font-sans-black text-[#131b2e]">
            {sedentaryMinutes} min
          </Text>
          <View className="mt-2 flex-row items-center justify-between">
            <Text className="text-xs text-slate-500 font-sans">Límite sugerido</Text>
            <Text className="text-xs font-sans-bold text-[#f59e0b]">Máx 60 min</Text>
          </View>
          <View className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
            <View
              className="bg-[#f59e0b] h-1.5 rounded-full"
              style={{ width: `${Math.min(100, (sedentaryMinutes / 60) * 100)}%` }}
            />
          </View>
        </View>
      </View>

      {/* Ambient Quick Card & Guided Stretch Recommendation */}
      <View className="flex-col gap-6">
        {/* Ambient Insights Bar */}
        <View className="bg-white rounded-2xl p-6 border border-slate-200/80">
          <View className="flex-row items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <View>
              <Text className="text-xs font-sans-semibold text-slate-500 uppercase tracking-wider">
                Microclima & Ergonomía
              </Text>
              <Text className="text-base font-sans-bold text-[#131b2e]">Ambiente de Trabajo</Text>
            </View>
            <Pressable
              onPress={onNavigateToAmbient}
              accessibilityLabel="Ver Sensores"
              className="flex-row items-center gap-1"
            >
              <Text className="text-xs font-sans-semibold text-[#004ac6]">Ver Sensores</Text>
              <ArrowUpRight size={14} color="#004ac6" />
            </Pressable>
          </View>

          <View className="flex-row flex-wrap gap-4">
            <View className="w-[47%] p-3.5 bg-[#faf8ff] rounded-xl border border-slate-100">
              <View className="flex-row items-center gap-2 mb-1">
                <Sun size={14} color="#f59e0b" />
                <Text className="text-xs text-slate-500 font-sans">Iluminación</Text>
              </View>
              <Text className="text-xl font-sans-bold text-[#131b2e]">{ambient.lux} Lux</Text>
              <Text className="text-[11px] text-slate-600 font-sans-semibold">{luxLabel}</Text>
            </View>

            <View className="w-[47%] p-3.5 bg-[#faf8ff] rounded-xl border border-slate-100">
              <View className="flex-row items-center gap-2 mb-1">
                <Volume2 size={14} color="#06b6d4" />
                <Text className="text-xs text-slate-500 font-sans">Ruido Sonoro</Text>
              </View>
              <Text className="text-xl font-sans-bold text-[#131b2e]">
                {ambient.decibels === 0 ? '— dB' : `${ambient.decibels} dB`}
              </Text>
              <Text className="text-[11px] text-slate-600 font-sans-semibold">{noiseLabel}</Text>
            </View>
          </View>

          <Text className="text-xs text-slate-500 font-sans mt-4 leading-relaxed">
            La iluminación es manual y el ruido es una estimación de la sesión actual.
          </Text>
        </View>

        {/* Micro-exercise quick card */}
        <Gradient
          direction="br"
          from="#eaedff"
          to="#f2f3ff"
          className="rounded-2xl p-6 border border-[#2563eb]/20 flex-col justify-between"
        >
          <View>
            <View className="flex-row items-center gap-2 mb-1">
              <Sparkles size={14} color="#004ac6" fill="#004ac6" />
              <Text className="text-xs font-sans-bold text-[#004ac6] uppercase tracking-wider">
                Ejercicio Recomendado
              </Text>
            </View>
            <Text className="text-base font-sans-bold text-[#131b2e]">Retracción Cervical 15s</Text>
            <Text className="text-xs text-[#434655] font-sans mt-1 leading-relaxed">
              Aliviarás la presión sobre las vértebras C5-C7 generada al mirar pantallas hacia abajo.
            </Text>
          </View>

          <View className="mt-4 pt-3 border-t border-[#2563eb]/15 flex-row items-center justify-between">
            <Text className="text-xs text-slate-600 font-sans-medium">Duración: 15 segundos</Text>
            <Pressable
              onPress={() => onOpenBreakModal(0)}
              className="px-4 py-2 rounded-full bg-white border border-[#2563eb]/30 shadow-sm"
            >
              <Text className="text-xs font-sans-bold text-[#004ac6]">Comenzar Ahora</Text>
            </Pressable>
          </View>
        </Gradient>
      </View>
    </View>
  );
};
