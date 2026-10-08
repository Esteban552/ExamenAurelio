import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import Slider from '@react-native-community/slider';
import {
  RecordingPresets,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
import {
  Sun,
  Mic,
  MicOff,
  Eye,
  Wind,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
} from 'lucide-react-native';
import { AmbientMetrics } from '../types';
import { soundService } from '../utils/audio';
import { Gradient } from './Gradient';

interface Props {
  ambient: AmbientMetrics;
  onUpdateAmbient: (ambient: Partial<AmbientMetrics>) => void;
  onOpenBreakModal: (index?: number) => void;
}

const METERED_RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};

export const AmbientTab: React.FC<Props> = ({
  ambient,
  onUpdateAmbient,
  onOpenBreakModal,
}) => {
  const audioRecorder = useAudioRecorder(METERED_RECORDING_OPTIONS, (status) => {
    if (status.hasError || status.mediaServicesDidReset) {
      setMicError(
        status.error ??
          'La medición se interrumpió. Detenela e intentá iniciar el micrófono nuevamente.',
      );
      setMicActive(false);
      void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    }
  });
  const recorderState = useAudioRecorderState(audioRecorder, 250);
  const [micActive, setMicActive] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const [hasMicReading, setHasMicReading] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const observedRecordingRef = useRef(false);

  // 20-20-20 Eye Strain Timer (20 mins count down to 20s rest)
  const [eyeMinutes, setEyeMinutes] = useState(20);
  const [eyeSeconds, setEyeSeconds] = useState(0);
  const [isEyeTimerRunning, setIsEyeTimerRunning] = useState(false);
  const [isRestingEyes, setIsRestingEyes] = useState(false);
  const [restCountDown, setRestCountDown] = useState(20);

  // Eye timer ticker
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isEyeTimerRunning && !isRestingEyes) {
      interval = setInterval(() => {
        if (eyeSeconds > 0) {
          setEyeSeconds((s) => s - 1);
        } else if (eyeMinutes > 0) {
          setEyeMinutes((m) => m - 1);
          setEyeSeconds(59);
        } else {
          // Trigger 20-second rest
          setIsRestingEyes(true);
          setRestCountDown(20);
          soundService.playGentleChime();
        }
      }, 1000);
    } else if (isRestingEyes) {
      interval = setInterval(() => {
        setRestCountDown((r) => {
          if (r <= 1) {
            setIsRestingEyes(false);
            setEyeMinutes(20);
            setEyeSeconds(0);
            soundService.playSuccessChime();
            return 20;
          }
          return r - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isEyeTimerRunning, isRestingEyes, eyeMinutes, eyeSeconds]);

  useEffect(() => {
    if (!micActive || !recorderState.isRecording || recorderState.metering === undefined) {
      return;
    }

    observedRecordingRef.current = true;
    // dBFS is relative to the microphone's digital full scale. This offset only
    // provides a useful ambient estimate; it is not calibrated sound pressure level.
    const estimatedDb = Math.max(0, Math.min(100, Math.round(recorderState.metering + 100)));
    setHasMicReading(true);
    onUpdateAmbient({
      decibels: estimatedDb,
      noiseStatus: estimatedDb < 50 ? 'silencioso' : estimatedDb < 70 ? 'moderado' : 'ruidoso',
    });
  }, [micActive, onUpdateAmbient, recorderState.isRecording, recorderState.metering]);

  useEffect(() => {
    if (recorderState.mediaServicesDidReset) {
      observedRecordingRef.current = false;
      setMicActive(false);
      setMicError('El sistema de audio se reinició. Volvé a iniciar la medición.');
      void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
      return;
    }

    if (micActive && observedRecordingRef.current && !recorderState.isRecording) {
      observedRecordingRef.current = false;
      setMicActive(false);
      setMicError('La grabación fue interrumpida por el sistema. Volvé a iniciarla.');
      void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    }
  }, [micActive, recorderState.isRecording, recorderState.mediaServicesDidReset]);

  const startMicMeter = async () => {
    if (micBusy || micActive) return;

    setMicError(null);
    setMicBusy(true);
    setHasMicReading(false);
    try {
      let permission = await getRecordingPermissionsAsync();
      if (!permission.granted) {
        if (!permission.canAskAgain) {
          setMicError('El permiso de micrófono está bloqueado. Habilitalo desde los ajustes del dispositivo.');
          return;
        }
        permission = await requestRecordingPermissionsAsync();
      }

      if (!permission.granted) {
        setMicError('No se otorgó permiso para usar el micrófono.');
        return;
      }

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      observedRecordingRef.current = false;
      setMicActive(true);
    } catch (error) {
      setMicError(
        error instanceof Error
          ? `No se pudo iniciar la medición: ${error.message}`
          : 'No se pudo iniciar la medición con el micrófono.',
      );
      setMicActive(false);
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    } finally {
      setMicBusy(false);
    }
  };

  const stopMicMeter = async () => {
    if (micBusy) return;

    setMicBusy(true);
    setMicActive(false);
    observedRecordingRef.current = false;
    try {
      if (audioRecorder.isRecording) {
        await audioRecorder.stop();
      }
    } catch (error) {
      setMicError(
        error instanceof Error
          ? `No se pudo detener la medición: ${error.message}`
          : 'No se pudo detener correctamente la medición.',
      );
    } finally {
      try {
        await setAudioModeAsync({ allowsRecording: false });
      } catch {
        setMicError('La medición se detuvo, pero no se pudo restaurar el modo de audio.');
      }
      setMicBusy(false);
    }
  };

  useEffect(() => {
    return () => {
      void (async () => {
        try {
          if (audioRecorder.isRecording) {
            await audioRecorder.stop();
          }
        } finally {
          await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
        }
      })();
    };
  }, [audioRecorder]);

  const luxIsOptimal = ambient.lux >= 300 && ambient.lux <= 500;
  const luxStatusLabel = ambient.lux < 300 ? 'Iluminación baja' : luxIsOptimal ? 'Rango óptimo' : 'Iluminación alta';
  const luxStatusClass = luxIsOptimal
    ? 'bg-emerald-50 text-emerald-700'
    : 'bg-amber-50 text-amber-700';
  const noiseStatusLabel = !hasMicReading
    ? 'Sin medición'
    : ambient.decibels < 50
    ? 'Ambiente silencioso'
    : ambient.decibels < 70
    ? 'Ruido moderado'
    : 'Alerta de ruido';
  const noiseStatusClass = !hasMicReading
    ? 'text-slate-500'
    : ambient.decibels < 50
    ? 'text-emerald-600'
    : ambient.decibels < 70
    ? 'text-amber-600'
    : 'text-red-600';

  return (
    <View className="gap-6">
      {/* Ambient Header */}
      <View className="bg-white rounded-2xl p-5 border border-slate-200/80 flex flex-col items-start justify-between gap-4">
        <View>
          <Text className="text-xs font-sans-semibold text-[#00687a] uppercase tracking-wider">
            Telemetría Ambiental & Confort
          </Text>
          <Text className="text-2xl font-sans-extrabold text-[#131b2e] tracking-tight">
            Ambiente & Ergonomía del Espacio
          </Text>
          <Text className="text-xs font-sans text-[#434655] mt-0.5">
            Revisá estimaciones de luz y sonido junto con tus descansos visuales.
          </Text>
        </View>

        <Pressable
          onPress={() => onOpenBreakModal(4)} // Opens the Palming Eye rest exercise
          className="flex-row items-center gap-2 px-4 py-2.5 rounded-full bg-[#eaedff] border border-[#2563eb]/20 shadow-sm"
        >
          <Eye size={16} color="#004ac6" />
          <Text className="text-xs font-sans-bold text-[#004ac6]">Pausa Ocular Palming</Text>
        </Pressable>
      </View>

      {/* 20-20-20 Rule Interactive Eye Hero */}
      <Gradient
        direction="r"
        from="#ffffff"
        via="#f2f3ff"
        to="#ffffff"
        className="rounded-2xl p-6 border border-slate-200/80"
      >
        <View className="flex flex-col items-start justify-between gap-6">
          <View className="max-w-xl">
            <View className="flex-row items-center gap-2 mb-1">
              <View className="w-2.5 h-2.5 rounded-full bg-[#06b6d4]" />
              <Text className="text-xs font-sans-bold text-[#00687a] uppercase tracking-wider">
                Regla Ergonómica 20-20-20
              </Text>
            </View>
            <Text className="text-xl font-sans-bold text-[#131b2e]">Prevención de Fatiga Visual Digital</Text>
            <Text className="text-xs font-sans text-[#434655] mt-1 leading-relaxed">
              Cada <Text className="text-xs font-sans-bold text-[#434655]">20 minutos</Text> de pantalla, mira un objeto a <Text className="text-xs font-sans-bold text-[#434655]">20 pies (6 metros)</Text> de distancia durante <Text className="text-xs font-sans-bold text-[#434655]">20 segundos</Text>. Esto relaja el músculo ciliar del ojo y combate la sequedad ocular.
            </Text>
          </View>

          <View className="flex flex-col items-center gap-4 w-full">
            {isRestingEyes ? (
              <View className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl items-center w-full">
                <Text className="text-xs font-sans-bold text-emerald-800 uppercase mb-1">
                  ¡Mirando a la distancia!
                </Text>
                <Text className="text-4xl font-sans-black text-emerald-600">
                  {restCountDown}s
                </Text>
                <Text className="text-[11px] font-sans text-emerald-700">Parpadea suavemente y respira</Text>
              </View>
            ) : (
              <View className="items-center">
                <Text className="text-4xl font-sans-black text-[#004ac6]">
                  {String(eyeMinutes).padStart(2, '0')}:{String(eyeSeconds).padStart(2, '0')}
                </Text>
                <Text className="text-[11px] font-sans-medium text-slate-500">próximo descanso visual</Text>
              </View>
            )}

            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => setIsEyeTimerRunning(!isEyeTimerRunning)}
                className="px-5 py-2.5 rounded-full bg-[#2563eb] shadow-md"
              >
                {isEyeTimerRunning ? (
                  <View className="flex-row items-center gap-1.5">
                    <Pause size={14} color="#ffffff" fill="#ffffff" />
                    <Text className="text-xs font-sans-bold text-white">Pausar</Text>
                  </View>
                ) : (
                  <View className="flex-row items-center gap-1.5">
                    <Play size={14} color="#ffffff" fill="#ffffff" />
                    <Text className="text-xs font-sans-bold text-white">Iniciar Regla 20-20</Text>
                  </View>
                )}
              </Pressable>

              <Pressable
                onPress={() => {
                  setIsEyeTimerRunning(false);
                  setIsRestingEyes(false);
                  setEyeMinutes(20);
                  setEyeSeconds(0);
                }}
                accessibilityLabel="Reiniciar a 20 minutos"
                className="p-2.5 rounded-full border border-slate-200"
              >
                <RotateCcw size={16} color="#475569" />
              </Pressable>
            </View>
          </View>
        </View>
      </Gradient>

      {/* Grid: Ambient Light + Sound Meter + Climate */}
      <View className="flex flex-col gap-6">
        {/* Lux & Light Sensor */}
        <View className="bg-white rounded-2xl p-6 border border-slate-200/80">
          <View className="flex-row items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <View className="flex-row items-center gap-2">
              <View className="p-2 rounded-xl bg-amber-50">
                <Sun size={20} color="#d97706" />
              </View>
              <View>
                <Text className="text-xs font-sans-semibold text-slate-500 uppercase tracking-wider">
                  Fotometría Ambiental
                </Text>
                <Text className="text-base font-sans-bold text-[#131b2e]">Nivel de Iluminación (Lux)</Text>
              </View>
            </View>
            <Text className={`text-xs font-sans-bold px-2.5 py-1 rounded-full ${luxStatusClass}`}>
              {luxStatusLabel}
            </Text>
          </View>

          <View className="flex-row items-baseline justify-between mb-2">
            <Text className="text-4xl font-sans-black text-[#131b2e]">
              {ambient.lux} <Text className="text-sm font-sans-semibold text-slate-400">Lux</Text>
            </Text>
            <Text className="text-xs font-sans-semibold text-[#00687a]">300 - 500 Lux Recomendado</Text>
          </View>

          {/* Lux Gauge bar */}
          <View className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-4 relative">
            <Gradient
              direction="r"
              from="#fbbf24"
              to="#f59e0b"
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, (ambient.lux / 800) * 100)}%` }}
            />
            {/* Target zone indicator */}
            <View className="absolute top-0 bottom-0 left-[37.5%] w-[25%] bg-emerald-500/20 border-x border-emerald-500/40" />
          </View>

          {/* Manual Lux estimate */}
          <View className="bg-[#faf8ff] p-3.5 rounded-xl border border-slate-100 gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-sans text-slate-600">Estimación manual de luz:</Text>
              <Text className="text-xs font-sans-bold text-[#004ac6]">{ambient.lux} Lux</Text>
            </View>
            <Slider
              minimumValue={100}
              maximumValue={900}
              step={10}
              value={ambient.lux}
              onValueChange={(value) =>
                onUpdateAmbient({
                  lux: Number(value),
                  luxStatus:
                    Number(value) < 300
                      ? 'baja'
                      : Number(value) > 500
                      ? 'excesiva'
                      : 'optima',
                })
              }
              minimumTrackTintColor="#2563eb"
              maximumTrackTintColor="#e2e8f0"
              style={{ width: '100%' }}
            />
          </View>

          <Text className="text-xs font-sans text-[#434655] mt-4 leading-relaxed">
            💡 <Text className="text-xs font-sans-bold text-[#434655]">Consejo Ergonómico:</Text> Evita colocar la pantalla directamente frente a una ventana sin cortina para evitar el resplandor y reflejos molestos sobre la córnea.
          </Text>
        </View>

        {/* Decibels & Noise Sensor */}
        <View className="bg-white rounded-2xl p-6 border border-slate-200/80">
          <View className="flex-row items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <View className="flex-row items-center gap-2">
              <View className="p-2 rounded-xl bg-cyan-50">
                <Wind size={20} color="#0891b2" />
              </View>
              <View>
                <Text className="text-xs font-sans-semibold text-slate-500 uppercase tracking-wider">
                  Estimación Sonora del Espacio
                </Text>
                <Text className="text-base font-sans-bold text-[#131b2e]">Nivel de Ruido Aproximado</Text>
              </View>
            </View>

            {micActive ? (
              <Pressable
                onPress={() => void stopMicMeter()}
                disabled={micBusy}
                className="flex-row items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100"
              >
                <MicOff size={14} color="#334155" />
                <Text className="text-xs font-sans-semibold text-slate-700">
                  {micBusy ? 'Deteniendo...' : 'Detener Mic'}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => void startMicMeter()}
                disabled={micBusy}
                className="flex-row items-center gap-1.5 px-3 py-1 rounded-full bg-[#06b6d4] shadow-sm"
              >
                <Mic size={14} color="#ffffff" />
                <Text className="text-xs font-sans-semibold text-white">
                  {micBusy ? 'Procesando...' : 'Medir con Micrófono'}
                </Text>
              </Pressable>
            )}
          </View>

          {micError && (
            <View className="mb-3 p-2.5 bg-amber-50 rounded-xl">
              <Text className="text-xs font-sans text-amber-800">{micError}</Text>
            </View>
          )}

          <View className="flex-row items-baseline justify-between mb-2">
            <Text className="text-4xl font-sans-black text-[#131b2e]">
              {hasMicReading ? ambient.decibels : '--'}{' '}
              <Text className="text-sm font-sans-semibold text-slate-400">dB estimados</Text>
            </Text>
            <Text className={`text-xs font-sans-semibold ${noiseStatusClass}`}>
              {noiseStatusLabel}
            </Text>
          </View>

          {/* Sound bar */}
          <View className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-4">
            <View
              className={`h-full rounded-full ${
                !hasMicReading
                  ? 'bg-slate-300'
                  : ambient.decibels < 50
                  ? 'bg-[#06b6d4]'
                  : ambient.decibels < 70
                  ? 'bg-[#f59e0b]'
                  : 'bg-[#ef4444]'
              }`}
              style={{ width: `${hasMicReading ? Math.min(100, ambient.decibels) : 0}%` }}
            />
          </View>

          <Text className="text-xs font-sans text-[#434655] mt-4 leading-relaxed">
            Medición aproximada basada en dBFS del micrófono. No está calibrada y no reemplaza un sonómetro.
          </Text>
        </View>
      </View>

      {/* Climate hardware notice */}
      <View className="bg-white rounded-2xl p-6 border border-slate-200/80">
        <View className="pb-3 border-b border-slate-100 mb-4">
          <View>
            <Text className="text-xs font-sans-semibold text-slate-500 uppercase tracking-wider">
              Datos Ambientales Externos
            </Text>
            <Text className="text-base font-sans-bold text-[#131b2e]">Temperatura, Humedad y CO2</Text>
          </View>
        </View>

        <View className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex-row items-start gap-3">
          <AlertTriangle size={20} color="#b45309" />
          <View className="flex-1">
            <Text className="text-sm font-sans-bold text-amber-900">El teléfono no expone estas mediciones</Text>
            <Text className="text-xs font-sans text-amber-800 mt-1 leading-relaxed">
              Para mostrar temperatura, humedad o CO2 hacen falta sensores externos compatibles o datos ingresados manualmente. No se generan lecturas estimadas sin una fuente real.
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};
