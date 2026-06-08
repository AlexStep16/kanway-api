import { TASK_COLORS_MAP } from '@/constants/TASK_COLORS.js'
import { EntityTypesEnum } from '@/domain/enums/EntityTypesEnum.js'
import dayjs from 'dayjs'
import { Types } from 'mongoose'

interface BuildEntitySamplesOptions {
  timezone?: string
  limit?: number
  additionalFields?: string[]
}

interface IParentEntity {
  id: Types.ObjectId
  name: string
}

export interface IEntitySample {
  [key: string]: unknown
  id?: string
  name?: string
  workspace?: IParentEntity
  board?: IParentEntity
  column?: IParentEntity
  dueDate?: string
  dueHours?: number
  dueMinutes?: number
  is_deleted: boolean
  isCompleted?: boolean
  color?: unknown
  createdAt?: string
  updatedAt?: string
}

const ENTITY_SAMPLE_LIMIT_DEFAULT = 5

const resolveDateKey = (entity: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    if (key in entity && typeof entity[key] !== 'undefined') return key
  }

  return null
}

const formatDateTime = (dateValue: unknown, timezone?: string): string | undefined => {
  if (!dateValue) return undefined

  if (
    typeof dateValue !== 'string' &&
    typeof dateValue !== 'number' &&
    !(dateValue instanceof Date)
  ) {
    return undefined
  }

  const date = timezone ? dayjs.utc(dateValue).tz(timezone) : dayjs(dateValue)

  if (!date.isValid()) return undefined

  return date.format('YYYY-MM-DDTHH:mm:ss')
}

const getTaskDueSample = (
  entity: Record<string, unknown>,
  timezone?: string,
): Pick<IEntitySample, 'dueDate' | 'dueHours' | 'dueMinutes'> | undefined => {
  const dueDateKey = resolveDateKey(entity, ['dueDate'])
  const dueHoursKey = resolveDateKey(entity, ['dueHours'])
  const dueMinutesKey = resolveDateKey(entity, ['dueMinutes'])

  if (!dueDateKey || typeof entity[dueDateKey] !== 'string') return undefined

  const dueDateValue = entity[dueDateKey]

  if (
    dueHoursKey &&
    dueMinutesKey &&
    typeof entity[dueHoursKey] === 'number' &&
    typeof entity[dueMinutesKey] === 'number'
  ) {
    const date = timezone
      ? dayjs.utc(dueDateValue).hour(entity[dueHoursKey]).minute(entity[dueMinutesKey]).tz(timezone)
      : dayjs(dueDateValue).hour(entity[dueHoursKey]).minute(entity[dueMinutesKey])

    if (date.isValid()) {
      return {
        dueDate: date.format('YYYY-MM-DD'),
        dueHours: date.hour(),
        dueMinutes: date.minute(),
      }
    }
  }

  return {
    dueDate: dueDateValue,
  }
}

const getColorSample = (
  entityType: EntityTypesEnum,
  entity: Record<string, unknown>,
): IEntitySample['color'] | undefined => {
  if (entityType === EntityTypesEnum.WORKSPACE) {
    if ('color' in entity && entity.color !== undefined) {
      if ('colorName' in entity && entity.colorName !== undefined) {
        return {
          value: entity.color,
          name: entity.colorName,
        }
      }

      return entity.color
    }

    return undefined
  }

  if (entityType === EntityTypesEnum.TASK && 'color' in entity && entity.color !== undefined) {
    const color = TASK_COLORS_MAP[entity.color as keyof typeof TASK_COLORS_MAP]

    if (!color) return entity.color

    return {
      name: color.name,
      tone: color.tone,
      ru: color.ru,
    }
  }

  return undefined
}

const buildEntitySampleItem = (
  entityType: EntityTypesEnum,
  entity: Record<string, unknown>,
  timezone?: string,
  additionalFields: string[] = [],
): IEntitySample => {
  const sample: IEntitySample = { is_deleted: false }

  if ('id' in entity && entity.id !== undefined) {
    sample.id = String(entity.id)
  }

  if ('name' in entity && typeof entity.name === 'string') {
    sample.name = entity.name
  }

  if ('isCompleted' in entity && typeof entity.isCompleted === 'boolean') {
    sample.isCompleted = entity.isCompleted
  }

  if ('isDeleted' in entity && typeof entity.isDeleted === 'boolean') {
    sample.is_deleted = entity.isDeleted
  }

  if ('workspace' in entity) {
    sample.workspace = entity.workspace as IParentEntity
  }

  if ('board' in entity) {
    sample.board = entity.board as IParentEntity
  }

  if ('column' in entity) {
    sample.column = entity.column as IParentEntity
  }

  if (entityType === EntityTypesEnum.TASK) {
    const due = getTaskDueSample(entity, timezone)

    if (due) {
      Object.assign(sample, due)
    }
  }

  if (additionalFields.includes('color')) {
    const color = getColorSample(entityType, entity)
    if (color !== undefined) sample.color = color
  }

  if (additionalFields.includes('createdAt')) {
    const createdAtKey = resolveDateKey(entity, ['createdAt'])
    if (createdAtKey) {
      const created = formatDateTime(entity[createdAtKey], timezone)
      if (created && additionalFields.includes('createdAt')) sample.createdAt = created
    }
  }

  if (additionalFields.includes('updatedAt')) {
    const updatedAtKey = resolveDateKey(entity, ['updatedAt'])
    if (updatedAtKey) {
      const updated = formatDateTime(entity[updatedAtKey], timezone)
      if (updated && additionalFields.includes('updatedAt')) sample.updatedAt = updated
    }
  }

  for (const field of additionalFields) {
    if (!field || field in sample) continue

    if (field in entity && typeof entity[field] !== 'undefined') {
      sample[field] = entity[field]
    }
  }

  return sample
}

export const buildEntitySamples = (
  entityType: EntityTypesEnum,
  entities: object[],
  options: BuildEntitySamplesOptions = {},
): IEntitySample[] => {
  const limit = options.limit ?? ENTITY_SAMPLE_LIMIT_DEFAULT
  const additionalFields = options.additionalFields ?? []

  return entities
    .slice(0, limit)
    .map((entity) =>
      buildEntitySampleItem(
        entityType,
        entity as Record<string, unknown>,
        options.timezone,
        additionalFields,
      ),
    )
}
