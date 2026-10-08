import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView } from 'react-native';
import { X, Play, Pause, SkipForward, RotateCcw, CheckCircle2, Volume2, VolumeX } from 'lucide-react-native';
import { MICRO_BREAK_EXERCISES } from '../data/exercises';
import { ExerciseIllustration } from './ExerciseIllustration';
import { soundService } from '../utils/audio';
import { Gradient } from './Gradient';

export interface MicroBreakSessionResult {
  completedExerciseCount: number;
  skippedExerciseCount: number;
  elapsedSeconds: number;
  sessionType: 'full-routine' | 'directed-exercise';
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCompleteSession: (result: MicroBreakSessionResult) => void;
  initialExerciseIndex?: number;
  isDirectedSession?: boolean;
}

export const MicroBreakModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onCompleteSession,
  initialExerciseIndex = 0,
  isDirectedSession = false,
}) => {
  const safeInitialIndex = Math.min(
    Math.max(initialExerciseIndex, 0),
    Math.max(MICRO_BREAK_EXERCISES.length - 1, 0)
  );
  const directedSession = isDirectedSession || safeInitialIndex > 0;
  const [currentIndex, setCurrentIndex] = useState(safeInitialIndex);
  const [timeLeft, setTimeLeft] = useState(
    MICRO_BREAK_EXERCISES[safeInitialIndex]?.durationSeconds || 15
  );
  const [isActive, setIsActive] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [sessionResult, setSessionResult] = useState<MicroBreakSessionResult | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const sessionStartedAtRef = useRef(0);
  const completionFiredRef = useRef(false);
  const completedCountRef = useRef(0);
  const skippedCountRef = useRef(0);
  const exerciseSettledRef = useRef(false);

  const finishSession = useCallback((completedCount: number, skippedCount: number) => {
    if (completionFiredRef.current || !isOpen) return;

    completionFiredRef.current = true;
    setIsActive(false);

    const result: MicroBreakSessionResult = {
      completedExerciseCount: completedCount,
      skippedExerciseCount: skippedCount,
      elapsedSeconds: Math.max(0, Math.floor((Date.now() - sessionStartedAtRef.current) / 1000)),
      sessionType: directedSession ? 'directed-exercise' : 'full-routine',
    };

    setSessionResult(result);
    setCompleted(true);
    soundService.playSuccessChime();
    onCompleteSession(result);
  }, [directedSession, isOpen, onCompleteSession]);

  useEffect(() => {
    if (isOpen) {
      completionFiredRef.current = false;
      completedCountRef.current = 0;
      skippedCountRef.current = 0;
      exerciseSettledRef.current = false;
      sessionStartedAtRef.current = Date.now();
      setCurrentIndex(safeInitialIndex);
      setTimeLeft(MICRO_BREAK_EXERCISES[safeInitialIndex]?.durationSeconds || 15);
      setIsActive(true);
      setCompleted(false);
      setSessionResult(null);
    } else {
      completionFiredRef.current = true;
      setIsActive(false);
    }
  }, [isOpen, safeInitialIndex]);

  useEffect(() => {
    exerciseSettledRef.current = false;
  }, [currentIndex]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isOpen && isActive && !completed && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (
      isOpen &&
      isActive &&
      !completed &&
      timeLeft === 0 &&
      !exerciseSettledRef.current
    ) {
      exerciseSettledRef.current = true;
      soundService.playGentleChime();
      const completedCount = completedCountRef.current + 1;
      completedCountRef.current = completedCount;

      if (!directedSession && currentIndex < MICRO_BREAK_EXERCISES.length - 1) {
        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex);
        setTimeLeft(MICRO_BREAK_EXERCISES[nextIndex].durationSeconds);
      } else {
        finishSession(completedCount, skippedCountRef.current);
      }
    }
    return () => clearInterval(interval);
  }, [completed, currentIndex, directedSession, finishSession, isActive, isOpen, timeLeft]);

  if (!isOpen) return null;

  const currentExercise = MICRO_BREAK_EXERCISES[currentIndex];
  const exerciseProgress = 1 - timeLeft / (currentExercise?.durationSeconds || 15);
  const progressPercent = directedSession
    ? exerciseProgress * 100
    : ((currentIndex + exerciseProgress) / MICRO_BREAK_EXERCISES.length) * 100;

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundService.setSoundEnabled(next);
  };

  const restartCurrent = () => {
    exerciseSettledRef.current = false;
    setTimeLeft(currentExercise.durationSeconds);
    setIsActive(true);
  };

  const handleClose = () => {
    completionFiredRef.current = true;
    setIsActive(false);
    onClose();
  };

  const nextExercise = () => {
    if (exerciseSettledRef.current) return;

    exerciseSettledRef.current = true;
    const skippedCount = skippedCountRef.current + 1;
    skippedCountRef.current = skippedCount;

    if (!directedSession && currentIndex < MICRO_BREAK_EXERCISES.length - 1) {
      const next = currentIndex + 1;
      setCurrentIndex(next);
      setTimeLeft(MICRO_BREAK_EXERCISES[next].durationSeconds);
    } else {
      finishSession(completedCountRef.current, skippedCount);
    }
  };

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={handleClose}>
      <View className="flex-1 items-center justify-center p-4 bg-slate-900/60">
        <View className="relative w-full max-w-lg max-h-[90%] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
          {/* Header */}
          <View className="flex-row items-center justify-between px-6 py-4 border-b border-slate-100">
            <View className="flex-row items-center gap-2">
              <View className="w-2.5 h-2.5 rounded-full bg-[#2563eb]" />
              <Text className="text-base font-sans-bold text-[#131b2e]">Pausa Activa Ergonómica</Text>
              <Text className="text-xs font-sans-medium text-slate-500 ml-1">
                {directedSession ? 1 : currentIndex + 1} de {directedSession ? 1 : MICRO_BREAK_EXERCISES.length}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={toggleSound}
                accessibilityLabel={soundEnabled ? 'Silenciar campanadas' : 'Activar campanadas'}
                className="p-2 rounded-full"
              >
                {soundEnabled ? (
                  <Volume2 size={16} color="#2563eb" />
                ) : (
                  <VolumeX size={16} color="#94a3b8" />
                )}
              </Pressable>
              <Pressable onPress={handleClose} className="p-2 rounded-full">
                <X size={20} color="#64748b" />
              </Pressable>
            </View>
          </View>

          {/* Global Progress Bar */}
          <View className="w-full h-1.5 bg-slate-100">
            <Gradient
              direction="r"
              from="#2563eb"
              to="#06b6d4"
              className="h-full"
              style={{ width: `${progressPercent}%` }}
            />
          </View>

          {/* Modal Body */}
          <ScrollView className="w-full">
            {!completed ? (
              <View className="p-6 flex flex-col items-center">
                {/* Visual anatomical illustration */}
                <ExerciseIllustration type={currentExercise.svgType} className="w-52 h-52 mb-4" />

                {/* Timer Ring */}
                <View className="w-16 h-16 rounded-full bg-[#eaedff] border-2 border-[#2563eb]/30 items-center justify-center mb-3">
                  <Text className="text-2xl font-sans-bold text-[#004ac6]">{timeLeft}s</Text>
                </View>

                {/* Exercise Title & Target */}
                <Text className="text-lg font-sans-bold text-[#131b2e] mb-1 text-center">{currentExercise.name}</Text>
                <Text className="text-xs font-sans-semibold text-[#00687a] uppercase tracking-wider mb-3 text-center">
                  Zona: {currentExercise.targetArea}
                </Text>

                {/* Step Instruction */}
                <Text className="bg-[#faf8ff] border border-slate-200/80 rounded-2xl p-4 text-sm font-sans text-[#434655] leading-relaxed mb-3 text-left w-full">
                  {currentExercise.instruction}
                </Text>

                {/* Physiological Benefit */}
                <Text className="text-xs font-sans text-slate-500 mb-6 italic text-center">
                  Beneficio biomecánico: {currentExercise.benefit}
                </Text>

                {/* Control Bar */}
                <View className="flex-row items-center justify-center gap-4 w-full">
                  <Pressable
                    onPress={restartCurrent}
                    accessibilityLabel="Reiniciar este paso"
                    className="p-3 rounded-full border border-slate-200"
                  >
                    <RotateCcw size={20} color="#475569" />
                  </Pressable>

                  <Pressable
                    onPress={() => setIsActive(!isActive)}
                    className="flex-row items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-[#2563eb] shadow-md"
                  >
                    {isActive ? (
                      <>
                        <Pause size={16} color="#ffffff" fill="#ffffff" />
                        <Text className="font-sans-semibold text-white text-sm">Pausar</Text>
                      </>
                    ) : (
                      <>
                        <Play size={16} color="#ffffff" fill="#ffffff" />
                        <Text className="font-sans-semibold text-white text-sm">Continuar</Text>
                      </>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={nextExercise}
                    accessibilityLabel="Siguiente ejercicio"
                    className="p-3 rounded-full border border-slate-200"
                  >
                    <SkipForward size={20} color="#475569" />
                  </Pressable>
                </View>
              </View>
            ) : (
              /* Completion State */
              <View className="p-8 flex flex-col items-center">
                <View className="w-20 h-20 rounded-full bg-emerald-50 flex-row items-center justify-center mb-4">
                  <CheckCircle2 size={48} color="#059669" strokeWidth={2.2} />
                </View>
                <Text className="text-xl font-sans-bold text-[#131b2e] mb-2 text-center">
                  {sessionResult?.completedExerciseCount
                    ? '¡Pausa activa completada!'
                    : 'Pausa activa finalizada'}
                </Text>
                <Text className="text-sm font-sans text-[#434655] max-w-sm mb-6 text-center">
                  Completaste {sessionResult?.completedExerciseCount ?? 0}{' '}
                  {(sessionResult?.completedExerciseCount ?? 0) === 1 ? 'ejercicio' : 'ejercicios'} y omitiste{' '}
                  {sessionResult?.skippedExerciseCount ?? 0}{' '}
                  {(sessionResult?.skippedExerciseCount ?? 0) === 1 ? 'ejercicio' : 'ejercicios'} en{' '}
                  {sessionResult?.elapsedSeconds ?? 0} segundos.
                </Text>
                <Pressable
                  onPress={handleClose}
                  className="px-8 py-3.5 rounded-full bg-[#2563eb] shadow-md items-center justify-center"
                >
                  <Text className="font-sans-semibold text-white text-sm">Cerrar</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
