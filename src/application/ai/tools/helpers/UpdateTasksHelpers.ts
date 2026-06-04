import { ITask } from '@/domain/entities/ITask.js'
import { TaskEditManyDTO } from '@/application/dtos/TaskEditManyDTO.js'
import { TaskEditDTO } from '@/application/dtos/TaskEditDTO.js'
import { getTaskRuColorName } from '@/utils/getTaskRuColorName.js'
import { getColorByNameAndTone } from '@/utils/getColorByNameAndTone.js'
import { UpdateTasksDTO } from '../schemes/TaskManager/UpdateTasksScheme.js'
import { getStringUpdateHumanReadableFilter, resolveStringUpdate } from './UpdateHelpers.js'
import { ITextValue } from '@/application/interfaces/statuses/content/ITextValue.js'
import dayjs from 'dayjs'

export function transformRawUpdateToDTO(
  tasks: ITask[],
  updates: UpdateTasksDTO['updates'],
  timezone: string,
): TaskEditManyDTO {
  if (Object.values(updates).every((value) => typeof value === 'undefined')) {
    throw new Error('No task fields to update')
  }

  return tasks.map((task) => {
    const update: TaskEditDTO = {
      id: task.id.toString(),
    }

    if (typeof updates.name !== 'undefined') {
      const name = resolveStringUpdate(task.name, updates.name)

      if (name === null) {
        throw new Error('Task name cannot be removed')
      }

      update.name = name
    }
    if (typeof updates.description !== 'undefined') {
      update.description = resolveStringUpdate(
        task.description || '',
        updates.description,
      ) as TaskEditDTO['description']
    }
    if (typeof updates.is_completed !== 'undefined') update.isCompleted = updates.is_completed
    if (typeof updates.tags !== 'undefined') {
      update.tags = resolveArrayUpdate(task.tags || [], updates.tags)
    }
    if (typeof updates.priority !== 'undefined') update.priority = updates.priority
    if (typeof updates.color !== 'undefined') update.color = resolveColorUpdate(updates.color)

    addDueDateTimeUpdates(update, task, updates, timezone)

    return update
  })
}

export function transformRawUpdateToHumanReadableFilters(
  updates: UpdateTasksDTO['updates'],
): ITextValue[] {
  if (Object.values(updates).every((value) => typeof value === 'undefined')) {
    throw new Error('No task fields to update')
  }

  const filters: ITextValue[] = []

  if (typeof updates.name !== 'undefined') {
    filters.push(getStringUpdateHumanReadableFilter('название', updates.name))
  }
  if (typeof updates.description !== 'undefined') {
    filters.push(getStringUpdateHumanReadableFilter('описание', updates.description))
  }
  if (typeof updates.is_completed !== 'undefined') {
    filters.push({
      text: updates.is_completed ? 'Отметить выполненной' : 'Отметить невыполненной',
    })
  }
  if (typeof updates.tags !== 'undefined') {
    filters.push(getTagsUpdateHumanReadableFilter(updates.tags))
  }
  if (typeof updates.priority !== 'undefined') {
    filters.push({
      text: 'Установить приоритет',
      value: getPriorityHumanReadableValue(updates.priority),
    })
  }
  if (typeof updates.color !== 'undefined') {
    const colorObj = resolveColorUpdate(updates.color)

    if (colorObj === null) {
      filters.push({
        text: 'Убрать цвет',
      })

      return filters
    }

    const color = getColorByNameAndTone(colorObj.value, colorObj.tone)

    filters.push({
      text: 'Установить цвет',
      value: getTaskRuColorName(color),
    })
  }

  const canCombineDueDateTimeUpdates =
    typeof updates.due_date === 'string' &&
    typeof updates.due_hours === 'number' &&
    typeof updates.due_minutes === 'number'

  const canCombineDueTimeUpdates =
    typeof updates.due_hours === 'number' && typeof updates.due_minutes === 'number'

  if (canCombineDueDateTimeUpdates) {
    const dueDate = updates.due_date as string
    const dueHours = updates.due_hours as number
    const dueMinutes = updates.due_minutes as number

    filters.push(getDueDateTimeUpdateHumanReadableFilter(dueDate, dueHours, dueMinutes))
  } else {
    if (typeof updates.due_date !== 'undefined') {
      filters.push(getDueDateUpdateHumanReadableFilter(updates.due_date))
    }

    if (canCombineDueTimeUpdates) {
      const dueHours = updates.due_hours as number
      const dueMinutes = updates.due_minutes as number

      filters.push(getDueTimeUpdateHumanReadableFilter(dueHours, dueMinutes))
    } else {
      if (typeof updates.due_hours !== 'undefined') {
        filters.push(getDueHoursUpdateHumanReadableFilter(updates.due_hours))
      }
      if (typeof updates.due_minutes !== 'undefined') {
        filters.push(getDueMinutesUpdateHumanReadableFilter(updates.due_minutes))
      }
    }
  }

  return filters
}

