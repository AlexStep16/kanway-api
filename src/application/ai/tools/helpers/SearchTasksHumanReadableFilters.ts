import { getColorByNameAndTone } from '@/utils/getColorByNameAndTone.js'
import { getTaskRuColorName } from '@/utils/getTaskRuColorName.js'
import dayjs from 'dayjs'
import { ITextValue } from '@/application/interfaces/statuses/content/ITextValue.js'
import { SearchFilter, SearchFilterOperator } from '@/application/types/SearchFilter.js'

export function getSearchHumanReadableFilter(filter: SearchFilter): ITextValue | null {
  const { field, ...operator } = filter

  if (field === 'id') return getIdHumanFilter(operator)
  if (field === 'name') return getStringHumanFilter('Название', operator)
  if (field === 'description') return getStringHumanFilter('Описание', operator)
  if (field === 'created_at') return getSimpleDateHumanFilter('Создано', operator)
  if (field === 'updated_at') return getSimpleDateHumanFilter('Обновлено', operator)
  if (field === 'due_date') return getDateHumanFilter(operator)
  if (field === 'due_time') return getTimeHumanFilter(operator)
  if (field === 'tags') return getTagsHumanFilter(operator)
  if (field === 'tasks_count') return getNumberHumanFilter('Количество задач', operator)
  if (field === 'columns_count') return getNumberHumanFilter('Количество колонок', operator)
  if (field === 'boards_count') return getNumberHumanFilter('Количество досок', operator)
  if (field === 'is_completed') return getBooleanHumanFilter(operator, 'Выполнено', 'Не выполнено')
  if (field === 'is_deleted') return getBooleanHumanFilter(operator, 'В архиве', 'Не в архиве')

  return null
}

export function formatHumanReadableFilters(filters: ITextValue[]): string {
  return filters.map((filter) => [filter.text, filter.value].filter(Boolean).join(' ')).join('; ')
}

function getIdHumanFilter(operator: SearchFilterOperator): ITextValue {
  if (operator.eq) return { text: 'Id =', value: formatHumanReadableValue(operator.eq) }
  if (operator.neq) return { text: 'Id !=', value: formatHumanReadableValue(operator.neq) }
  if (operator.in) return { text: 'Id', value: operator.in.join(' или ') }
  if (operator.nin) return { text: 'Id не', value: operator.nin.join(' и не ') }

  throw new Error(`Unsupported operator for 'id' field: ${JSON.stringify(operator)}`)
}

function getStringHumanFilter(field: string, operator: SearchFilterOperator): ITextValue {
  if (operator.eq) return { text: `${field} `, value: formatHumanReadableValue(operator.eq) }
  if (operator.cont) return { text: `${field} содержит`, value: operator.cont }
  if (operator.ncont) return { text: `${field} не содержит`, value: operator.ncont }
  if (operator.neq) return { text: `${field} не`, value: formatHumanReadableValue(operator.neq) }
  if (operator.in) return { text: `${field} одно из`, value: operator.in.join(', ') }
  if (operator.nin) return { text: `${field} не одно из`, value: operator.nin.join(', ') }

  throw new Error(`Unsupported operator for '${field}' field: ${JSON.stringify(operator)}`)
}

function getTagsHumanFilter(operator: SearchFilterOperator): ITextValue {
  if (operator.eq) return { text: 'Теги', value: formatTagsValue(operator.eq) }
  if (operator.neq) return { text: 'Не теги', value: formatTagsValue(operator.neq) }
  if (operator.in) return { text: 'Теги', value: formatTagsValue(operator.in) }
  if (operator.nin) return { text: 'Не теги', value: formatTagsValue(operator.nin) }
  if (operator.cont) return { text: 'Содержит теги', value: formatTagsValue(operator.cont) }
  if (operator.contany) return { text: 'Содержит теги', value: formatTagsValue(operator.contany) }
  if (operator.ncontany) {
    return { text: 'Не содержит теги', value: formatTagsValue(operator.ncontany) }
  }

  throw new Error(`Unsupported array operator for 'tags' field: ${JSON.stringify(operator)}`)
}

function getSimpleDateHumanFilter(field: string, operator: SearchFilterOperator): ITextValue {
  const value =
    operator.eq || operator.neq || operator.gt || operator.gte || operator.lt || operator.lte

  if (typeof value !== 'string') {
    throw new Error(`Invalid value for date operator: ${JSON.stringify(operator)}`)
  }

  const date = dayjs(value)
  if (!date.isValid()) throw new Error(`Invalid date: ${value}`)

  if (operator.eq) return { text: field, value: date.format('YYYY.MM.DD') }
  if (operator.neq) return { text: `${field} не`, value: date.format('YYYY.MM.DD') }
  if (operator.gt) return { text: `${field} начиная с`, value: date.format('YYYY.MM.DD') }
  if (operator.gte) return { text: `${field} после`, value: date.format('YYYY.MM.DD') }
  if (operator.lt) return { text: `${field} до`, value: date.format('YYYY.MM.DD') }
  if (operator.lte) return { text: `${field} раньше`, value: date.format('YYYY.MM.DD') }

  throw new Error(`Unsupported operator for '${field}' field: ${JSON.stringify(operator)}`)
}

