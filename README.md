# ErgoFocus

Plataforma de bio-telemetría postural y ergonomía de precisión para trabajo digital y bienestar.

App móvil construida con **Expo SDK 57** + **React Native 0.86** + **NativeWind 4.2.7** (Tailwind CSS).

## Requisitos

- Node.js 20+
- Credenciales de Supabase en `.env` (ver `.env.example`): `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (o `EXPO_PUBLIC_SUPABASE_ANON_KEY`)
- **Development build** (no Expo Go): el detector postural usa `expo-mediapipe-pose`

## Correr localmente

1. Copiar `.env.example` a `.env` y completar las credenciales de Supabase.
2. Instalar dependencias:
   ```bash
   npm install
   ```
3. Compilar el development build (una vez):
   ```bash
   npx expo prebuild
   npx expo run:android
   ```
   o con EAS: `eas build --platform android --profile development`
4. Levantar Metro y desarrollar:
   ```bash
   npm start
   ```

Otros scripts: `npm run android`, `npm run ios`, `npm run web`, `npm run lint` (typecheck).

## Datos

- **Supabase**: solo valida el login (email + contraseña). Nunca recibe datos de la app.
- **SQLite local** (`src/db/`): única fuente de verdad del historial (sesiones de pausas, logs posturales, molestias), con `user_id` por fila para separar cuentas por dispositivo.
- Sin sesión válida la app muestra la pantalla de login; no hay modo invitado.

## Estructura

```
index.ts              # registro + import de global.css (NativeWind)
global.css            # directivas Tailwind
tailwind.config.js    # preset nativewind + familias Plus Jakarta Sans
src/
  App.tsx             # gate de auth, tabs, persistencia de sesiones/pausas
  types.ts            # tipos compartidos (PostureMetrics nullable, calibración)
  lib/supabase.ts     # cliente condicional con validación defensiva
  auth/AuthContext.tsx # sesión, signIn/signUp/resetPassword
  screens/LoginScreen.tsx
  db/                 # schema + queries SQLite (expo-sqlite)
  posture/metrics.ts  # geometría, calibración y score postural reales
  data/exercises.ts   # rutina de micro-pausas
  utils/audio.ts      # campanadas vía expo-audio (WAVs sintetizados)
  components/         # TopBar, BottomNav, ScoreDial, tabs, Gradient, etc.
  components/PostureCameraStage.native.tsx # vista MediaPipe (.web.tsx = fallback)
assets/sounds/        # WAVs generados por scripts/generate-sounds.mjs
scripts/              # generación de sonidos
```

## Notas de la migración (web → RN)

- Los gradientes Tailwind (`bg-gradient-to-*`) son web-only en NativeWind: se usan con el componente `src/components/Gradient.tsx` (expo-linear-gradient).
- Los pesos de fuente se seleccionan por familia (`font-sans-bold`, `font-sans-black`, …) porque RN no resuelve `font-weight` con fuentes custom.
- El nivel de ruido usa metering real de `expo-audio` (dBFS, etiquetado como aproximado); el detector postural usa `expo-mediapipe-pose` sobre `expo-camera` (solo development build).
- Sonidos sintetizados con la misma síntesis que la versión web original: `node scripts/generate-sounds.mjs`.
