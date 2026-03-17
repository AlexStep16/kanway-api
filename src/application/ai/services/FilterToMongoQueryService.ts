import { BoardService } from '@/application/services/BoardService.ts'
import { CategoryService } from '@/application/services/CategoryService.ts'
import { TaskService } from '@/application/services/TaskService.ts'
import dayjs from 'dayjs'
import { FilterQuery, Types } from 'mongoose'
import { getColorByNameAndTone } from '@/utils/getColorByNameAndTone.ts'
import { SearchEntitiesDTO } from '../tools/schemes/search/searchEntitiesSchema.ts'

type DateAndNumberOperators = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin'
type ArrayOperators = 'eq' | 'neq' | 'cont' | 'contany' | 'notcont'

export class FilterToMongoQueryService {
  protected taskService: TaskService
  protected categoryService: CategoryService
  protected boardService: BoardService

  constructor(
    taskService: TaskService,
    categoryService: CategoryService,
    boardService: BoardService,
  ) {
    this.taskService = taskService
    this.categoryService = categoryService
    this.boardService = boardService
  }

  // ===================================================================
  // ОСНОВНАЯ ФУНКЦИЯ ТРАНСФОРМАЦИИ
  // ===================================================================
  private _getStringFilter(field: string, operator: string, value: string): any {
    if (operator === 'eq') {
      return { $eq: value }
    } else if (operator === 'cont') {
      return { $regex: new RegExp(value, 'i') }
    } else if (operator === 'notcont') {
      return { $not: new RegExp(value, 'i') }
    } else if (operator === 'neq') {
      return { $ne: value }
    } else if (operator === 'in') {
      return { $in: value }
    } else if (operator === 'nin') {
      return { $nin: value }
    } else {
      throw new Error(`Unsupported operator for '${field}' field: ${operator}`)
    }
  }

  private _getIdFilter(field: string, operator: string, value: Types.ObjectId): any {
    if (operator === 'eq') {
      return { $eq: value }
    } else if (operator === 'neq') {
      return { $ne: value }
    } else if (operator === 'in') {
      return { $in: value }
    } else if (operator === 'nin') {
      return { $nin: value }
    } else {
      throw new Error(`Unsupported operator for '${field}' field: ${operator}`)
    }
  }

