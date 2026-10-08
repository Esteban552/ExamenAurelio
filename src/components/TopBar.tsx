import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Volume2, VolumeX, Sparkles, Activity, LogOut } from 'lucide-react-native';
import { TabType } from '../types';
import { Gradient } from './Gradient';

interface Props {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  onStartMicroBreak: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  isStandingMode: boolean;
  onToggleStanding: () => void;
  postureScore: number | null;
  onSignOut: () => void;
}

export const TopBar: React.FC<Props> = ({
  soundEnabled,
  onToggleSound,
  onStartMicroBreak,
  onSignOut,
}) => {
  return (
    <View className="w-full bg-white/90 border-b border-slate-200/80">
      <View className="px-4 h-16 flex-row items-center justify-between">
        {/* Zone 1: Wordmark */}
        <View className="flex-row items-center gap-3">
          <View className="flex-row items-center gap-2">
            <Gradient
              direction="tr"
              from="#004ac6"
              to="#06b6d4"
              className="w-8 h-8 rounded-xl items-center justify-center"
            >
              <Activity size={16} color="#ffffff" strokeWidth={2.5} />
            </Gradient>
            <Text className="text-xl font-sans-extrabold tracking-tight text-[#131b2e]">
              Ergo
              <Text className="text-[#004ac6] font-sans-extrabold">Focus</Text>
            </Text>
          </View>
        </View>

        {/* Zone 3: Primary Actions */}
        <View className="flex-row items-center gap-2">
          {/* Sound Toggle */}
          <Pressable
            onPress={onToggleSound}
            accessibilityLabel={
              soundEnabled ? 'Silenciar campanadas' : 'Activar sonido ergonómico'
            }
            className="p-2 rounded-full border border-slate-200"
          >
            {soundEnabled ? (
              <Volume2 size={16} color="#004ac6" />
            ) : (
              <VolumeX size={16} color="#94a3b8" />
            )}
          </Pressable>

          {/* Quick Micro-Break CTA */}
          <Pressable
            onPress={onStartMicroBreak}
            className="flex-row items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#2563eb] items-center"
          >
            <Sparkles size={14} color="#ffffff" fill="#ffffff" />
            <Text className="font-sans-bold text-white text-xs">Pausa Activa</Text>
          </Pressable>

          {/* Sign Out */}
          <Pressable
            onPress={onSignOut}
            accessibilityLabel="Cerrar sesión"
            className="p-2 rounded-full border border-slate-200"
          >
            <LogOut size={16} color="#64748b" />
          </Pressable>
        </View>
      </View>
    </View>
  );
};
