import { BASE_COLORS_MAP } from '@/constants/BASE_COLORS.js'

export function getWorkspaceRuColorName(color: keyof typeof BASE_COLORS_MAP): string {
  const colorInfo = BASE_COLORS_MAP[color]

  if (colorInfo) {
    return colorInfo.ru
  }

  return 'Синий'
}
