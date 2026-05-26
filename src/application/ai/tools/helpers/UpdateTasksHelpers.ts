import { ITask } from '@/domain/entities/ITask.js'
import { UpdateTasksDTO } from '../schemes/UpdateTasksScheme.js'
import { TaskEditManyDTO } from '@/application/dtos/TaskEditManyDTO.js'
import { TaskEditDTO } from '@/application/dtos/TaskEditDTO.js'

export function transformRawUpdateToDTO(
  tasks: ITask[],
  updates: UpdateTasksDTO['updates'],
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

    addDueDateTimeUpdates(update, task, updates)

    return update
  })
}

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
): TaskEditDTO['color'] {
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
) {
  const dueDateUpdate = updates.due_date
  const dueHoursUpdate = updates.due_hours
  const dueMinutesUpdate = updates.due_minutes

  let dueDate = task.dueDate || formatDate(new Date())
  let dueHours = task.dueHours ?? 0
  let dueMinutes = task.dueMinutes ?? 0
  let requiresFullDateTimeRecalculation = false
  const fieldsToUnset = new Set<string>()

  if (typeof dueDateUpdate !== 'undefined') {
    if (dueDateUpdate === null) {
      update.dueDate = null
      fieldsToUnset.add('due_date')
    } else if (typeof dueDateUpdate === 'string') {
      dueDate = dueDateUpdate
      update.dueDate = dueDate
    } else {
      const shiftedDate = shiftDateTime(dueDate, dueHours, dueMinutes, 'day', dueDateUpdate.value)

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
      const shiftedDate = shiftDateTime(dueDate, dueHours, dueMinutes, 'hour', dueHoursUpdate.value)

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
): Date {
  const date = new Date(`${dueDate}T${padDatePart(dueHours)}:${padDatePart(dueMinutes)}:00`)

  if (Number.isNaN(date.getTime())) {
    return new Date()
  }

  if (unit === 'day') date.setDate(date.getDate() + amount)
  if (unit === 'hour') date.setHours(date.getHours() + amount)
  if (unit === 'minute') date.setMinutes(date.getMinutes() + amount)

  return date
}

export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`
}

export function padDatePart(value: number): string {
  return value.toString().padStart(2, '0')
}
