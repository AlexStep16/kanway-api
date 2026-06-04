export const BASE_COLORS_MAP: Record<
  string,
  {
    name: string
    ru: string
  }
> = {
  '#ff6467': { name: 'Red', ru: 'Красный' },
  '#fdc700': { name: 'Yellow', ru: 'Желтый' },
  '#05df72': { name: 'Green', ru: 'Зеленый' },
  '#3b82f6': { name: 'Blue', ru: 'Синий' },
  '#7c86ff': { name: 'Indigo', ru: 'Индиго' },
  '#cfbbff': { name: 'Violet', ru: 'Фиолетовый' },
  '#fb64b6': { name: 'Pink', ru: 'Розовый' },
  '#99a1af': { name: 'Gray', ru: 'Серый' },
}

export const BASE_COLORS = [
  '#ff6467',
  '#fdc700',
  '#05df72',
  '#3b82f6',
  '#7c86ff',
  '#cfbbff',
  '#fb64b6',
  '#99a1af',
] as const
