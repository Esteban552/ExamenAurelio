/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { View, ScrollView, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  useFonts,
  PlusJakartaSans_300Light,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { TabType, PostureMetrics, AmbientMetrics } from './types';
import { TopBar } from './components/TopBar';
import { BottomNav } from './components/BottomNav';
import { DashboardTab } from './components/DashboardTab';
import { PostureTab } from './components/PostureTab';
import { AmbientTab } from './components/AmbientTab';
import { TrendsTab } from './components/TrendsTab';
import {
  MicroBreakModal,
  type MicroBreakSessionResult,
} from './components/MicroBreakModal';
import { soundService } from './utils/audio';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginScreen } from './screens/LoginScreen';
import {
  startBreakSession,
  completeBreakSession,
  abandonBreakSession,
  logPosture,
} from './db/repos';
import { MICRO_BREAK_EXERCISES } from './data/exercises';
import { EMPTY_POSTURE } from './posture/metrics';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_300Light,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  if (!fontsLoaded && !fontError) {
    return <View className="flex-1 bg-[#faf8ff]" />;
  }

  return (
    <AuthProvider>
      <SafeAreaProvider>
        <MainApp />
      </SafeAreaProvider>
    </AuthProvider>
  );
}

function MainApp() {
  const { userId, initializing, signOut } = useAuth();

  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [isBreakModalOpen, setIsBreakModalOpen] = useState(false);
  const [breakInitialIndex, setBreakInitialIndex] = useState(0);
  const [isDirectedBreak, setIsDirectedBreak] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isStandingMode, setIsStandingMode] = useState(false);

  const currentSessionId = useRef<number | null>(null);
  const lastPostureSavedAt = useRef(0);

  // Real-time Posture state
  const [posture, setPosture] = useState<PostureMetrics>(EMPTY_POSTURE);

  // Environmental state
  const [ambient, setAmbient] = useState<AmbientMetrics>({
    lux: 420,
    luxStatus: 'optima',
    decibels: 0,
    noiseStatus: 'silencioso',
    temperatureC: 21.5,
    humidityPercent: 48,
    screenTimeMinutes: 42,
  });

  if (initializing) {
    return <View className="flex-1 bg-[#faf8ff]" />;
  }

  if (!userId) {
    return (
      <SafeAreaProvider>
        <LoginScreen />
      </SafeAreaProvider>
    );
  }

  const handleUpdatePosture = (updated: Partial<PostureMetrics>) => {
    setPosture((previous) => {
      const merged = { ...previous, ...updated };
      const completeMeasurement =
        merged.source === 'detector' &&
        merged.score !== null &&
        merged.cervicalAngle !== null &&
        merged.shoulderAlignment !== null &&
        merged.distanceCm !== null &&
        merged.slouchRatio !== null;
      const shouldPersist = completeMeasurement && Date.now() - lastPostureSavedAt.current >= 30_000;
      if (shouldPersist) {
        lastPostureSavedAt.current = Date.now();
        logPosture(userId, merged).catch((error) =>
          console.warn('No se pudo guardar el log postural:', error)
        );
      }
      return merged;
    });
  };

  const handleUpdateAmbient = (updated: Partial<AmbientMetrics>) => {
    setAmbient((prev) => ({ ...prev, ...updated }));
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundService.setSoundEnabled(next);
  };

  const handleToggleStanding = () => {
    const next = !isStandingMode;
    setIsStandingMode(next);
    soundService.playGentleChime();
  };

  const handleOpenBreakModal = async (initialIndex?: number) => {
    if (isBreakModalOpen) return;
    const directed = initialIndex !== undefined;
    const exerciseIndex = initialIndex ?? 0;
    try {
      const id = await startBreakSession(
        userId,
        directed ? 1 : MICRO_BREAK_EXERCISES.length,
        directed ? 'directed-exercise' : 'full-routine'
      );
      currentSessionId.current = id;
      setBreakInitialIndex(exerciseIndex);
      setIsDirectedBreak(directed);
      setIsBreakModalOpen(true);
    } catch (error) {
      console.warn('No se pudo registrar la sesión:', error);
    }
  };

  const handleCompleteBreakSession = (result: MicroBreakSessionResult) => {
    const sessionId = currentSessionId.current;
    if (sessionId != null) {
      completeBreakSession(sessionId, {
        exercisesCompleted: result.completedExerciseCount,
        exercisesSkipped: result.skippedExerciseCount,
        durationSeconds: result.elapsedSeconds,
      })
        .catch((e) => console.warn('No se pudo completar la sesión:', e));
      currentSessionId.current = null;
    }
  };

  const handleCloseBreakModal = () => {
    const sessionId = currentSessionId.current;
    if (sessionId !== null) {
      currentSessionId.current = null;
      abandonBreakSession(sessionId).catch((error) =>
        console.warn('No se pudo marcar la sesión como abandonada:', error)
      );
    }
    setIsBreakModalOpen(false);
  };

  return (
    <View className="flex-1 bg-[#faf8ff]">
      <StatusBar style="dark" />

      {/* Top Navigation Bar */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#ffffff' }}>
        <TopBar
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          onStartMicroBreak={() => {
            void handleOpenBreakModal();
          }}
          soundEnabled={soundEnabled}
          onToggleSound={handleToggleSound}
          isStandingMode={isStandingMode}
          onToggleStanding={handleToggleStanding}
          postureScore={posture.score}
          onSignOut={() => {
            void signOut();
          }}
        />
      </SafeAreaView>

      {/* Main Container */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 24,
          paddingBottom: 120,
        }}
      >
        {currentTab === 'dashboard' && (
          <DashboardTab
            posture={posture}
            ambient={ambient}
            onOpenBreakModal={handleOpenBreakModal}
            isStandingMode={isStandingMode}
            onToggleStanding={handleToggleStanding}
            onNavigateToPosture={() => setCurrentTab('posture')}
            onNavigateToAmbient={() => setCurrentTab('ambient')}
          />
        )}

        {currentTab === 'posture' && (
          <PostureTab
            metrics={posture}
            onUpdateMetrics={handleUpdatePosture}
            onOpenBreakModal={handleOpenBreakModal}
          />
        )}

        {currentTab === 'ambient' && (
          <AmbientTab
            ambient={ambient}
            onUpdateAmbient={handleUpdateAmbient}
            onOpenBreakModal={handleOpenBreakModal}
          />
        )}

        {currentTab === 'trends' && (
          <TrendsTab onOpenBreakModal={handleOpenBreakModal} />
        )}
      </ScrollView>

      {/* Bottom Floating Navigation */}
      <BottomNav currentTab={currentTab} onTabChange={setCurrentTab} />

      {/* Guided Micro-Break Interactive Session Modal */}
      <MicroBreakModal
        isOpen={isBreakModalOpen}
          onClose={handleCloseBreakModal}
          onCompleteSession={handleCompleteBreakSession}
          initialExerciseIndex={breakInitialIndex}
          isDirectedSession={isDirectedBreak}
        />
    </View>
  );
}
