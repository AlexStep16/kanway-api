import { TASK_COLORS_MAP } from '@/constants/TASK_COLORS.js'

export function getRuColorName(color: keyof typeof TASK_COLORS_MAP): string {
  const colorInfo = TASK_COLORS_MAP[color]

  if (colorInfo) {
    return colorInfo.ru
  }

  return 'Синий'
}
