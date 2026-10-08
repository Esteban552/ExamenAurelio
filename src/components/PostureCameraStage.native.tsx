import React, { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { PoseCameraView, type PoseFrame } from 'expo-mediapipe-pose';

interface Props {
  active: boolean;
  onFrame: (frame: PoseFrame) => void;
  onReady: () => void;
  onError: (message: string) => void;
}

export const PostureCameraStage: React.FC<Props> = ({ active, onFrame, onReady, onError }) => {
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [session, setSession] = useState(0);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setForeground(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  return (
    <View style={StyleSheet.absoluteFill}>
      <PoseCameraView
        key={session}
        style={StyleSheet.absoluteFill}
        isActive={active && foreground}
        cameraFacing="front"
        previewFps={30}
        frameLimit={15}
        callbackFps={5}
        minPoseDetectionConfidence={0.5}
        minPosePresenceConfidence={0.5}
        minTrackingConfidence={0.5}
        skeleton={{ color: '#22d3ee', lineWidth: 3, jointRadius: 4, minVisibility: 0.6 }}
        onLandmark={onFrame}
        onCameraConfigured={onReady}
        onInferenceError={(error) => {
          onError(`No se pudo iniciar el detector (${error.code}).`);
          setSession((value) => value + 1);
        }}
      />
    </View>
  );
};
