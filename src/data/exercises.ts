import { ExerciseStep } from '../types';

export const MICRO_BREAK_EXERCISES: ExerciseStep[] = [
  {
    id: 'chin-tuck',
    name: 'Retracción Cervical (Chin Tuck)',
    durationSeconds: 15,
    targetArea: 'Cuello & Vértebras C1-C7',
    instruction: 'Mantén la mirada al frente. Lleva el mentón hacia atrás en línea recta como haciendo una "doble barbilla", sin inclinar la cabeza hacia abajo. Sostén 3 segundos y relaja.',
    benefit: 'Revierte la compresión de discos vertebrales por mirar pantallas hacia abajo.',
    svgType: 'neck',
  },
  {
    id: 'shoulder-rolls',
    name: 'Rotaciones Escapulares Descompresivas',
    durationSeconds: 15,
    targetArea: 'Trapecios & Romboides',
    instruction: 'Eleva los hombros suavemente hacia las orejas, muévelos hacia atrás juntando las escápulas y déjalos caer relajados hacia abajo con respiración fluida.',
    benefit: 'Libera la tensión acumulada en el músculo trapecio superior.',
    svgType: 'shoulders',
  },
  {
    id: 'chest-expansion',
    name: 'Apertura & Extensión Torácica',
    durationSeconds: 15,
    targetArea: 'Pectorales & Columna Torácica',
    instruction: 'Coloca tus manos detrás de la nuca o en el respaldo de la silla. Inhala profundo y abre los codos hacia atrás elevando suavemente el pecho hacia el techo.',
    benefit: 'Contrarresta el patrón cifótico (joroba de escritorio) y mejora la oxigenación.',
    svgType: 'chest',
  },
  {
    id: 'wrist-flexor',
    name: 'Liberación de Flexores & Muñeca',
    durationSeconds: 15,
    targetArea: 'Túnel Carpiano & Antebrazos',
    instruction: 'Extiende un brazo hacia adelante con la palma hacia el frente (señal de alto). Con la otra mano, jala suavemente los dedos hacia ti. Alterna ambos brazos.',
    benefit: 'Disminuye la presión intratubular del nervio mediano por uso de teclado y ratón.',
    svgType: 'wrists',
  },
  {
    id: 'palming-eyes',
    name: 'Descanso Ocular 20-20 (Palming)',
    durationSeconds: 15,
    targetArea: 'Músculos Ciliares & Ojos',
    instruction: 'Frota las palmas de tus manos para generar calor. Cierra los ojos y cúbrelos suavemente con las palmas huecas sin presionar los párpados. Respira hondo.',
    benefit: 'Relaja la convergencia ocular y previene la fatiga por luz de pantalla.',
    svgType: 'eyes',
  },
];
