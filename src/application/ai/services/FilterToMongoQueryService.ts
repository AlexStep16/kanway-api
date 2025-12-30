import { BoardService } from '@/application/services/BoardService.ts'
import { CategoryService } from '@/application/services/CategoryService.ts'
import { TaskService } from '@/application/services/TaskService.ts'
import dayjs from 'dayjs'
import { FilterQuery, Types } from 'mongoose'

type DateAndNumberOperators = 'eq' | 'gt' | 'gte' | 'lt' | 'lte'
type StringOperators = 'equal' | 'contains' | 'starts_with' | 'ends_with'
type ArrayOperators = 'equal' | 'contains_all' | 'contains_any'

interface DateFilter {
  value: string
  operator: DateAndNumberOperators
  isNegated?: boolean
}

interface ArrayFilter {
  value: string[]
  operator: ArrayOperators
  isNegated?: boolean
}

interface NumberFilter {
  value: number
  operator: DateAndNumberOperators
  isNegated?: boolean
}

interface StringFilter {
  value: string
  operator: StringOperators
  isNegated?: boolean
}

interface Filter {
  ids?: string[]
  name?: StringFilter
  description?: StringFilter
  dueDate?: DateFilter
  dueTime?: DateFilter
  isCompleted?: boolean
  isArchived?: boolean
  categoryIds?: string[]
  boardIds?: string[]
  workspaceIds?: string[]
  tags?: ArrayFilter
  color?: ArrayFilter
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
  private _getStringProcessedValue(operator: string, value: string, isNegated: boolean = false) {
    if (operator === 'equal') {
      const regex = new RegExp(value, 'i')

      if (isNegated) {
        return { $ne: value }
      }

      return regex
    } else if (operator === 'contains') {
      const regex = new RegExp(value, 'i')

      if (isNegated) {
        return { $not: regex }
      }

      return regex
    } else if (operator === 'starts_with') {
      const regex = new RegExp('^' + value, 'i')

      if (isNegated) {
        return { $not: regex }
      }

      return regex
    } else if (operator === 'ends_with') {
      const regex = new RegExp(value + '$', 'i')

      if (isNegated) {
        return { $not: regex }
      }

      return regex
    } else {
      throw new Error(`Unsupported string operator: ${operator}`)
    }
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

      if (input.ids !== undefined && input.ids.length > 0) {
        currentAndConditions.push({
          _id: { $in: input.ids.map((id) => Types.ObjectId.createFromHexString(id)) },
        })
      }
      if (input.isCompleted !== undefined) {
        currentAndConditions.push({ is_completed: input.isCompleted })
      }
      if (input.isArchived === true) {
        currentAndConditions.push({ is_deleted: true, is_deleted_external: false })
      } else {
        currentAndConditions.push({ is_deleted: false })
      }
      if (input.categoryIds !== undefined && input.categoryIds.length > 0) {
        currentAndConditions.push({
          category_id: {
            $in: input.categoryIds.map((id) => Types.ObjectId.createFromHexString(id)),
          },
        })
      }
      if (input.boardIds !== undefined && input.boardIds.length > 0) {
        currentAndConditions.push({
          board_id: { $in: input.boardIds.map((id) => Types.ObjectId.createFromHexString(id)) },
        })
      }
      if (input.workspaceIds !== undefined && input.workspaceIds.length > 0) {
        currentAndConditions.push({
          workspace_id: {
            $in: input.workspaceIds.map((id) => Types.ObjectId.createFromHexString(id)),
          },
        })
      }

      if (input.name !== undefined) {
        const { operator, value, isNegated } = input.name as StringFilter

        currentAndConditions.push({
          name: this._getStringProcessedValue(operator, value, isNegated),
        })
      }

      if (input.description !== undefined) {
        const { operator, value, isNegated } = input.name as StringFilter

        currentAndConditions.push({
          description: this._getStringProcessedValue(operator, value, isNegated),
        })
      }

      if (input.dueDate !== undefined) {
        const { operator, value, isNegated } = input.dueDate as DateFilter

        currentAndConditions.push(this._getDateQuery(value, operator, timezone, isNegated))
      }

      if (input.dueTime !== undefined) {
        const { value, operator, isNegated } = input.dueTime as DateFilter

        currentAndConditions.push(this._getTimeQuery(value, operator, timezone, isNegated))
      }

      if (input.tags !== undefined) {
        const { value, operator, isNegated } = input.tags as ArrayFilter

        currentAndConditions.push(this._getArrayQuery('tags', value, operator, isNegated))
      }

      if (input.order !== undefined) {
        const { value, operator, isNegated } = input.order as NumberFilter

        currentAndConditions.push(this._getNumberQuery('order', value, operator, isNegated))
      }

      if (input.color !== undefined) {
        const { value, operator, isNegated } = input.color as ArrayFilter

        const normalizedColors = value.map((color) => this.taskService.getNearestColor(color) || '')

        currentAndConditions.push(
          this._getArrayQuery('color', normalizedColors, operator, isNegated)
        )
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

  private _getNumberQuery(
    field: string,
    value: number,
    operator: DateAndNumberOperators,
    isNegated: boolean = false
  ): FilterQuery<any> {
    if (operator === 'eq') {
      if (isNegated) {
        return {
          [field]: { $ne: value },
        }
      }

      return {
        [field]: { $eq: value },
      }
    } else if (operator === 'gt') {
      if (isNegated) {
        return {
          [field]: { $lte: value },
        }
      }

      return {
        [field]: { $gt: value },
      }
    } else if (operator === 'gte') {
      if (isNegated) {
        return {
          [field]: { $lt: value },
        }
      }

      return {
        [field]: { $gte: value },
      }
    } else if (operator === 'lt') {
      if (isNegated) {
        return {
          [field]: { $gte: value },
        }
      }

      return {
        [field]: { $lt: value },
      }
    } else if (operator === 'lte') {
      if (isNegated) {
        return {
          [field]: { $gt: value },
        }
      }

      return {
        [field]: { $lte: value },
      }
    } else {
      throw new Error(`Unsupported operator: ${operator}`)
    }
  }

  private _getArrayQuery(
    field: string,
    values: string[],
    operator: ArrayOperators,
    isNegated: boolean = false
  ): FilterQuery<any> {
    if (operator === 'equal') {
      if (isNegated) {
        return {
          [field]: { $ne: values },
        }
      }

      return {
        [field]: { $eq: values },
      }
    } else if (operator === 'contains_all') {
      if (isNegated) {
        return {
          [field]: { $not: { $all: values } },
        }
      }
      return {
        [field]: { $all: values },
      }
    } else if (operator === 'contains_any') {
      if (isNegated) {
        return {
          [field]: { $not: { $in: values } },
        }
      }
      return {
        [field]: { $in: values },
      }
    } else {
      throw new Error(`Unsupported array operator: ${operator}`)
    }
  }

  private _getDateQuery(
    value: string,
    operator: DateAndNumberOperators,
    userTimezone: string,
    isNegated: boolean = false
  ): FilterQuery<any> {
    const dateStr = value.split('T')[0]

    // 1. Вычисляем границы дня в UTC (как и раньше)
    const targetDate = dayjs.tz(dateStr, userTimezone)
    if (!targetDate.isValid()) throw new Error(`Invalid date: ${value}`)

    const startOfDay = targetDate.startOf('day').toDate()
    const nextDayStart = targetDate.add(1, 'day').startOf('day').toDate()

    // 2. Безопасное извлечение часов и минут
    // Если в поле лежит пустая строка "", null или мусор -> считаем это за 0
    const safeDateConversion = {
      $convert: {
        input: `$due_date`, // Например $dueDate
        to: 'date', // Пытаемся сделать дату
        onError: null, // Если ошибка (пустая строка/мусор) -> null
        onNull: null, // Если null -> null
      },
    }

    // 3. Безопасное время
    const safeHours = { $convert: { input: '$due_hours', to: 'int', onError: 0, onNull: 0 } }
    const safeMinutes = { $convert: { input: '$due_minutes', to: 'int', onError: 0, onNull: 0 } }

    // 4. Логика сборки
    // Используем $let, чтобы сначала определить переменные, а потом проверить их
    const constructedDateExpr = {
      $let: {
        vars: {
          d: safeDateConversion, // Наша безопасная дата
          h: safeHours,
          m: safeMinutes,
        },
        in: {
          $cond: {
            // Если дата некорректна (null), возвращаем 1970 год (не попадет в поиск "сегодня")
            if: { $eq: ['$$d', null] },
            then: new Date(0),
            else: {
              // Иначе собираем дату из частей
              $dateFromParts: {
                year: { $year: '$$d' },
                month: { $month: '$$d' },
                day: { $dayOfMonth: '$$d' },
                hour: '$$h',
                minute: '$$m',
                timezone: 'UTC',
              },
            },
          },
        },
      },
    }

    // 4. Формируем условия (логика та же, что и выше)
    if (operator === 'eq') {
      // Попадает в интервал [startOfDay, nextDayStart)
      const condition = {
        $and: [
          { $gte: [constructedDateExpr, startOfDay] },
          { $lt: [constructedDateExpr, nextDayStart] },
        ],
      }
      return isNegated ? { $expr: { $not: condition } } : { $expr: condition }
    } else if (operator === 'gt') {
      const val = isNegated ? nextDayStart : nextDayStart
      const op = isNegated ? '$lt' : '$gte'
      return { $expr: { [op]: [constructedDateExpr, val] } }
    } else if (operator === 'gte') {
      const val = isNegated ? startOfDay : startOfDay
      const op = isNegated ? '$lt' : '$gte'
      return { $expr: { [op]: [constructedDateExpr, val] } }
    } else if (operator === 'lt') {
      const val = isNegated ? startOfDay : startOfDay
      const op = isNegated ? '$gte' : '$lt'
      return { $expr: { [op]: [constructedDateExpr, val] } }
    } else if (operator === 'lte') {
      const val = isNegated ? nextDayStart : nextDayStart
      const op = isNegated ? '$gte' : '$lt'
      return { $expr: { [op]: [constructedDateExpr, val] } }
    } else {
      throw new Error(`Unsupported operator: ${operator}`)
    }
  }

  private _getTimeQuery(
    value: string,
    operator: DateAndNumberOperators,
    timezone: string,
    isNegated: boolean = false
  ): any {
    value = value.toString().padStart(5, '0') // Гарантируем формат "HH:mm"

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
    if (operator === 'eq') {
      if (isNegated) {
        // Логика "не равно" для часа и минуты: (час НЕ РАВЕН ИЛИ минута НЕ РАВНА)
        // То есть, если час не тот, или час тот, но минута не та.
        return {
          $or: [{ due_hours: { $ne: hour } }, { due_minutes: { $ne: minute } }],
        }
      }

      return {
        $and: [{ due_hours: hour }, { due_minutes: minute }],
      }
    }
    // Обработка диапазонов времени (greater_than, less_than и т.д.)
    // Это сложнее, так как требуется комбинировать due_hours и due_minutes
    // Например, "больше 14:30"
    // (due_hours > 14) ИЛИ (due_hours = 14 И due_minutes > 30)
    else if (operator === 'gt' || operator === 'gte') {
      const mongoOperator = operator === 'gt' ? '$gt' : '$gte'

      if (isNegated) {
        // Логика "не больше" для часа и минуты:
        // То есть, если час меньше, или час равен, но минута меньше/равна.
        const negatedMongoOperator = operator === 'gt' ? '$lt' : '$lte'

        return {
          $or: [
            { due_hours: { $lt: hour } },
            {
              $and: [{ due_hours: hour }, { due_minutes: { [negatedMongoOperator]: minute } }],
            },
          ],
        }
      }

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
    } else if (operator === 'lt' || operator === 'lte') {
      const mongoOperator = operator === 'lt' ? '$lt' : '$lte'

      if (isNegated) {
        // Логика "не меньше" для часа и минуты:
        // То есть, если час больше, или час равен, но минута больше/равна.
        const negatedMongoOperator = operator === 'lt' ? '$gt' : '$gte'

        return {
          $or: [
            { due_hours: { $gt: hour } },
            {
              $and: [{ due_hours: hour }, { due_minutes: { [negatedMongoOperator]: minute } }],
            },
          ],
        }
      }

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
