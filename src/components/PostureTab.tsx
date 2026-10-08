import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import {
  Camera,
  CameraOff,
  Crosshair,
  CheckCircle2,
  AlertTriangle,
  Info,
  Maximize2,
  RefreshCw,
  HelpCircle,
  Calculator,
} from 'lucide-react-native';
import {
  Svg,
  Line,
  Circle,
  G,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { useCameraPermissions } from 'expo-camera';
import type { PoseFrame } from 'expo-mediapipe-pose/core';
import { PostureCalibration, PostureMetrics } from '../types';
import { soundService } from '../utils/audio';
import { Gradient } from './Gradient';
import { PostureCameraStage } from './PostureCameraStage';
import {
  buildCalibration,
  computePostureMetrics,
  EMPTY_POSTURE,
  extractPostureGeometry,
  smoothPostureMetrics,
  type RawPostureGeometry,
} from '../posture/metrics';
import { useAuth } from '../auth/AuthContext';

interface Props {
  metrics: PostureMetrics;
  onUpdateMetrics: (metrics: Partial<PostureMetrics>) => void;
  onOpenBreakModal: (index?: number) => void;
}

export const PostureTab: React.FC<Props> = ({
  metrics,
  onUpdateMetrics,
  onOpenBreakModal,
}) => {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationStep, setCalibrationStep] = useState(1);
  const [calibration, setCalibration] = useState<PostureCalibration | null>(null);
  const [capturingCalibration, setCapturingCalibration] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const { userId } = useAuth();
  const calibrationSamples = useRef<RawPostureGeometry[]>([]);
  const calibrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const smoothedMetrics = useRef<PostureMetrics | null>(null);
  const poseMissing = useRef(false);

  // Ergonomic desk calculator
  const [userHeightCm, setUserHeightCm] = useState<number>(175);

  const calibrationKey = `ergofocus:posture-calibration:${userId ?? 'unknown'}`;

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(calibrationKey)
      .then((stored) => {
        if (!cancelled && stored) setCalibration(JSON.parse(stored) as PostureCalibration);
      })
      .catch(() => setCameraError('No se pudo leer la calibración guardada.'));
    return () => {
      cancelled = true;
      if (calibrationTimer.current) clearTimeout(calibrationTimer.current);
    };
  }, [calibrationKey]);

  // Start real camera
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!permission) {
        setCameraError('Todavía estamos verificando el permiso de cámara. Intentá nuevamente.');
      } else if (!permission.granted) {
        if (!permission.canAskAgain) {
          setCameraError('El permiso de cámara está bloqueado. Habilitalo desde los ajustes del dispositivo.');
          await Linking.openSettings();
          return;
        }
        const result = await requestPermission();
        if (!result.granted) {
          setCameraError('Necesitamos acceso a la cámara para detectar tu postura en el dispositivo.');
          setCameraActive(false);
          return;
        }
        setCameraActive(true);
      } else {
        setCameraActive(true);
      }
    } catch {
      setCameraError('No se pudo iniciar la cámara. Revisá el permiso e intentá nuevamente.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    setCameraActive(false);
    setCameraReady(false);
    setCapturingCalibration(false);
  };

  const handlePoseFrame = (frame: PoseFrame) => {
    const raw = extractPostureGeometry(frame);
    if (!raw) {
      smoothedMetrics.current = null;
      if (!poseMissing.current) {
        poseMissing.current = true;
        onUpdateMetrics({
          ...EMPTY_POSTURE,
          statusMessage: 'No detectamos el torso completo. Mostrá cabeza, hombros y cadera.',
        });
      }
      return;
    }

    poseMissing.current = false;
    if (capturingCalibration) calibrationSamples.current.push(raw);
    if (calibration) {
      const next = smoothPostureMetrics(
        smoothedMetrics.current,
        computePostureMetrics(raw, calibration)
      );
      smoothedMetrics.current = next;
      onUpdateMetrics(next);
    }
  };

  // Calibration Wizard
  const handleNextCalibration = () => {
    if (calibrationStep < 3) {
      setCalibrationStep(calibrationStep + 1);
      return;
    }
    if (!cameraActive || !cameraReady) {
      setCameraError('Activá la cámara y esperá a que el detector esté listo antes de calibrar.');
      setIsCalibrating(false);
      return;
    }
    calibrationSamples.current = [];
    setCapturingCalibration(true);
    calibrationTimer.current = setTimeout(() => {
      const nextCalibration = buildCalibration(calibrationSamples.current);
      setCapturingCalibration(false);
      if (!nextCalibration) {
        setCameraError('No obtuvimos suficientes lecturas estables. Centrate en cámara e intentá de nuevo.');
        return;
      }
      setCalibration(nextCalibration);
      AsyncStorage.setItem(calibrationKey, JSON.stringify(nextCalibration)).catch(() => {
        setCameraError('La calibración funcionó, pero no se pudo guardar en el dispositivo.');
      });
      setIsCalibrating(false);
      setCalibrationStep(1);
      soundService.playSuccessChime();
    }, 3000);
  };

  // Calculated desk ergonomics
  const deskHeight = Math.round(userHeightCm * 0.41);
  const chairHeight = Math.round(userHeightCm * 0.25);
  const eyeLevelHeight = Math.round(userHeightCm * 0.68);

  return (
    <View className="gap-6">
      {/* Posture Header */}
      <View className="bg-white rounded-2xl p-5 border border-slate-200/80 flex flex-col items-start justify-between gap-4">
        <View>
          <Text className="text-xs font-sans-semibold text-[#004ac6] uppercase tracking-wider">
            Telemetría de Visión por Computadora
          </Text>
          <Text className="text-2xl font-sans-extrabold text-[#131b2e] tracking-tight">
            Análisis Postural & Calibración
          </Text>
          <Text className="text-xs font-sans text-[#434655] mt-0.5">
             Estima alineación de cabeza, simetría de hombros y distancia mediante landmarks procesados localmente.
          </Text>
        </View>

        <Pressable
          onPress={() => setIsCalibrating(true)}
          className="flex-row items-center gap-2 px-4 py-2.5 rounded-full bg-[#faf8ff] border border-[#2563eb]/30 shadow-sm"
        >
          <Crosshair size={16} color="#004ac6" />
          <Text className="text-xs font-sans-bold text-[#004ac6]">Asistente de Calibración</Text>
        </Pressable>
      </View>

      {/* Main Vision Stage & Skeleton View */}
      <View className="gap-6">
        {/* Left: Video / Skeleton Viewport */}
        <View className="bg-white rounded-2xl p-6 border border-slate-200/80 flex flex-col">
          <View className="flex-row items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <View className="flex-row items-center gap-2">
              <View
                className={`w-2.5 h-2.5 rounded-full ${
                  metrics.status === 'optimal'
                    ? 'bg-emerald-500'
                    : metrics.status === 'warning'
                    ? 'bg-amber-500'
                    : metrics.status === 'alert'
                    ? 'bg-rose-500'
                    : 'bg-slate-400'
                }`}
              />
              <Text className="text-sm font-sans-bold text-[#131b2e]">
                 {cameraActive ? 'Detección MediaPipe en el dispositivo' : 'Detector postural detenido'}
              </Text>
            </View>

            <View className="flex-row items-center gap-2">
              {cameraActive ? (
                <Pressable
                  onPress={stopCamera}
                  className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100"
                >
                  <CameraOff size={14} color="#334155" />
                  <Text className="text-xs font-sans-semibold text-slate-700">Detener Cámara</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={startCamera}
                  className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2563eb] shadow-sm"
                >
                  <Camera size={14} color="#ffffff" />
                  <Text className="text-xs font-sans-semibold text-white">Activar Cámara Real</Text>
                </Pressable>
              )}
            </View>
          </View>

          {cameraError && (
            <View className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex-row items-center gap-2">
              <View className="shrink-0">
                <Info size={16} color="#92400e" />
              </View>
              <Text className="text-xs font-sans text-amber-800 flex-1">{cameraError}</Text>
            </View>
          )}

          {/* Skeleton Canvas Display */}
          <Gradient
            direction="b"
            from="#131b2e"
            to="#0f172a"
            className="relative w-full aspect-[4/3] rounded-xl overflow-hidden items-center justify-center border border-slate-800"
          >
            {/* Real on-device pose detector */}
            {cameraActive && (
              <PostureCameraStage
                active={cameraActive}
                onFrame={handlePoseFrame}
                onReady={() => {
                  setCameraReady(true);
                  setCameraError(null);
                }}
                onError={(message) => {
                  setCameraReady(false);
                  setCameraError(message);
                }}
              />
            )}

            {/* Grid overlay */}
            <View className="absolute inset-0 opacity-15" pointerEvents="none">
              <Svg width="100%" height="100%" viewBox="0 0 400 300">
                {Array.from({ length: 13 }, (_, i) => i * 32).map((x) => (
                  <Line key={`gv${x}`} x1={x} y1={0} x2={x} y2={300} stroke="#2563eb" strokeWidth={1} />
                ))}
                {Array.from({ length: 10 }, (_, i) => i * 32).map((y) => (
                  <Line key={`gh${y}`} x1={0} y1={y} x2={400} y2={y} stroke="#2563eb" strokeWidth={1} />
                ))}
              </Svg>
            </View>

            {/* Neutral positioning guide while the detector is stopped */}
            {!cameraActive && <Svg viewBox="0 0 400 300" className="w-full h-full max-w-md relative z-10">
              {/* Reference Neutral Axis (Dashed vertical) */}
              <Line
                x1="200"
                y1="40"
                x2="200"
                y2="260"
                stroke="#64748b"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                strokeOpacity="0.6"
              />

              {/* Dynamic Coordinate Calculation based on Preset */}
              {(() => {
                let headX = 200;
                let headY = 90;
                let neckX = 200;
                let neckY = 120;
                let shoulderLeftX = 140;
                let shoulderLeftY = 140;
                let shoulderRightX = 260;
                let shoulderRightY = 140;
                let spineMidX = 200;
                let spineMidY = 190;
                let spineBaseX = 200;
                let spineBaseY = 250;

                const accentColor =
                  metrics.status === 'optimal'
                    ? '#06b6d4'
                    : metrics.status === 'warning'
                    ? '#f59e0b'
                    : '#ef4444';

                return (
                  <G>
                    {/* Cervical & Spine Lines */}
                    <Line
                      x1={headX}
                      y1={headY}
                      x2={neckX}
                      y2={neckY}
                      stroke={accentColor}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                    <Line
                      x1={neckX}
                      y1={neckY}
                      x2={spineMidX}
                      y2={spineMidY}
                      stroke={accentColor}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                    <Line
                      x1={spineMidX}
                      y1={spineMidY}
                      x2={spineBaseX}
                      y2={spineBaseY}
                      stroke="#2563eb"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />

                    {/* Shoulder Clavicle Bar */}
                    <Line
                      x1={shoulderLeftX}
                      y1={shoulderLeftY}
                      x2={shoulderRightX}
                      y2={shoulderRightY}
                      stroke="#38bdf8"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />

                    {/* Neck to Shoulders */}
                    <Line
                      x1={neckX}
                      y1={neckY}
                      x2={shoulderLeftX}
                      y2={shoulderLeftY}
                      stroke="#64748b"
                      strokeWidth="2"
                    />
                    <Line
                      x1={neckX}
                      y1={neckY}
                      x2={shoulderRightX}
                      y2={shoulderRightY}
                      stroke="#64748b"
                      strokeWidth="2"
                    />

                    {/* Key Joints / Landmarkers */}
                    {/* Head */}
                    <Circle cx={headX} cy={headY} r="18" fill="none" stroke={accentColor} strokeWidth="3" />
                    <Circle cx={headX} cy={headY} r="4" fill={accentColor} />

                    {/* Neck joint */}
                    <Circle cx={neckX} cy={neckY} r="5" fill="#38bdf8" />

                    {/* Shoulders */}
                    <Circle cx={shoulderLeftX} cy={shoulderLeftY} r="6" fill="#38bdf8" />
                    <Circle cx={shoulderRightX} cy={shoulderRightY} r="6" fill="#38bdf8" />

                    {/* Spine mid */}
                    <Circle cx={spineMidX} cy={spineMidY} r="5" fill="#2563eb" />
                    {/* Spine base */}
                    <Circle cx={spineBaseX} cy={spineBaseY} r="6" fill="#2563eb" />

                    {/* Angle badge on head */}
                    <G translateX={headX + 22} translateY={headY - 12}>
                      <Rect width="64" height="24" rx="12" fill="#0f172a" stroke={accentColor} strokeWidth="1" />
                      <SvgText x="32" y="16" fill="#ffffff" fontSize="11" fontWeight="700" textAnchor="middle">
                        {metrics.cervicalAngle === null ? 'Sin medición' : `${metrics.cervicalAngle}° estimado`}
                      </SvgText>
                    </G>
                  </G>
                );
              })()}
            </Svg>}

            {/* Bottom telemetry overlay pill */}
            <View className="absolute bottom-3 left-4 right-4 flex-row items-center justify-between bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-700/60">
              <View className="flex-row items-center gap-3">
                <Text className="text-xs font-sans text-white/90">
                  Distancia estimada: <Text className="text-xs font-sans-bold text-cyan-400">{metrics.distanceCm === null ? '—' : `${metrics.distanceCm} cm`}</Text>
                </Text>
                <Text className="text-xs font-sans text-white/90">·</Text>
                <Text className="text-xs font-sans text-white/90">
                  Simetría: <Text className="text-xs font-sans-bold text-cyan-400">{metrics.shoulderAlignment === null ? '—' : `${metrics.shoulderAlignment}%`}</Text>
                </Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <View
                  className={`w-2 h-2 rounded-full ${
                    metrics.status === 'optimal'
                      ? 'bg-emerald-400'
                      : metrics.status === 'warning'
                      ? 'bg-amber-400'
                      : metrics.status === 'alert'
                      ? 'bg-rose-400'
                      : 'bg-slate-400'
                  }`}
                />
                <Text className="text-[10px] font-sans-semibold uppercase tracking-wider text-white/90">
                  {metrics.status === 'unknown' ? 'Sin lectura' : metrics.status === 'optimal' ? 'Alineado' : 'Desviación'}
                </Text>
              </View>
            </View>
          </Gradient>

          {/* Feedback Tip Banner */}
          <View
            className={`mt-4 p-4 rounded-xl border flex-row items-start gap-3 ${
              metrics.status === 'optimal'
                ? 'bg-emerald-50/80 border-emerald-200'
                : metrics.status === 'warning'
                ? 'bg-amber-50/80 border-amber-200'
                : 'bg-rose-50/80 border-rose-200'
            }`}
          >
            <View className="mt-0.5 shrink-0">
              {metrics.status === 'optimal' ? (
                <CheckCircle2 size={20} color="#059669" />
              ) : (
                <AlertTriangle size={20} color="#d97706" />
              )}
            </View>
            <View className="flex-1">
              <Text
                className={`text-xs font-sans-bold ${
                  metrics.status === 'optimal'
                    ? 'text-emerald-900'
                    : metrics.status === 'warning'
                    ? 'text-amber-900'
                    : 'text-rose-900'
                }`}
              >
                {metrics.statusMessage}
              </Text>
              <Text
                className={`text-xs font-sans mt-0.5 opacity-90 ${
                  metrics.status === 'optimal'
                    ? 'text-emerald-900'
                    : metrics.status === 'warning'
                    ? 'text-amber-900'
                    : 'text-rose-900'
                }`}
              >
                {metrics.status === 'optimal'
                  ? 'Continúa así. Recuerda realizar pausas activas cada 45-60 minutos para oxigenar los discos intervertebrales.'
                  : metrics.status === 'unknown'
                  ? 'Las estimaciones aparecen cuando el detector ve cabeza, hombros y cadera con suficiente confianza.'
                  : 'Corregí tu posición y mantenela unos segundos para estabilizar la medición.'}
              </Text>
            </View>
          </View>
        </View>

        {/* Detector status & Desk Height Calculator */}
        <View className="gap-6">
          <View className="bg-white rounded-2xl p-6 border border-slate-200/80">
            <View className="flex-row items-center gap-2 mb-2">
              <Crosshair size={16} color="#004ac6" />
              <Text className="text-sm font-sans-bold text-[#131b2e]">Estado del Detector</Text>
            </View>
            <View className="gap-2">
              <Text className="text-xs font-sans text-[#434655]">
                {cameraActive
                  ? cameraReady
                    ? metrics.detected
                      ? `Persona detectada · confianza ${Math.round(metrics.confidence * 100)}%`
                      : 'Buscando cabeza, hombros y cadera en el encuadre.'
                    : 'Inicializando cámara y modelo MediaPipe...'
                  : 'La cámara está detenida. El video se procesa únicamente en este dispositivo.'}
              </Text>
              <Text className="text-xs font-sans text-slate-500">
                {calibration
                  ? `Calibración local guardada el ${new Date(calibration.createdAt).toLocaleDateString()}.`
                  : 'Todavía no hay una referencia neutral. Activá la cámara y completá la calibración.'}
              </Text>
            </View>
          </View>

          {/* Ergonomic Desk Setup Calculator */}
          <View className="bg-white rounded-2xl p-6 border border-slate-200/80">
            <View className="flex-row items-center gap-2 mb-2">
              <Calculator size={16} color="#004ac6" />
              <Text className="text-sm font-sans-bold text-[#131b2e]">Calculadora Ergonómica de Puesto</Text>
            </View>
            <Text className="text-xs font-sans text-[#434655] mb-4">
              Ingresa tu estatura para calcular la altura óptima de escritorio, silla y monitor:
            </Text>

            <View className="gap-4">
              <View>
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-xs font-sans-semibold text-slate-700">Tu Estatura:</Text>
                  <Text className="text-xs font-sans-bold text-[#004ac6]">{userHeightCm} cm</Text>
                </View>
                <Slider
                  minimumValue={145}
                  maximumValue={205}
                  step={1}
                  value={userHeightCm}
                  onValueChange={(value) => setUserHeightCm(Number(value))}
                  minimumTrackTintColor="#2563eb"
                  maximumTrackTintColor="#e2e8f0"
                  style={{ width: '100%' }}
                />
              </View>

              <View className="flex-row flex-wrap gap-3 pt-2">
                <View className="w-[48%] p-3 bg-[#faf8ff] rounded-xl border border-slate-100 items-center">
                  <Text className="text-[11px] font-sans text-slate-500">Altura Escritorio</Text>
                  <Text className="text-xl font-sans-bold text-[#131b2e]">{deskHeight} cm</Text>
                  <Text className="text-[10px] font-sans text-[#00687a] mt-0.5">Codos a 90°</Text>
                </View>

                <View className="w-[48%] p-3 bg-[#faf8ff] rounded-xl border border-slate-100 items-center">
                  <Text className="text-[11px] font-sans text-slate-500">Altura del Asiento</Text>
                  <Text className="text-xl font-sans-bold text-[#131b2e]">{chairHeight} cm</Text>
                  <Text className="text-[10px] font-sans text-[#00687a] mt-0.5">Pies planos en suelo</Text>
                </View>
              </View>

              <View className="p-3 bg-[#eaedff]/60 rounded-xl">
                <Text className="text-xs font-sans text-[#434655] leading-relaxed">
                  💡 <Text className="text-xs font-sans-bold text-[#434655]">Regla de Oro:</Text> El tercio superior de la pantalla debe quedar exactamente a la altura de tus ojos (<Text className="text-xs font-sans-bold text-[#004ac6]">{eyeLevelHeight} cm</Text> del piso) a una distancia de brazo estirado.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Calibration Modal */}
      {isCalibrating && (
        <Modal
          visible={isCalibrating}
          transparent
          animationType="fade"
          onRequestClose={() => setIsCalibrating(false)}
        >
          <View className="flex-1 items-center justify-center p-4 bg-slate-900/60">
            <View className="w-full max-w-md bg-white rounded-3xl p-6 border border-slate-200 items-center gap-4">
              <View className="w-12 h-12 rounded-full bg-[#eaedff] items-center justify-center">
                <Crosshair size={24} color="#004ac6" strokeWidth={2.5} />
              </View>

              <Text className="text-lg font-sans-bold text-[#131b2e]">
                Calibración de Postura Neutra ({calibrationStep}/3)
              </Text>

              {calibrationStep === 1 && (
                <Text className="text-xs font-sans text-[#434655] text-center">
                  Paso 1: Siéntate cómodamente con la espalda apoyada contra el respaldo de tu silla y los pies planos en el suelo.
                </Text>
              )}

              {calibrationStep === 2 && (
                <Text className="text-xs font-sans text-[#434655] text-center">
                  Paso 2: Relaja los hombros sin encogerlos y ubica tu mirada al centro superior de la pantalla.
                </Text>
              )}

              {calibrationStep === 3 && (
                <Text className="text-xs font-sans text-[#434655] text-center">
                  Paso 3: Mantén esta postura durante 3 segundos mientras registramos tus coordenadas de referencia neutrales.
                </Text>
              )}

              <View className="flex-row items-center justify-center gap-3 pt-2">
                <Pressable
                  onPress={() => setIsCalibrating(false)}
                  className="px-4 py-2.5 rounded-full border border-slate-200"
                >
                  <Text className="text-xs font-sans-semibold text-slate-600">Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={handleNextCalibration}
                  disabled={capturingCalibration}
                  className={`px-6 py-2.5 rounded-full shadow-md ${capturingCalibration ? 'bg-slate-400' : 'bg-[#2563eb]'}`}
                >
                  <Text className="text-xs font-sans-bold text-white">
                    {capturingCalibration
                      ? 'Midiendo 3 segundos...'
                      : calibrationStep === 3
                      ? 'Iniciar Medición y Guardar'
                      : 'Siguiente Paso'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};
