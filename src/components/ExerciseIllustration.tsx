import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

interface Props {
  type: 'neck' | 'shoulders' | 'chest' | 'wrists' | 'eyes';
  className?: string;
}

export const ExerciseIllustration: React.FC<Props> = ({ type, className = 'w-48 h-48' }) => {
  if (type === 'neck') {
    return (
      <View className={`relative flex items-center justify-center bg-[#eaedff] rounded-2xl p-4 ${className}`}>
        <Svg viewBox="0 0 160 160" className="w-full h-full" width="100%" height="100%" fill="none">
          {/* Head & Neck Profile */}
          <Circle cx="80" cy="55" r="26" fill="#dae2fd" stroke="#004ac6" strokeWidth="3" />
          {/* Nose indication */}
          <Path d="M102 54 L110 58 L103 63" stroke="#004ac6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {/* Spine curve */}
          <Path d="M74 81 Q70 100 68 125" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" strokeDasharray="6 4" />
          {/* Retraction arrow */}
          <Path d="M112 55 L85 55" stroke="#06b6d4" strokeWidth="3.5" strokeLinecap="round" />
          <Path d="M85 55 L91 51.5 L91 58.5 Z" fill="#06b6d4" />
          {/* Base shoulders */}
          <Path d="M45 130 C58 115 102 115 115 130" stroke="#737686" strokeWidth="4" strokeLinecap="round" />
          {/* Target highlight */}
          <Circle cx="72" cy="90" r="14" fill="#2563eb" fillOpacity="0.15" />
        </Svg>
      </View>
    );
  }

  if (type === 'shoulders') {
    return (
      <View className={`relative flex items-center justify-center bg-[#eaedff] rounded-2xl p-4 ${className}`}>
        <Svg viewBox="0 0 160 160" className="w-full h-full" width="100%" height="100%" fill="none">
          {/* Head */}
          <Circle cx="80" cy="45" r="22" fill="#dae2fd" stroke="#004ac6" strokeWidth="3" />
          {/* Neck */}
          <Path d="M74 67 L74 82 M86 67 L86 82" stroke="#004ac6" strokeWidth="3" />
          {/* Shoulders */}
          <Path d="M35 100 C50 82 110 82 125 100" stroke="#004ac6" strokeWidth="4" strokeLinecap="round" />
          {/* Rotation arc left */}
          <Path d="M40 85 C32 95 35 110 46 112 C52 113 56 106 54 96" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeDasharray="3 3" />
          {/* Rotation arc right */}
          <Path d="M120 85 C128 95 125 110 114 112 C108 113 104 106 106 96" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeDasharray="3 3" />
          {/* Chest & spine */}
          <Path d="M80 82 L80 135" stroke="#737686" strokeWidth="3" strokeLinecap="round" />
        </Svg>
      </View>
    );
  }

  if (type === 'chest') {
    return (
      <View className={`relative flex items-center justify-center bg-[#eaedff] rounded-2xl p-4 ${className}`}>
        <Svg viewBox="0 0 160 160" className="w-full h-full" width="100%" height="100%" fill="none">
          {/* Spine arch */}
          <Path d="M72 135 C64 105 76 75 92 50" stroke="#004ac6" strokeWidth="4" strokeLinecap="round" />
          {/* Head tilted gently back */}
          <Circle cx="102" cy="40" r="20" fill="#dae2fd" stroke="#004ac6" strokeWidth="3" />
          {/* Chest expansion rays */}
          <Path d="M96 85 L118 78 M100 100 L124 98 M96 115 L118 120" stroke="#06b6d4" strokeWidth="3" strokeLinecap="round" />
          {/* Arms behind */}
          <Path d="M90 70 Q115 65 120 85" stroke="#2563eb" strokeWidth="3.5" strokeLinecap="round" />
        </Svg>
      </View>
    );
  }

  if (type === 'wrists') {
    return (
      <View className={`relative flex items-center justify-center bg-[#eaedff] rounded-2xl p-4 ${className}`}>
        <Svg viewBox="0 0 160 160" className="w-full h-full" width="100%" height="100%" fill="none">
          {/* Arm forearm */}
          <Path d="M30 110 L80 90" stroke="#004ac6" strokeWidth="5" strokeLinecap="round" />
          {/* Hand facing up */}
          <Path d="M80 90 L95 60 L108 64 L96 93 Z" fill="#dae2fd" stroke="#004ac6" strokeWidth="3" />
          {/* Gentle stretch arrow */}
          <Path d="M115 55 Q100 45 88 55" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
          {/* Tendon pulse point */}
          <Circle cx="82" cy="90" r="7" fill="#ef4444" fillOpacity="0.3" stroke="#ef4444" strokeWidth="2" />
        </Svg>
      </View>
    );
  }

  // Eyes (Palming)
  return (
    <View className={`relative flex items-center justify-center bg-[#eaedff] rounded-2xl p-4 ${className}`}>
      <Svg viewBox="0 0 160 160" className="w-full h-full" width="100%" height="100%" fill="none">
        {/* Closed Eyes curved lashes */}
        <Path d="M50 80 Q62 90 74 80" stroke="#004ac6" strokeWidth="3.5" strokeLinecap="round" />
        <Path d="M86 80 Q98 90 110 80" stroke="#004ac6" strokeWidth="3.5" strokeLinecap="round" />
        {/* Soothing palms outline */}
        <Path d="M42 65 C35 80 40 105 60 105 C75 105 78 85 75 70" stroke="#06b6d4" strokeWidth="3" strokeLinecap="round" strokeDasharray="4 3" />
        <Path d="M118 65 C125 80 120 105 100 105 C85 105 82 85 85 70" stroke="#06b6d4" strokeWidth="3" strokeLinecap="round" strokeDasharray="4 3" />
        {/* Calming glow halo */}
        <Circle cx="80" cy="80" r="45" stroke="#2563eb" strokeWidth="1.5" strokeOpacity="0.4" />
      </Svg>
    </View>
  );
};