function getDateHumanFilter(operator: SearchFilterOperator): ITextValue {
  if (operator.eq && typeof operator.eq === 'string') {
    return { text: 'Срок', value: dayjs(operator.eq).format('YYYY.MM.DD') }
  }
  if (operator.neq && typeof operator.neq === 'string') {
    return { text: 'Срок не', value: dayjs(operator.neq).format('YYYY.MM.DD') }
  }
  if (operator.gt && typeof operator.gt === 'string') {
    return { text: 'Срок после', value: dayjs(operator.gt).format('YYYY.MM.DD') }
  }
  if (operator.gte && typeof operator.gte === 'string') {
    return { text: 'Срок начиная с', value: dayjs(operator.gte).format('YYYY.MM.DD') }
  }
  if (operator.lt && typeof operator.lt === 'string') {
    return { text: 'Срок до', value: dayjs(operator.lt).format('YYYY.MM.DD') }
  }
  if (operator.lte && typeof operator.lte === 'string') {
    return { text: 'Срок раньше', value: dayjs(operator.lte).format('YYYY.MM.DD') }
  }

  throw new Error(`Unsupported operator for 'due_date' field: ${JSON.stringify(operator)}`)
}

function getTimeHumanFilter(operator: SearchFilterOperator): ITextValue {
  let value =
    operator.eq || operator.neq || operator.gt || operator.gte || operator.lt || operator.lte

  if (typeof value !== 'string') {
    throw new Error(`Invalid value for time operator: ${JSON.stringify(operator)}`)
  }

  value = value.toString().padStart(5, '0')

  if (operator.eq) return { text: 'Время', value }
  if (operator.neq) return { text: 'Время не', value }
  if (operator.gt || operator.gte) {
    return { text: `Время ${operator.gt ? 'после' : 'с'}`, value }
  }
  if (operator.lt || operator.lte) return { text: `Время ${operator.lt ? 'до' : 'по'}`, value }

  throw new Error(
    `Operator ${JSON.stringify(operator)} is not fully supported for 'time' field when mapped to 'due_hours'/'due_minutes'. Consider refining the LLM output or how 'time' filters are interpreted.`,
  )
}

export function getTaskColorHumanFilter(operator: SearchFilterOperator): ITextValue {
  if (
    operator.eq &&
    typeof operator.eq === 'object' &&
    'value' in operator.eq &&
    operator.eq.value
  ) {
    const color = getColorByNameAndTone(operator.eq.value, operator.eq.tone || 'medium')

    return { text: 'Цвет', value: getTaskRuColorName(color) }
  }
  if (
    operator.neq &&
    typeof operator.neq === 'object' &&
    'value' in operator.neq &&
    operator.neq.value
  ) {
    const color = getColorByNameAndTone(operator.neq.value, operator.neq.tone || 'medium')

    return { text: 'Цвет не', value: getTaskRuColorName(color) }
  }

  throw new Error(`Unsupported operator for 'color' field: ${JSON.stringify(operator)}`)
}

function getBooleanHumanFilter(
  operator: SearchFilterOperator,
  trueText: string,
  falseText: string,
): ITextValue {
  if (typeof operator.eq !== 'undefined') return { text: operator.eq ? trueText : falseText }
  if (typeof operator.neq !== 'undefined') return { text: operator.neq ? falseText : trueText }

  throw new Error(
    `Unsupported boolean operator: ${JSON.stringify(operator)}. Supported only 'eq' and 'neq' operators.`,
  )
}

function getNumberHumanFilter(field: string, operator: SearchFilterOperator): ITextValue {
  if (operator.eq !== undefined) {
    return { text: `${field} =`, value: formatHumanReadableValue(operator.eq) }
  }

  if (operator.neq !== undefined) {
    return { text: `${field} !=`, value: formatHumanReadableValue(operator.neq) }
  }

  if (operator.in !== undefined) {
    return { text: `${field} одно из`, value: operator.in.map(formatHumanReadableValue).join(', ') }
  }

  if (operator.nin !== undefined) {
    return {
      text: `${field} не одно из`,
      value: operator.nin.map(formatHumanReadableValue).join(', '),
    }
  }

  if (operator.gt !== undefined) {
    return { text: `${field} больше`, value: formatHumanReadableValue(operator.gt) }
  }

  if (operator.gte !== undefined) {
    return { text: `${field} от`, value: formatHumanReadableValue(operator.gte) }
  }

  if (operator.lt !== undefined) {
    return { text: `${field} меньше`, value: formatHumanReadableValue(operator.lt) }
  }

  if (operator.lte !== undefined) {
    return { text: `${field} до`, value: formatHumanReadableValue(operator.lte) }
  }

  throw new Error(`Unsupported numeric operator for '${field}' field: ${JSON.stringify(operator)}`)
}

function formatTagsValue(value: unknown): string {
  const values = Array.isArray(value) ? value : [value]

  return values.map((tag) => `#${tag}`).join(', ')
}

function formatHumanReadableValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return value.toString()

  return JSON.stringify(value)
}
