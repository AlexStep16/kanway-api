import { BoardService } from '@/application/services/BoardService.ts'
import { CategoryService } from '@/application/services/CategoryService.ts'
import { TaskService } from '@/application/services/TaskService.ts'
import dayjs from 'dayjs'
import { FilterQuery, Types } from 'mongoose'

interface StringFilter {
  equal?: string
  not_equal?: string
  contains?: string
  starts_with?: string
  ends_with?: string
}

interface DateTimeFilter {
  equal?: string
  greater_than?: string
  greater_than_equal?: string
  less_than?: string
  less_than_equal?: string
}

interface NumberFilter {
  equal?: number | string
  not_equal?: number | string
  greater_than?: number | string
  greater_than_equal?: number | string
  less_than?: number | string
  less_than_equal?: number | string
}

interface ArrayFilter {
  contains?: string[]
  contains_all?: string[]
  equals?: string[]
}

interface Filter {
  ids?: string[]
  name?: StringFilter
  description?: StringFilter
  dueDate?: DateTimeFilter
  dueTime?: DateTimeFilter
  isCompleted?: boolean
  isArchived?: boolean
  categoryIds?: string[]
  boardIds?: string[]
  workspaceIds?: string[]
  tags?: ArrayFilter
  color?: StringFilter
  order?: NumberFilter

  AND?: Array<any>
  and?: Array<any>
  OR?: Array<any>
  or?: Array<any>
}

export class FilterToMongoQueryService {
  protected taskService: TaskService
  protected categoryService: CategoryService
  protected boardService: BoardService

  constructor(
    taskService: TaskService,
    categoryService: CategoryService,
    boardService: BoardService
  ) {
    this.taskService = taskService
    this.categoryService = categoryService
    this.boardService = boardService
  }

  // ===================================================================
  // ОСНОВНАЯ ФУНКЦИЯ ТРАНСФОРМАЦИИ
  // ===================================================================
  private _getStringProcessedValue(mongoOp: string, operator: string, value: string) {
    let processedValue: any = value

    if (mongoOp === '$regex') {
      // 'i' делает поиск регистронезависимым
      if (operator === 'starts_with') {
        processedValue = new RegExp(`^${value}`, 'i')
      } else if (operator === 'ends_with') {
        processedValue = new RegExp(`${value}$`, 'i')
      } else {
        // contains
        processedValue = new RegExp(value as string, 'i')
      }
    }

    return processedValue
  }

  /**
   * Преобразует "плоский" объект фильтра от LLM в валидный MongoDB-запрос.
   * @param input - Объект, соответствующий FindTasksSchema.
   * @returns - Объект, готовый для передачи в Mongoose `find()`.
   */
  public async prepare(
    input: Filter,
    timezone: string,
    userId: Types.ObjectId
  ): Promise<FilterQuery<any>> {
    const operatorMap: { [key: string]: string } = {
      equal: '$regex',
      not_equal: '$ne',
      contains: '$regex',
      starts_with: '$regex',
      ends_with: '$regex',
      greater_than: '$gt',
      greater_than_equal: '$gte',
      less_than: '$lt',
      less_than_equal: '$lte',
      contains_any: '$in',
      contains_all: '$all',
    }

    const currentAndConditions: any[] = []
    const currentOrConditions: any[] = []

    try {
      if (input.AND !== undefined || input.and !== undefined) {
        const conditionsArray = input.AND || input.and || []
        for (const condition of conditionsArray) {
          const subQuery = await this.prepare(condition, timezone, userId)
          if (Object.keys(subQuery).length > 0) {
            currentAndConditions.push(subQuery)
          }
        }
      }

      if (input.OR !== undefined || input.or !== undefined) {
        const conditionsArray = input.OR || input.or || []
        for (const condition of conditionsArray) {
          const subQuery = await this.prepare(condition, timezone, userId)
          if (Object.keys(subQuery).length > 0) {
            currentOrConditions.push(subQuery)
          }
        }
      }

      if (input.ids !== undefined) {
        currentAndConditions.push({
          _id: { $in: input.ids.map((id) => Types.ObjectId.createFromHexString(id)) },
        })
      }
      if (input.isCompleted !== undefined) {
        currentAndConditions.push({ is_completed: input.isCompleted })
      }
      if (input.isArchived !== undefined) {
        currentAndConditions.push({ is_deleted: input.isArchived })
      } else {
        currentAndConditions.push({ is_deleted: false })
      }
      if (input.categoryIds !== undefined) {
        currentAndConditions.push({
          category_id: {
            $in: input.categoryIds.map((id) => Types.ObjectId.createFromHexString(id)),
          },
        })
      }
      if (input.boardIds !== undefined) {
        currentAndConditions.push({
          board_id: { $in: input.boardIds.map((id) => Types.ObjectId.createFromHexString(id)) },
        })
      }
      if (input.workspaceIds !== undefined) {
        currentAndConditions.push({
          workspace_id: {
            $in: input.workspaceIds.map((id) => Types.ObjectId.createFromHexString(id)),
          },
        })
      }

      if (input.name !== undefined) {
        for (const [key, value] of Object.entries(input.name)) {
          const mongoOp = operatorMap[key]
          currentAndConditions.push({
            name: {
              [mongoOp]: this._getStringProcessedValue(mongoOp, key, value),
            },
          })
        }
      }

      if (input.description !== undefined) {
        for (const [key, value] of Object.entries(input.description)) {
          const mongoOp = operatorMap[key]
          currentAndConditions.push({
            description: {
              [mongoOp]: this._getStringProcessedValue(mongoOp, key, value),
            },
          })
        }
      }

      if (input.dueDate !== undefined) {
        for (const [key, value] of Object.entries(input.dueDate)) {
          const mongoOp = operatorMap[key]
          currentAndConditions.push(this._getDateQuery('due_date', value, key, mongoOp, timezone))
        }
      }

      if (input.dueTime !== undefined) {
        for (const [key, value] of Object.entries(input.dueTime)) {
          currentAndConditions.push(this._getTimeQuery(value, key, timezone))
        }
      }

      if (input.tags !== undefined) {
        for (const [key, value] of Object.entries(input.tags)) {
          const mongoOp = operatorMap[key]
          currentAndConditions.push({
            tags: {
              [mongoOp]: value,
            },
          })
        }
      }

      if (input.order !== undefined) {
        for (const [key, value] of Object.entries(input.order)) {
          const mongoOp = operatorMap[key]
          currentAndConditions.push({
            order: {
              [mongoOp]: parseInt(value, 10),
            },
          })
        }
      }

      if (input.color !== undefined) {
        for (const [key, value] of Object.entries(input.color)) {
          const mongoOp = operatorMap[key]
          currentAndConditions.push(this._getColorQuery(value, mongoOp))
        }
      }

      if (currentOrConditions.length > 0) {
        currentAndConditions.push({ $or: currentOrConditions })
      }

      if (currentAndConditions.length === 1) {
        return currentAndConditions[0]
      } else if (currentAndConditions.length > 1) {
        return { $and: currentAndConditions }
      } else {
        return {}
      }
    } catch (e) {
      throw new Error(`Error converting filter to MongoDB query: ${(e as Error).message}`)
    }
  }

