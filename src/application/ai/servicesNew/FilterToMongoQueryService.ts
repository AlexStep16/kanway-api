import { BoardService } from '@/application/services/BoardService.js'
import { CategoryService } from '@/application/services/CategoryService.js'
import { TaskService } from '@/application/services/TaskService.js'
import { FilterQuery, Types } from 'mongoose'
import { SearchTasksDTO } from '../tools/schemes/searchTasksScheme.js'
import dayjs from 'dayjs'

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
  private _getStringFilter(
    field: string,
    operator: Omit<SearchTasksDTO['filters'][number], 'field'>,
  ): any {
    if (operator.eq) {
      return { $eq: operator.eq }
    } else if (operator.cont) {
      return { $regex: new RegExp(operator.cont, 'i') }
    } else if (operator.ncont) {
      return { $not: new RegExp(operator.ncont, 'i') }
    } else if (operator.neq) {
      return { $ne: operator.neq }
    } else if (operator.in) {
      return { $in: operator.in }
    } else if (operator.nin) {
      return { $nin: operator.nin }
    } else {
      throw new Error(`Unsupported operator for '${field}' field: ${operator}`)
    }
  }

  private _getIdFilter(
    field: string,
    operator: Omit<SearchTasksDTO['filters'][number], 'field'>,
  ): any {
    if (operator.eq) {
      return { $eq: operator.eq }
    } else if (operator.neq) {
      return { $ne: operator.neq }
    } else if (operator.in) {
      return { $in: operator.in }
    } else if (operator.nin) {
      return { $nin: operator.nin }
    } else {
      throw new Error(`Unsupported operator for '${field}' field: ${JSON.stringify(operator)}`)
    }
  }

  /**
   * Преобразует "плоский" объект фильтра от LLM в валидный MongoDB-запрос.
   * @param input - Объект, соответствующий FindTasksSchema.
   * @returns - Объект, готовый для передачи в Mongoose `find()`.
   */
  public prepare(
    payload: SearchTasksDTO,
    timezone: string,
    userId: Types.ObjectId,
  ): FilterQuery<any> {
    const currentAndConditions: any[] = []
    let isArchviedFilterPresent = false

    try {
      for (const filter of payload.filters) {
        const { field, ...rest } = filter

        if (field === 'id') {
          if (rest.eq) {
            currentAndConditions.push({
              _id: Types.ObjectId.createFromHexString(rest.eq),
            })
          } else if (rest.neq) {
            currentAndConditions.push({
              _id: { $ne: Types.ObjectId.createFromHexString(rest.neq) },
            })
          } else if (rest.in) {
            currentAndConditions.push({
              _id: { $in: rest.in.map((id: string) => Types.ObjectId.createFromHexString(id)) },
            })
          } else if (rest.nin) {
            currentAndConditions.push({
              _id: { $nin: rest.nin.map((id: string) => Types.ObjectId.createFromHexString(id)) },
            })
          } else {
            throw new Error(`Unsupported operator for 'id' field: ${JSON.stringify(rest)}`)
          }
        }

        if (field === 'name') {
          currentAndConditions.push({
            name: this._getStringFilter('name', rest),
          })
        }

        if (field === 'description') {
          currentAndConditions.push({
            description: this._getStringFilter('description', rest),
          })
        }

        if (field === 'due_date') {
          currentAndConditions.push(this._getDateQuery(rest, timezone))
        }

        if (field === 'due_time') {
          currentAndConditions.push(this._getTimeQuery(rest, timezone))
        }

        if (field === 'tags') {
          currentAndConditions.push(this._getArrayQuery('tags', rest))
        }

        if (field === 'order') {
          currentAndConditions.push(this._getNumberQuery('order', rest))
        }

        if (field === 'color') {
          currentAndConditions.push({
            color: this._getStringFilter('color', rest),
          })
        }

        if (field === 'is_completed') {
          if (rest.eq) {
            currentAndConditions.push({ is_completed: !!rest.eq })
          } else if (rest.neq) {
            currentAndConditions.push({ is_completed: { $ne: !!rest.neq } })
          } else {
            throw new Error(
              `Unsupported operator for 'is_completed' field: ${JSON.stringify(rest)}`,
            )
          }
        }

        if (field === 'is_deleted') {
          if (rest.eq) {
            currentAndConditions.push({ is_deleted: !!rest.eq })

            isArchviedFilterPresent = true
          } else if (rest.neq) {
            currentAndConditions.push({ is_deleted: { $ne: !!rest.neq } })

            isArchviedFilterPresent = true
          }
        }

        if (field === 'is_favorite') {
          if (rest.eq) {
            currentAndConditions.push({ is_favorite: !!rest.eq })
          } else if (rest.neq) {
            currentAndConditions.push({ is_favorite: { $ne: !!rest.neq } })
          } else {
            throw new Error(`Unsupported operator for 'is_favorite' field: ${JSON.stringify(rest)}`)
          }
        }

        if (field === 'category') {
          currentAndConditions.push({
            category: this._getIdFilter('category', rest),
          })
        }

        if (field === 'board') {
          currentAndConditions.push({
            board: this._getIdFilter('board', rest),
          })
        }

        if (field === 'workspace') {
          currentAndConditions.push({
            workspace: this._getIdFilter('workspace', rest),
          })
        }
      }

      currentAndConditions.push({ user_id: userId })

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
    operator: Omit<SearchTasksDTO['filters'][number], 'field'>,
  ): FilterQuery<any> {
    if (operator.eq) {
      return {
        [field]: { $eq: operator.eq },
      }
    } else if (operator.neq) {
      return {
        [field]: { $ne: operator.neq },
      }
    } else if (operator.in) {
      return {
        [field]: { $in: operator.in },
      }
    } else if (operator.nin) {
      return {
        [field]: { $nin: operator.nin },
      }
    } else if (operator.gt) {
      return {
        [field]: { $gt: operator.gt },
      }
    } else if (operator.gte) {
      return {
        [field]: { $gte: operator.gte },
      }
    } else if (operator.lt) {
      return {
        [field]: { $lt: operator.lt },
      }
    } else if (operator.lte) {
      return {
        [field]: { $lte: operator.lte },
      }
    } else {
      throw new Error(`Unsupported operator for '${field}' field: ${JSON.stringify(operator)}`)
    }
  }

  private _getArrayQuery(
    field: string,
    operator: Omit<SearchTasksDTO['filters'][number], 'field'>,
  ): FilterQuery<any> {
    if (operator.eq) {
      return {
        [field]: { $all: Array.isArray(operator.eq) ? operator.eq : [operator.eq] },
      }
    } else if (operator.neq) {
      return {
        [field]: { $not: { $all: Array.isArray(operator.neq) ? operator.neq : [operator.neq] } },
      }
    } else if (operator.contany) {
      return {
        [field]: { $in: operator.contany },
      }
    } else if (operator.ncontany) {
      return {
        [field]: { $nin: operator.ncontany },
      }
    } else {
      throw new Error(
        `Unsupported array operator for '${field}' field: ${JSON.stringify(operator)}`,
      )
    }
  }

  private _getDateQuery(
    operator: Omit<SearchTasksDTO['filters'][number], 'field'>,
    userTimezone: string,
  ): FilterQuery<any> {
    const value =
      operator.eq || operator.neq || operator.gt || operator.gte || operator.lt || operator.lte

    if (typeof value !== 'string') {
      throw new Error(`Invalid value for date operator: ${JSON.stringify(operator)}`)
    }

    const dateStr = value.split('T')[0]

    // 1. Вычисляем границы дня в UTC
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
    if (operator.eq) {
      // Попадает в интервал [startOfDay, nextDayStart)
      const condition = {
        $and: [
          { $gte: [constructedDateExpr, startOfDay] },
          { $lt: [constructedDateExpr, nextDayStart] },
        ],
      }
      return { $expr: condition }
    } else if (operator.neq) {
      // Попадает в интервал [startOfDay, nextDayStart)
      const condition = {
        $or: [
          { $lt: [constructedDateExpr, startOfDay] },
          { $gte: [constructedDateExpr, nextDayStart] },
        ],
      }
      return { $expr: condition }
    } else if (operator.gt) {
      const val = nextDayStart
      const op = '$gt'
      return { $expr: { [op]: [constructedDateExpr, val] } }
    } else if (operator.gte) {
      const val = startOfDay
      const op = '$gte'
      return { $expr: { [op]: [constructedDateExpr, val] } }
    } else if (operator.lt) {
      const val = startOfDay
      const op = '$lt'
      return { $expr: { [op]: [constructedDateExpr, val] } }
    } else if (operator.lte) {
      const val = nextDayStart
      const op = '$lte'
      return { $expr: { [op]: [constructedDateExpr, val] } }
    } else {
      throw new Error(`Unsupported operator for 'due_date' field: ${JSON.stringify(operator)}`)
    }
  }

  private _getTimeQuery(
    operator: Omit<SearchTasksDTO['filters'][number], 'field'>,
    timezone: string,
  ): any {
    let value =
      operator.eq || operator.neq || operator.gt || operator.gte || operator.lt || operator.lte

    if (typeof value !== 'string') {
      throw new Error(`Invalid value for time operator: ${JSON.stringify(operator)}`)
    }

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

    if (operator.eq) {
      return {
        $and: [{ due_hours: hour }, { due_minutes: minute }],
      }
    } else if (operator.neq) {
      return {
        $and: [{ due_hours: { $ne: hour } }, { due_minutes: { $ne: minute } }],
      }
    } else if (operator.gt || operator.gte) {
      const mongoOperator = operator.gt ? '$gt' : '$gte'

      return {
        $or: [
          { due_hours: { $gt: hour } },
          {
            $and: [{ due_hours: hour }, { due_minutes: { [mongoOperator]: minute } }],
          },
        ],
      }
    } else if (operator.lt || operator.lte) {
      const mongoOperator = operator.lt ? '$lt' : '$lte'

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
        `Operator ${JSON.stringify(operator)} is not fully supported for 'time' field when mapped to 'due_hours'/'due_minutes'. Consider refining the LLM output or how 'time' filters are interpreted.`,
      )
    }
  }
}
