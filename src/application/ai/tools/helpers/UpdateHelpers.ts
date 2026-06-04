import { ITextValue } from '@/application/interfaces/statuses/content/ITextValue.js'
import { UpdateTasksDTO } from '../schemes/TaskManager/UpdateTasksScheme.js'

export function resolveStringUpdate(
  currentValue: string,
  update: Exclude<UpdateTasksDTO['updates']['name'], undefined>,
): string | null {
  if (update === null) return null
  if (typeof update === 'string') return update

  return update.op === 'append'
    ? `${currentValue}${update.value}`
    : `${update.value}${currentValue}`
}

export function getStringUpdateHumanReadableFilter(
  fieldName: string,
  update: Exclude<UpdateTasksDTO['updates']['name'], undefined>,
): ITextValue {
  if (update === null) {
    return {
      text: `Убрать ${fieldName}`,
    }
  }

  if (typeof update === 'string') {
    return {
      text: `Установить ${fieldName}`,
      value: update,
    }
  }

  return {
    text:
      update.op === 'append'
        ? `Добавить текст в конец поля "${fieldName}"`
        : `Добавить текст в начало поля "${fieldName}"`,
    value: update.value,
  }
}
