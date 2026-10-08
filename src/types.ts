export type TabType = 'dashboard' | 'posture' | 'ambient' | 'trends';

export interface PostureMetrics {
  score: number | null;
  cervicalAngle: number | null;
  shoulderAlignment: number | null;
  distanceCm: number | null;
  slouchRatio: number | null;
  status: 'unknown' | 'optimal' | 'warning' | 'alert';
  statusMessage: string;
  detected: boolean;
  confidence: number;
  measuredAt: string | null;
  source: 'none' | 'detector';
  distanceEstimated: boolean;
}

export interface PostureCalibration {
  shoulderTilt: number;
  headDeviation: number;
  shoulderWidth: number;
  headShoulderRatio: number;
  referenceDistanceCm: number;
  createdAt: string;
  version: 1;
}

export interface AmbientMetrics {
  lux: number;
  luxStatus: 'baja' | 'optima' | 'excesiva';
  decibels: number;
  noiseStatus: 'silencioso' | 'moderado' | 'ruidoso';
  temperatureC: number;
  humidityPercent: number;
  screenTimeMinutes: number;
}

export interface ExerciseStep {
  id: string;
  name: string;
  durationSeconds: number;
  targetArea: string;
  instruction: string;
  benefit: string;
  svgType: 'neck' | 'shoulders' | 'chest' | 'wrists' | 'eyes';
}

export interface BodyPartDiscomfort {
  id: string;
  label: string;
  severity: 'none' | 'mild' | 'moderate' | 'high';
  lastReported?: string;
  recommendedExerciseId?: string;
}