  // ===================================================================
  // ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ПОСТРОЕНИЯ ОДНОГО УСЛОВИЯ
  // ===================================================================

  private _getColorQuery(value: string, mongoOp: string): any {
    const normalizedColor = this.taskService.getNearestColor(value)
    const color = normalizedColor || ''

    return {
      color: {
        [mongoOp]: color,
      },
    }
  }

  private _getDateQuery(
    field: string,
    value: string,
    operator: string,
    mongoOp: string,
    timezone: string
  ): any {
    const m = dayjs(value)
    if (!m.isValid()) {
      throw new Error(`Invalid date value for due_date: ${value}`)
    }

    // Обрезаем часовой пояс и делаем его локальным, затем переводим в UTC
    const dateWithoutTimeZone = dayjs.tz(m.format('YYYY-MM-DDTHH:mm:ss.SSS'), timezone).utc()

    if (operator === 'equal') {
      const isDateOnly =
        m.hour() === 0 && m.minute() === 0 && m.second() === 0 && m.millisecond() === 0

      if (isDateOnly) {
        const startOfDay = dateWithoutTimeZone.startOf('day').toDate()
        const endOfDay = dateWithoutTimeZone.endOf('day').toDate()
        return {
          [field]: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
        }
      } else {
        return {
          [field]: {
            [mongoOp]: dateWithoutTimeZone.toDate(),
          },
        }
      }
    } else {
      return {
        [field]: {
          [mongoOp]: dateWithoutTimeZone.toDate(),
        },
      }
    }
  }

  private _getTimeQuery(value: string, operator: string, timezone: string): any {
    // Если приходит field 'time', мы ищем по due_hours и due_minutes
    let hour: string | number = value.split(':')[0]
    let minute: string | number = value.split(':')[1]

    const date = dayjs.utc().tz(timezone)

    date.set('hour', parseInt(hour, 10))
    date.set('minute', parseInt(minute, 10))
    date.set('second', 0)
    date.set('millisecond', 0)

    const dateUtc = date.utc()

    hour = parseInt(dateUtc.format('H'))
    minute = parseInt(dateUtc.format('m'))

    // Для 'equal' и 'not_equal' мы можем использовать прямые сравнения
    if (operator === 'equal') {
      return {
        $and: [{ due_hours: hour }, { due_minutes: minute }],
      }
    } else if (operator === 'not_equal') {
      // Логика "не равно" для часа и минуты: (час НЕ РАВЕН ИЛИ минута НЕ РАВНА)
      // То есть, если час не тот, или час тот, но минута не та.
      return {
        $or: [{ due_hours: { $ne: hour } }, { due_minutes: { $ne: minute } }],
      }
    }
    // Обработка диапазонов времени (greater_than, less_than и т.д.)
    // Это сложнее, так как требуется комбинировать due_hours и due_minutes
    // Например, "больше 14:30"
    // (due_hours > 14) ИЛИ (due_hours = 14 И due_minutes > 30)
    else if (operator === 'greater_than' || operator === 'greater_than_equal') {
      const mongoOperator = operator === 'greater_than' ? '$gt' : '$gte'
      return {
        $or: [
          { due_hours: { $gt: hour } }, // Если час больше
          {
            $and: [
              // Или если час равен, но минута больше/равна
              { due_hours: hour },
              { due_minutes: { [mongoOperator]: minute } },
            ],
          },
        ],
      }
    } else if (operator === 'less_than' || operator === 'less_than_equal') {
      const mongoOperator = operator === 'less_than' ? '$lt' : '$lte'
      return {
        $or: [
          { due_hours: { $lt: hour } }, // Если час меньше
          {
            $and: [
              // Или если час равен, но минута меньше/равна
              { due_hours: hour },
              { due_minutes: { [mongoOperator]: minute } },
            ],
          },
        ],
      }
    } else {
      throw new Error(
        `Operator ${operator} is not fully supported for 'time' field when mapped to 'due_hours'/'due_minutes'. Consider refining the LLM output or how 'time' filters are interpreted.`
      )
    }
  }
}
