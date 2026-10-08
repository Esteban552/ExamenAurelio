import { getNamedLandmarks, type PoseFrame } from 'expo-mediapipe-pose/core';
import type { PostureCalibration, PostureMetrics } from '../types';

export interface RawPostureGeometry {
  shoulderTilt: number;
  headDeviation: number;
  shoulderWidth: number;
  headShoulderRatio: number;
  confidence: number;
}

const MIN_VISIBILITY = 0.6;

export function extractPostureGeometry(frame: PoseFrame): RawPostureGeometry | null {
  const pose = getNamedLandmarks(frame);
  const leftShoulder = pose.leftShoulder;
  const rightShoulder = pose.rightShoulder;
  const leftHip = pose.leftHip;
  const rightHip = pose.rightHip;
  const leftEar = pose.leftEar;
  const rightEar = pose.rightEar;

  const required = [leftShoulder, rightShoulder, leftHip, rightHip, leftEar, rightEar];
  if (required.some((point) => !point || (point.visibility ?? 0) < MIN_VISIBILITY)) return null;

  const ls = leftShoulder!;
  const rs = rightShoulder!;
  const lh = leftHip!;
  const rh = rightHip!;
  const le = leftEar!;
  const re = rightEar!;

  const shoulderMid = midpoint(ls, rs);
  const hipMid = midpoint(lh, rh);
  const headMid = midpoint(le, re);
  const shoulderWidth = distance(ls, rs);
  if (shoulderWidth < 0.04) return null;

  const shoulderTilt = radiansToDegrees(Math.atan2(rs.y - ls.y, rs.x - ls.x));
  const torsoX = shoulderMid.x - hipMid.x;
  const torsoY = hipMid.y - shoulderMid.y;
  const headX = headMid.x - shoulderMid.x;
  const headY = shoulderMid.y - headMid.y;
  const torsoAngle = radiansToDegrees(Math.atan2(torsoX, Math.max(0.001, torsoY)));
  const headAngle = radiansToDegrees(Math.atan2(headX, Math.max(0.001, headY)));
  const headDeviation = Math.abs(headAngle - torsoAngle);
  const headShoulderRatio = distance(headMid, shoulderMid) / shoulderWidth;
  const confidence = required.reduce((sum, point) => sum + (point?.visibility ?? 0), 0) / required.length;

  return { shoulderTilt, headDeviation, shoulderWidth, headShoulderRatio, confidence };
}

export function buildCalibration(samples: RawPostureGeometry[]): PostureCalibration | null {
  if (samples.length < 10) return null;
  return {
    shoulderTilt: median(samples.map((sample) => sample.shoulderTilt)),
    headDeviation: median(samples.map((sample) => sample.headDeviation)),
    shoulderWidth: median(samples.map((sample) => sample.shoulderWidth)),
    headShoulderRatio: median(samples.map((sample) => sample.headShoulderRatio)),
    referenceDistanceCm: 60,
    createdAt: new Date().toISOString(),
    version: 1,
  };
}

export function computePostureMetrics(
  raw: RawPostureGeometry,
  calibration: PostureCalibration
): PostureMetrics {
  const shoulderDeviation = Math.abs(raw.shoulderTilt - calibration.shoulderTilt);
  const headDeviation = Math.abs(raw.headDeviation - calibration.headDeviation);
  const compression = Math.max(
    0,
    (calibration.headShoulderRatio - raw.headShoulderRatio) /
      Math.max(0.01, calibration.headShoulderRatio)
  );
  const slouchRatio = clamp(compression * 2.4 + headDeviation / 50, 0, 1);
  const shoulderAlignment = clamp(100 - shoulderDeviation * 6, 0, 100);
  const distanceCm = clamp(
    calibration.referenceDistanceCm * (calibration.shoulderWidth / raw.shoulderWidth),
    25,
    120
  );

  const distancePenalty = distanceCm < 45 ? (45 - distanceCm) * 0.6 : distanceCm > 80 ? (distanceCm - 80) * 0.3 : 0;
  const score = Math.round(
    clamp(100 - headDeviation * 1.4 - shoulderDeviation * 2.2 - slouchRatio * 32 - distancePenalty, 0, 100)
  );
  const status = score >= 85 ? 'optimal' : score >= 65 ? 'warning' : 'alert';

  return {
    score,
    cervicalAngle: Math.round(headDeviation * 10) / 10,
    shoulderAlignment: Math.round(shoulderAlignment),
    distanceCm: Math.round(distanceCm),
    slouchRatio: Math.round(slouchRatio * 100) / 100,
    status,
    statusMessage: statusMessage(status, headDeviation, shoulderDeviation, slouchRatio, distanceCm),
    detected: true,
    confidence: Math.round(raw.confidence * 100) / 100,
    measuredAt: new Date().toISOString(),
    source: 'detector',
    distanceEstimated: true,
  };
}

export function smoothPostureMetrics(
  previous: PostureMetrics | null,
  next: PostureMetrics,
  alpha = 0.3
): PostureMetrics {
  if (!previous || previous.source !== 'detector' || previous.score === null) return next;
  const score = Math.round(interpolate(previous.score, next.score ?? previous.score, alpha));
  const status = score >= 85 ? 'optimal' : score >= 65 ? 'warning' : 'alert';
  return {
    ...next,
    score,
    cervicalAngle: interpolateNullable(previous.cervicalAngle, next.cervicalAngle, alpha, 1),
    shoulderAlignment: interpolateNullable(previous.shoulderAlignment, next.shoulderAlignment, alpha, 0),
    distanceCm: interpolateNullable(previous.distanceCm, next.distanceCm, alpha, 0),
    slouchRatio: interpolateNullable(previous.slouchRatio, next.slouchRatio, alpha, 2),
    confidence: interpolate(previous.confidence, next.confidence, alpha),
    status,
  };
}

export const EMPTY_POSTURE: PostureMetrics = {
  score: null,
  cervicalAngle: null,
  shoulderAlignment: null,
  distanceCm: null,
  slouchRatio: null,
  status: 'unknown',
  statusMessage: 'Activá la cámara y calibrá tu postura para comenzar la medición.',
  detected: false,
  confidence: 0,
  measuredAt: null,
  source: 'none',
  distanceEstimated: true,
};

function statusMessage(
  status: PostureMetrics['status'],
  headDeviation: number,
  shoulderDeviation: number,
  slouchRatio: number,
  distanceCm: number
): string {
  if (headDeviation > 15) return 'Alineá cabeza y torso con tu referencia neutral.';
  if (shoulderDeviation > 6) return 'Nivelá los hombros y revisá la altura de los apoyabrazos.';
  if (slouchRatio > 0.45) return 'Apoyá la espalda y recuperá la altura del torso calibrada.';
  if (distanceCm < 45) return 'Alejate un poco de la pantalla.';
  if (distanceCm > 80) return 'Acercá la pantalla sin inclinar el cuello.';
  return status === 'optimal'
    ? 'Tu alineación se mantiene cerca de la referencia calibrada.'
    : 'Ajustá tu posición y mantenela unos segundos para estabilizar la lectura.';
}

function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function interpolate(previous: number, next: number, alpha: number): number {
  return previous + (next - previous) * alpha;
}

function interpolateNullable(
  previous: number | null,
  next: number | null,
  alpha: number,
  decimals: number
): number | null {
  if (next === null) return previous;
  if (previous === null) return next;
  const factor = 10 ** decimals;
  return Math.round(interpolate(previous, next, alpha) * factor) / factor;
}