  /**
   * Преобразует "плоский" объект фильтра от LLM в валидный MongoDB-запрос.
   * @param input - Объект, соответствующий FindTasksSchema.
   * @returns - Объект, готовый для передачи в Mongoose `find()`.
   */
  public prepare(
    dto: SearchEntitiesDTO,
    timezone: string,
    userId: Types.ObjectId,
  ): FilterQuery<any> {
    const currentAndConditions: any[] = []
    let isArchviedFilterPresent = false

    try {
      for (const filter of dto.filters) {
        const { field, operator, value } = filter

        if (field === 'id') {
          if (operator === 'eq') {
            currentAndConditions.push({
              _id: Types.ObjectId.createFromHexString(value),
            })
          } else if (operator === 'neq') {
            currentAndConditions.push({
              _id: { $ne: Types.ObjectId.createFromHexString(value) },
            })
          } else if (operator === 'in') {
            currentAndConditions.push({
              _id: { $in: value.map((id: string) => Types.ObjectId.createFromHexString(id)) },
            })
          } else if (operator === 'nin') {
            currentAndConditions.push({
              _id: { $nin: value.map((id: string) => Types.ObjectId.createFromHexString(id)) },
            })
          } else {
            throw new Error(`Unsupported operator for 'id' field: ${operator}`)
          }
        }

        if (field === 'name') {
          currentAndConditions.push({
            name: this._getStringFilter('name', operator, value),
          })
        }

        if (field === 'description') {
          currentAndConditions.push({
            description: this._getStringFilter('description', operator, value),
          })
        }

        if (field === 'dueDate') {
          currentAndConditions.push(
            this._getDateQuery(value, operator as DateAndNumberOperators, timezone),
          )
        }

        if (field === 'dueTime') {
          currentAndConditions.push(
            this._getTimeQuery(value, operator as DateAndNumberOperators, timezone),
          )
        }

        if (field === 'tags') {
          currentAndConditions.push(this._getArrayQuery('tags', value, operator as ArrayOperators))
        }

        if (field === 'order') {
          currentAndConditions.push(
            this._getNumberQuery('order', value, operator as DateAndNumberOperators),
          )
        }

        if (field === 'color') {
          const colorName = value.color
          const tone = value.tone

          if (!colorName) throw new Error(`Color value is required for 'color' field`)

          const color = getColorByNameAndTone(colorName, tone)

          currentAndConditions.push({
            name: this._getStringFilter('color', operator, color),
          })
        }

        if (field === 'isCompleted') {
          if (operator === 'eq' || operator === 'neq') {
            currentAndConditions.push({ is_completed: !!value })
          }
        }

        if (field === 'isArchived') {
          if (operator === 'eq' || operator === 'neq') {
            currentAndConditions.push({ is_deleted: !!value })

            isArchviedFilterPresent = true
          }
        }

        if (field === 'isFavorite') {
          if (operator === 'eq' || operator === 'neq') {
            currentAndConditions.push({ is_favorite: !!value })
          }
        }

        if (field === 'categoryId') {
          currentAndConditions.push({
            category: this._getIdFilter(
              'category',
              operator,
              Types.ObjectId.createFromHexString(value),
            ),
          })
        }

        if (field === 'boardId') {
          currentAndConditions.push({
            board: this._getIdFilter('board', operator, Types.ObjectId.createFromHexString(value)),
          })
        }

        if (field === 'workspaceId') {
          currentAndConditions.push({
            workspace: this._getIdFilter(
              'workspace',
              operator,
              Types.ObjectId.createFromHexString(value),
            ),
          })
        }

        if (field === 'tasksCount' || field === 'categoriesCount' || field === 'boardsCount') {
          currentAndConditions.push(
            this._getNumberQuery(field, value, operator as DateAndNumberOperators),
          )
        }

        currentAndConditions.push({ user_id: userId })
      }

      if (!isArchviedFilterPresent) {
        currentAndConditions.push({ is_deleted: false })
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
  ): FilterQuery<any> {
    if (operator === 'eq') {
      return {
        [field]: { $eq: value },
      }
    } else if (operator === 'neq') {
      return {
        [field]: { $ne: value },
      }
    } else if (operator === 'in') {
      return {
        [field]: { $in: value },
      }
    } else if (operator === 'nin') {
      return {
        [field]: { $nin: value },
      }
    } else if (operator === 'gt') {
      return {
        [field]: { $gt: value },
      }
    } else if (operator === 'gte') {
      return {
        [field]: { $gte: value },
      }
    } else if (operator === 'lt') {
      return {
        [field]: { $lt: value },
      }
    } else if (operator === 'lte') {
      return {
        [field]: { $lte: value },
      }
    } else {
      throw new Error(`Unsupported operator for '${field}' field: ${operator}`)
    }
  }

  private _getArrayQuery(
    field: string,
    values: string[],
    operator: ArrayOperators,
    isNegated: boolean = false,
  ): FilterQuery<any> {
    if (operator === 'eq') {
      return {
        [field]: { $all: values },
      }
    } else if (operator === 'neq') {
      return {
        [field]: { $not: { $all: values } },
      }
    } else if (operator === 'cont') {
      return {
        [field]: { $all: values },
      }
    } else if (operator === 'notcont') {
      return {
        [field]: { $not: { $all: values } },
      }
    } else if (operator === 'contany') {
      if (isNegated) {
        return {
          [field]: { $not: { $in: values } },
        }
      }
      return {
        [field]: { $in: values },
      }
    } else {
      throw new Error(`Unsupported array operator for '${field}' field: ${operator}`)
    }
  }

  private _getDateQuery(
    value: string,
    operator: DateAndNumberOperators,
    userTimezone: string,
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
      return { $expr: condition }
    } else if (operator === 'neq') {
      // Попадает в интервал [startOfDay, nextDayStart)
      const condition = {
        $or: [
          { $lt: [constructedDateExpr, startOfDay] },
          { $gte: [constructedDateExpr, nextDayStart] },
        ],
      }
      return { $expr: condition }
    } else if (operator === 'gt') {
      const val = nextDayStart
      const op = '$gt'
      return { $expr: { [op]: [constructedDateExpr, val] } }
    } else if (operator === 'gte') {
      const val = startOfDay
      const op = '$gte'
      return { $expr: { [op]: [constructedDateExpr, val] } }
    } else if (operator === 'lt') {
      const val = startOfDay
      const op = '$lt'
      return { $expr: { [op]: [constructedDateExpr, val] } }
    } else if (operator === 'lte') {
      const val = nextDayStart
      const op = '$lte'
      return { $expr: { [op]: [constructedDateExpr, val] } }
    } else {
      throw new Error(`Unsupported operator for 'dueDate' field: ${operator}`)
    }
  }

  private _getTimeQuery(value: string, operator: DateAndNumberOperators, timezone: string): any {
    value = value.toString().padStart(5, '0')

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

    if (operator === 'eq') {
      return {
        $and: [{ due_hours: hour }, { due_minutes: minute }],
      }
    } else if (operator === 'gt' || operator === 'gte') {
      const mongoOperator = operator === 'gt' ? '$gt' : '$gte'

      return {
        $or: [
          { due_hours: { $gt: hour } },
          {
            $and: [{ due_hours: hour }, { due_minutes: { [mongoOperator]: minute } }],
          },
        ],
      }
    } else if (operator === 'lt' || operator === 'lte') {
      const mongoOperator = operator === 'lt' ? '$lt' : '$lte'

      return {
        $or: [
          { due_hours: { $lt: hour } },
          {
            $and: [{ due_hours: hour }, { due_minutes: { [mongoOperator]: minute } }],
          },
        ],
      }
    } else {
      throw new Error(
        `Operator ${operator} is not fully supported for 'time' field when mapped to 'due_hours'/'due_minutes'. Consider refining the LLM output or how 'time' filters are interpreted.`,
      )
    }
  }
}