export function resolveArrayUpdate(
  currentValue: string[],
  update: NonNullable<UpdateTasksDTO['updates']['tags']>,
): string[] {
  if (Array.isArray(update)) return update

  return update.op === 'add'
    ? Array.from(new Set([...currentValue, ...update.value]))
    : currentValue.filter((tag) => !update.value.includes(tag))
}

export function resolveColorUpdate(
  update: Exclude<UpdateTasksDTO['updates']['color'], undefined>,
): NonNullable<TaskEditDTO['color']> | null {
  if (update === null) return null

  if (!update.value || !update.tone) {
    throw new Error('Both color value and tone must be provided to update task color')
  }

  return {
    value: update.value,
    tone: update.tone,
  }
}

export function addDueDateTimeUpdates(
  update: TaskEditDTO,
  task: ITask,
  updates: UpdateTasksDTO['updates'],
  timezone: string,
) {
  const dueDateUpdate = updates.due_date
  const dueHoursUpdate = updates.due_hours
  const dueMinutesUpdate = updates.due_minutes

  let dueDate = dayjs().tz(timezone).format('YYYY-MM-DD')
  let dueHours = 0
  let dueMinutes = 0
  let requiresFullDateTimeRecalculation = false
  const fieldsToUnset = new Set<string>()

  if (task.dueDate && typeof task.dueHours === 'number' && typeof task.dueMinutes === 'number') {
    const timezonedTaskDueDate = dayjs
      .utc(task.dueDate)
      .hour(task.dueHours)
      .minute(task.dueMinutes)
      .tz(timezone)

    if (timezonedTaskDueDate.isValid()) {
      dueDate = timezonedTaskDueDate.format('YYYY-MM-DD')
      dueHours = timezonedTaskDueDate.hour()
      dueMinutes = timezonedTaskDueDate.minute()
    }
  }

  if (typeof dueDateUpdate !== 'undefined') {
    if (dueDateUpdate === null) {
      update.dueDate = null
      fieldsToUnset.add('due_date')
    } else if (typeof dueDateUpdate === 'string') {
      dueDate = dueDateUpdate
      update.dueDate = dueDate
    } else {
      const shiftedDate = shiftDateTime(
        dueDate,
        dueHours,
        dueMinutes,
        'day',
        dueDateUpdate.value,
        timezone,
      )

      dueDate = formatDate(shiftedDate)
      dueHours = shiftedDate.getHours()
      dueMinutes = shiftedDate.getMinutes()
      requiresFullDateTimeRecalculation = true
    }
  }

  if (typeof dueHoursUpdate !== 'undefined') {
    if (dueHoursUpdate === null) {
      update.dueHours = null
      fieldsToUnset.add('due_hours')
    } else if (typeof dueHoursUpdate === 'number') {
      dueHours = dueHoursUpdate
      update.dueHours = dueHours
    } else {
      const shiftedDate = shiftDateTime(
        dueDate,
        dueHours,
        dueMinutes,
        'hour',
        dueHoursUpdate.value,
        timezone,
      )

      dueDate = formatDate(shiftedDate)
      dueHours = shiftedDate.getHours()
      dueMinutes = shiftedDate.getMinutes()
      requiresFullDateTimeRecalculation = true
    }
  }

  if (typeof dueMinutesUpdate !== 'undefined') {
    if (dueMinutesUpdate === null) {
      update.dueMinutes = null
      fieldsToUnset.add('due_minutes')
    } else if (typeof dueMinutesUpdate === 'number') {
      dueMinutes = dueMinutesUpdate
      update.dueMinutes = dueMinutes
    } else {
      const shiftedDate = shiftDateTime(
        dueDate,
        dueHours,
        dueMinutes,
        'minute',
        dueMinutesUpdate.value,
        timezone,
      )

      dueDate = formatDate(shiftedDate)
      dueHours = shiftedDate.getHours()
      dueMinutes = shiftedDate.getMinutes()
      requiresFullDateTimeRecalculation = true
    }
  }

  if (requiresFullDateTimeRecalculation) {
    if (!fieldsToUnset.has('due_date')) update.dueDate = dueDate
    if (!fieldsToUnset.has('due_hours')) update.dueHours = dueHours
    if (!fieldsToUnset.has('due_minutes')) update.dueMinutes = dueMinutes
  }
}

