import { TASK_COLORS_MAP, TASK_COLORS_TITLES } from '@/constants/TASK_COLORS.js'

export function getColorByNameAndTone(
  name: (typeof TASK_COLORS_TITLES)[number],
  tone: 'light' | 'medium' | 'dark',
): keyof typeof TASK_COLORS_MAP {
  for (const [colorKey, colorValue] of Object.entries(TASK_COLORS_MAP)) {
    if (colorValue.name === name && colorValue.tone === tone) {
      return colorKey as keyof typeof TASK_COLORS_MAP
    }
  }

  return '#3b82f6' as keyof typeof TASK_COLORS_MAP
}