export function shiftDateTime(
  dueDate: string,
  dueHours: number,
  dueMinutes: number,
  unit: 'day' | 'hour' | 'minute',
  amount: number,
  timezone: string,
): Date {
  const date = dayjs
    .tz(`${dueDate}T${padDatePart(dueHours)}:${padDatePart(dueMinutes)}`, timezone)
    .add(amount, unit)

  if (!date.isValid()) {
    return new Date()
  }

  return date.toDate()
}

export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`
}

export function padDatePart(value: number): string {
  return value.toString().padStart(2, '0')
}

function getTagsUpdateHumanReadableFilter(
  update: NonNullable<UpdateTasksDTO['updates']['tags']>,
): ITextValue {
  if (Array.isArray(update)) {
    return {
      text: 'Установить теги',
      value: formatArrayUpdateValue(update),
    }
  }

  return {
    text: update.op === 'add' ? 'Добавить тег' : 'Удалить тег',
    value: formatArrayUpdateValue(update.value),
  }
}

function getDueDateUpdateHumanReadableFilter(
  update: Exclude<UpdateTasksDTO['updates']['due_date'], undefined>,
): ITextValue {
  if (update === null) {
    return {
      text: 'Убрать срок',
    }
  }

  if (typeof update === 'string') {
    return {
      text: 'Установить срок',
      value: update,
    }
  }

  return {
    text: 'Сдвинуть срок на дней',
    value: update.value.toString(),
  }
}

function getDueHoursUpdateHumanReadableFilter(
  update: Exclude<UpdateTasksDTO['updates']['due_hours'], undefined>,
): ITextValue {
  if (update === null) {
    return {
      text: 'Убрать время',
    }
  }

  if (typeof update === 'number') {
    return {
      text: 'Установить час',
      value: update.toString(),
    }
  }

  return {
    text: 'Сдвинуть время на часов',
    value: update.value.toString(),
  }
}

function getDueMinutesUpdateHumanReadableFilter(
  update: Exclude<UpdateTasksDTO['updates']['due_minutes'], undefined>,
): ITextValue {
  if (update === null) {
    return {
      text: 'Убрать минуты',
    }
  }

  if (typeof update === 'number') {
    return {
      text: 'Установить минуты',
      value: update.toString(),
    }
  }

  return {
    text: 'Сдвинуть время на минут',
    value: update.value.toString(),
  }
}

function getDueDateTimeUpdateHumanReadableFilter(
  dueDate: string,
  dueHours: number,
  dueMinutes: number,
): ITextValue {
  const formattedDate = dayjs(dueDate)

  if (!formattedDate.isValid()) {
    return {
      text: 'Установить срок и время',
      value: `${dueDate} ${padDatePart(dueHours)}:${padDatePart(dueMinutes)}`,
    }
  }

  return {
    text: 'Установить срок и время',
    value: `${formattedDate.format('YYYY.MM.DD')} ${padDatePart(dueHours)}:${padDatePart(dueMinutes)}`,
  }
}

function getDueTimeUpdateHumanReadableFilter(dueHours: number, dueMinutes: number): ITextValue {
  return {
    text: 'Установить время',
    value: `${padDatePart(dueHours)}:${padDatePart(dueMinutes)}`,
  }
}

function formatArrayUpdateValue(value: string[]): string {
  return value.length === 1 ? value[0] : value.map((v) => `#${v}, `).join(', ')
}

function getPriorityHumanReadableValue(
  priority: NonNullable<UpdateTasksDTO['updates']['priority']>,
): string {
  const titles = {
    low: 'Низкий',
    medium: 'Средний',
    high: 'Высокий',
  }

  return titles[priority]
}
