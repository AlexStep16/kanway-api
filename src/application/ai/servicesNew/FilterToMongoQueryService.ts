import { BoardService } from '@/application/services/BoardService.js'
import { CategoryService } from '@/application/services/CategoryService.js'
import { TaskService } from '@/application/services/TaskService.js'
import { FilterQuery, Types } from 'mongoose'
import { SearchTasksDTO } from '../tools/schemes/SearchTasksScheme.js'
import dayjs from 'dayjs'
import { getRuColorName } from '@/utils/getColorName.js'
import { getColorByNameAndTone } from '@/utils/getColorByNameAndTone.js'
import { SelectionService } from './SelectionService.js'

type SearchFilterOperator = Omit<SearchTasksDTO['filters'][number], 'field'>
type ColorFilterValue = {
  value?: string
  tone?: 'light' | 'medium' | 'dark'
}

export class FilterToMongoQueryService {
  protected taskService: TaskService
  protected categoryService: CategoryService
  protected boardService: BoardService
  protected selectionService: SelectionService

  constructor(
    taskService: TaskService,
    categoryService: CategoryService,
    boardService: BoardService,
    selectionService: SelectionService,
  ) {
    this.taskService = taskService
    this.categoryService = categoryService
    this.boardService = boardService
    this.selectionService = selectionService
  }

  // ===================================================================
  // ОСНОВНАЯ ФУНКЦИЯ ТРАНСФОРМАЦИИ
  // ===================================================================
  private _getStringFilter(field: string, operator: SearchFilterOperator): any {
    if (operator.eq) {
      return { $eq: this._ensureStringFilterValue(field, 'eq', operator.eq) }
    } else if (operator.cont) {
      return { $regex: new RegExp(operator.cont, 'i') }
    } else if (operator.ncont) {
      return { $not: new RegExp(operator.ncont, 'i') }
    } else if (operator.neq) {
      return { $ne: this._ensureStringFilterValue(field, 'neq', operator.neq) }
    } else if (operator.in) {
      return { $in: this._ensureStringFilterValues(field, 'in', operator.in) }
    } else if (operator.nin) {
      return { $nin: this._ensureStringFilterValues(field, 'nin', operator.nin) }
    } else {
      throw new Error(`Unsupported operator for '${field}' field: ${operator}`)
    }
  }

  private _getStringHumanFilter(field: string, operator: SearchFilterOperator): any {
    if (operator.eq) {
      return `${field} ${operator.eq}`
    } else if (operator.cont) {
      return `${field} содержит ${operator.cont}`
    } else if (operator.ncont) {
      return `${field} не содержит ${operator.ncont}`
    } else if (operator.neq) {
      return `${field} не ${operator.neq}`
    } else if (operator.in) {
      return `${field} одно из ${operator.in.join(', ')}`
    } else if (operator.nin) {
      return `${field} не одно из ${operator.nin.join(', ')}`
    } else {
      throw new Error(`Unsupported operator for '${field}' field: ${operator}`)
    }
  }

  private _getIdFilter(field: string, operator: SearchFilterOperator): any {
    if (operator.eq) {
      return { $eq: this._ensureStringFilterValue(field, 'eq', operator.eq) }
    } else if (operator.neq) {
      return { $ne: this._ensureStringFilterValue(field, 'neq', operator.neq) }
    } else if (operator.in) {
      return { $in: this._ensureStringFilterValues(field, 'in', operator.in) }
    } else if (operator.nin) {
      return { $nin: this._ensureStringFilterValues(field, 'nin', operator.nin) }
    } else {
      throw new Error(`Unsupported operator for '${field}' field: ${JSON.stringify(operator)}`)
    }
  }

  private _ensureStringFilterValue(
    field: string,
    operatorName: string,
    value: NonNullable<SearchFilterOperator['eq']>,
  ): string {
    if (typeof value !== 'string') {
      throw new Error(
        `Operator '${operatorName}' for '${field}' field expects a string value, got ${JSON.stringify(value)}`,
      )
    }

    return value
  }

  private _ensureStringFilterValues(
    field: string,
    operatorName: string,
    values: NonNullable<SearchFilterOperator['in']>,
  ): string[] {
    values.forEach((value) => this._ensureStringFilterValue(field, operatorName, value))

    return values as string[]
  }

  private _isColorFilterValue(value: unknown): value is ColorFilterValue {
    return typeof value === 'object' && value !== null && ('value' in value || 'tone' in value)
  }

  private _getSingleColorQuery(value: string | ColorFilterValue): FilterQuery<any> {
    if (typeof value === 'string') {
      return { 'color.value': value }
    }

    const query: FilterQuery<any> = {}

    if (value.value) query['color.value'] = value.value
    if (value.tone) query['color.tone'] = value.tone

    if (Object.keys(query).length === 0) {
      throw new Error('Color filter requires at least one of value or tone')
    }

    return query
  }

  private _getColorFilterValue(
    operatorName: string,
    value: NonNullable<SearchFilterOperator['eq']>,
  ): string | ColorFilterValue {
    if (typeof value === 'string' || this._isColorFilterValue(value)) return value

    throw new Error(
      `Operator '${operatorName}' for 'color' field expects a string or color object, got ${JSON.stringify(value)}`,
    )
  }

  private _getColorQuery(operator: SearchFilterOperator): FilterQuery<any> {
    if (operator.eq) {
      return this._getSingleColorQuery(this._getColorFilterValue('eq', operator.eq))
    } else if (operator.neq) {
      return {
        $nor: [this._getSingleColorQuery(this._getColorFilterValue('neq', operator.neq))],
      }
    }

    throw new Error(`Unsupported operator for 'color' field: ${JSON.stringify(operator)}`)
  }

  private _getColorHumanFilter(operator: SearchFilterOperator): string {
    if (operator.eq && typeof operator.eq === 'object' && operator.eq.value) {
      const color = getColorByNameAndTone(operator.eq.value, operator.eq.tone || 'medium')
      const colorName = getRuColorName(color)
      return `Цвет ${colorName}`
    } else if (operator.neq && typeof operator.neq === 'object' && operator.neq.value) {
      const color = getColorByNameAndTone(operator.neq.value, operator.neq.tone || 'medium')
      const colorName = getRuColorName(color)
      return `Цвет не ${colorName}`
    }

    throw new Error(`Unsupported operator for 'color' field: ${JSON.stringify(operator)}`)
  }

  /**
   * Преобразует "плоский" объект фильтра от LLM в валидный MongoDB-запрос.
   * @param input - Объект, соответствующий FindTasksSchema.
   * @returns - Объект, готовый для передачи в Mongoose `find()`.
   */
  public async prepare(
    payload: SearchTasksDTO,
    timezone: string,
    userId: Types.ObjectId,
  ): Promise<{
    mongoQuery: FilterQuery<any>
    humanReadable: string
  }> {
    const currentAndConditions: any[] = []
    let isArchviedFilterPresent = false
    const humanFilters: string[] = []

    try {
      for (const filter of payload.filters) {
        const { field, ...rest } = filter

        if (field === 'id') {
          if (rest.eq) {
            currentAndConditions.push({
              _id: Types.ObjectId.createFromHexString(
                this._ensureStringFilterValue('id', 'eq', rest.eq),
              ),
            })
            humanFilters.push(`Id = ${rest.eq}`)
          } else if (rest.neq) {
            currentAndConditions.push({
              _id: {
                $ne: Types.ObjectId.createFromHexString(
                  this._ensureStringFilterValue('id', 'neq', rest.neq),
                ),
              },
            })
            humanFilters.push(`Id != ${rest.neq}`)
          } else if (rest.in) {
            currentAndConditions.push({
              _id: {
                $in: this._ensureStringFilterValues('id', 'in', rest.in).map((id) =>
                  Types.ObjectId.createFromHexString(id),
                ),
              },
            })
            humanFilters.push(`Id ${rest.in.join(' или ')} `)
          } else if (rest.nin) {
            currentAndConditions.push({
              _id: {
                $nin: this._ensureStringFilterValues('id', 'nin', rest.nin).map((id) =>
                  Types.ObjectId.createFromHexString(id),
                ),
              },
            })
            humanFilters.push(`Id не ${rest.nin.join(' и не ')} `)
          } else {
            throw new Error(`Unsupported operator for 'id' field: ${JSON.stringify(rest)}`)
          }
        }

        if (field === 'name') {
          currentAndConditions.push({
            name: this._getStringFilter('name', rest),
          })
          humanFilters.push(this._getStringHumanFilter('Название', rest))
        }

        if (field === 'description') {
          currentAndConditions.push({
            description: this._getStringFilter('description', rest),
          })
          humanFilters.push(this._getStringHumanFilter('Описание', rest))
        }

        if (field === 'created_at') {
          currentAndConditions.push(this._getSimpleDateQuery('createdAt', rest, timezone))
          humanFilters.push(this._getSimpleDateHumanFilter('Создано', rest))
        }

        if (field === 'updated_at') {
          currentAndConditions.push(this._getSimpleDateQuery('updatedAt', rest, timezone))
          humanFilters.push(this._getSimpleDateHumanFilter('Обновлено', rest))
        }

        if (field === 'due_date') {
          currentAndConditions.push(this._getDateQuery(rest, timezone))
          humanFilters.push(this._getDateHumanFilter(rest))
        }

        if (field === 'due_time') {
          currentAndConditions.push(this._getTimeQuery(rest, timezone))
          humanFilters.push(this._getTimeHumanFilter(rest))
        }

        if (field === 'tags') {
          currentAndConditions.push(this._getArrayQuery('tags', rest))
          humanFilters.push(this._getTagsHumanFilter(rest))
        }

        if (field === 'order') {
          currentAndConditions.push(this._getNumberQuery('order', rest))
          humanFilters.push(this._getNumberHumanFilter('Порядок', rest))
        }

        if (field === 'color') {
          currentAndConditions.push(this._getColorQuery(rest))
          humanFilters.push(this._getColorHumanFilter(rest))
        }

        if (field === 'is_completed') {
          if (rest.eq) {
            currentAndConditions.push({ is_completed: !!rest.eq })
            humanFilters.push(`${rest.eq ? 'Выполнено' : 'Не выполнено'}`)
          } else if (rest.neq) {
            currentAndConditions.push({ is_completed: { $ne: !!rest.neq } })
            humanFilters.push(`${rest.neq ? 'Не выполнено' : 'Выполнено'}`)
          } else {
            throw new Error(
              `Unsupported operator for 'is_completed' field: ${JSON.stringify(rest)}. Supported only 'eq' and 'neq' operators.`,
            )
          }
        }

        if (field === 'is_deleted') {
          if (rest.eq) {
            currentAndConditions.push({ is_deleted: !!rest.eq })
            humanFilters.push(`${rest.eq ? 'В архиве' : 'Не в архиве'}`)

            isArchviedFilterPresent = true
          } else if (rest.neq) {
            currentAndConditions.push({ is_deleted: { $ne: !!rest.neq } })
            humanFilters.push(`${rest.neq ? 'Не в архиве' : 'В архиве'}`)

            isArchviedFilterPresent = true
          } else {
            throw new Error(
              `Unsupported operator for 'is_deleted' field: ${JSON.stringify(rest)}. Supported only 'eq' and 'neq' operators.`,
            )
          }
        }

        if (field === 'is_favorite') {
          if (rest.eq) {
            currentAndConditions.push({ is_favorite: !!rest.eq })
            humanFilters.push(`${rest.eq ? 'В избранном' : 'Не в избранном'}`)
          } else if (rest.neq) {
            currentAndConditions.push({ is_favorite: { $ne: !!rest.neq } })
            humanFilters.push(`${rest.neq ? 'Не в избранном' : 'В избранном'}`)
          } else {
            throw new Error(
              `Unsupported operator for 'is_favorite' field: ${JSON.stringify(rest)}. Supported only 'eq' and 'neq' operators.`,
            )
          }
        }

        if (field === 'category_id') {
          currentAndConditions.push({
            category: this._getIdFilter('category', rest),
          })
        }

        if (field === 'category_selection_id') {
          if (rest.eq) {
            const selection = await this.selectionService.getSelection(rest.eq as string)

            if (!selection) {
              throw new Error(`Selection with id ${rest.eq} not found`)
            }

            currentAndConditions.push({
              category: {
                $in: selection.entityIds.map((id) => Types.ObjectId.createFromHexString(id)),
              },
            })
          } else {
            throw new Error(
              `Unsupported operator for 'category_selection_id' field: ${JSON.stringify(rest)}. Supported only 'eq' operator.`,
            )
          }
        }

        if (field === 'board_id') {
          currentAndConditions.push({
            board: this._getIdFilter('board', rest),
          })
        }

        if (field === 'board_selection_id') {
          if (rest.eq) {
            const selection = await this.selectionService.getSelection(rest.eq as string)

            if (!selection) {
              throw new Error(`Selection with id ${rest.eq} not found`)
            }

            currentAndConditions.push({
              board: {
                $in: selection.entityIds.map((id) => Types.ObjectId.createFromHexString(id)),
              },
            })
          } else {
            throw new Error(
              `Unsupported operator for 'board_selection_id' field: ${JSON.stringify(rest)}. Supported only 'eq' operator.`,
            )
          }
        }

        if (field === 'workspace_id') {
          currentAndConditions.push({
            workspace: this._getIdFilter('workspace', rest),
          })
        }

        if (field === 'workspace_selection_id') {
          if (rest.eq) {
            const selection = await this.selectionService.getSelection(rest.eq as string)

            if (!selection) {
              throw new Error(`Selection with id ${rest.eq} not found`)
            }

            currentAndConditions.push({
              workspace: {
                $in: selection.entityIds.map((id) => Types.ObjectId.createFromHexString(id)),
              },
            })
          } else {
            throw new Error(
              `Unsupported operator for 'workspace_selection_id' field: ${JSON.stringify(rest)}. Supported only 'eq' operator.`,
            )
          }
        }
      }

      currentAndConditions.push({ user_id: userId })

      if (!isArchviedFilterPresent) {
        currentAndConditions.push({ is_deleted: false })
      }

      if (currentAndConditions.length === 1) {
        return { mongoQuery: currentAndConditions[0], humanReadable: humanFilters.join('; ') }
      } else if (currentAndConditions.length > 1) {
        return {
          mongoQuery: { $and: currentAndConditions },
          humanReadable: humanFilters.join('; '),
        }
      } else {
        return { mongoQuery: {}, humanReadable: '' }
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

  private _getNumberHumanFilter(
    field: string,
    operator: Omit<SearchTasksDTO['filters'][number], 'field'>,
  ): string {
    if (operator.eq) {
      return `${field} = ${operator.eq}`
    } else if (operator.neq) {
      return `${field} != ${operator.neq}`
    } else if (operator.in) {
      return `${field} ${operator.in.join(' или ')}`
    } else if (operator.nin) {
      return `${field} не ${operator.nin.join(' и не ')}`
    } else if (operator.gt) {
      return `${field} больше ${operator.gt}`
    } else if (operator.gte) {
      return `${field} больше или равно ${operator.gte}`
    } else if (operator.lt) {
      return `${field} меньше ${operator.lt}`
    } else if (operator.lte) {
      return `${field} меньше или равно ${operator.lte}`
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
    } else if (operator.in) {
      return {
        [field]: { $in: operator.in },
      }
    } else if (operator.nin) {
      return {
        [field]: { $nin: operator.nin },
      }
    } else if (operator.cont) {
      return {
        [field]: { $in: operator.cont },
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

  private _getTagsHumanFilter(operator: Omit<SearchTasksDTO['filters'][number], 'field'>): string {
    if (operator.eq) {
      return `${Array.isArray(operator.eq) ? operator.eq.map((tag) => `#${tag}`).join(', ') : `#${operator.eq}`}`
    } else if (operator.neq) {
      return `Не ${Array.isArray(operator.neq) ? operator.neq.map((tag) => `#${tag}`).join(', ') : `#${operator.neq}`}`
    } else if (operator.in) {
      return `${Array.isArray(operator.in) ? operator.in.map((tag) => `#${tag}`).join(', ') : `#${operator.in}`}`
    } else if (operator.nin) {
      return `Не ${Array.isArray(operator.nin) ? operator.nin.map((tag) => `#${tag}`).join(', ') : `#${operator.nin}`}`
    } else if (operator.cont) {
      return `Содержит ${Array.isArray(operator.cont) ? operator.cont.map((tag) => `#${tag}`).join(', ') : `#${operator.cont}`}`
    } else if (operator.contany) {
      return `Содержит ${Array.isArray(operator.contany) ? operator.contany.map((tag) => `#${tag}`).join(', ') : `#${operator.contany}`}`
    } else if (operator.ncontany) {
      return `Не содержит ${Array.isArray(operator.ncontany) ? operator.ncontany.map((tag) => `#${tag}`).join(', ') : `#${operator.ncontany}`}`
    }

    throw new Error(`Unsupported array operator for 'tags' field: ${JSON.stringify(operator)}`)
  }

  private _getSimpleDateQuery(
    field: string,
    operator: Omit<SearchTasksDTO['filters'][number], 'field'>,
    userTimezone: string,
  ): FilterQuery<any> {
    const value =
      operator.eq || operator.neq || operator.gt || operator.gte || operator.lt || operator.lte

    if (typeof value !== 'string') {
      throw new Error(`Invalid value for date operator: ${JSON.stringify(operator)}`)
    }

    const date = dayjs.tz(value, userTimezone)
    if (!date.isValid()) throw new Error(`Invalid date: ${value}`)

    const utcDate = date.utc().toDate()

    if (operator.eq) {
      return { [field]: { $eq: utcDate } }
    } else if (operator.neq) {
      return { [field]: { $ne: utcDate } }
    } else if (operator.gt) {
      return { [field]: { $gt: utcDate } }
    } else if (operator.gte) {
      return { [field]: { $gte: utcDate } }
    } else if (operator.lt) {
      return { [field]: { $lt: utcDate } }
    } else if (operator.lte) {
      return { [field]: { $lte: utcDate } }
    } else {
      throw new Error(`Unsupported operator for '${field}' field: ${JSON.stringify(operator)}`)
    }
  }

  private _getSimpleDateHumanFilter(
    field: string,
    operator: Omit<SearchTasksDTO['filters'][number], 'field'>,
  ): string {
    const value =
      operator.eq || operator.neq || operator.gt || operator.gte || operator.lt || operator.lte

    if (typeof value !== 'string') {
      throw new Error(`Invalid value for date operator: ${JSON.stringify(operator)}`)
    }

    const date = dayjs(value)
    if (!date.isValid()) throw new Error(`Invalid date: ${value}`)

    if (operator.eq) {
      return `${field} ${date.format('YYYY.MM.DD')}`
    } else if (operator.neq) {
      return `${field} не ${date.format('YYYY.MM.DD')}`
    } else if (operator.gt) {
      return `${field} начиная с ${date.format('YYYY.MM.DD')}`
    } else if (operator.gte) {
      return `${field} после ${date.format('YYYY.MM.DD')}`
    } else if (operator.lt) {
      return `${field} до ${date.format('YYYY.MM.DD')}`
    } else if (operator.lte) {
      return `${field} раньше ${date.format('YYYY.MM.DD')}`
    } else {
      throw new Error(`Unsupported operator for '${field}' field: ${JSON.stringify(operator)}`)
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

  private _getDateHumanFilter(operator: Omit<SearchTasksDTO['filters'][number], 'field'>): string {
    if (operator.eq && typeof operator.eq === 'string') {
      const date = dayjs(operator.eq).format('YYYY.MM.DD')
      return `Срок ${date}`
    } else if (operator.neq && typeof operator.neq === 'string') {
      const date = dayjs(operator.neq).format('YYYY.MM.DD')
      return `Срок не ${date}`
    } else if (operator.gt && typeof operator.gt === 'string') {
      const date = dayjs(operator.gt).format('YYYY.MM.DD')
      return `Срок после ${date}`
    } else if (operator.gte && typeof operator.gte === 'string') {
      const date = dayjs(operator.gte).format('YYYY.MM.DD')
      return `Срок начиная с ${date}`
    } else if (operator.lt && typeof operator.lt === 'string') {
      const date = dayjs(operator.lt).format('YYYY.MM.DD')
      return `Срок до ${date}`
    } else if (operator.lte && typeof operator.lte === 'string') {
      const date = dayjs(operator.lte).format('YYYY.MM.DD')
      return `Срок раньше ${date}`
    } else {
      throw new Error(`Unsupported operator for 'due_date' field: ${JSON.stringify(operator)}`)
    }
  }

  private _getTimeQuery(
    operator: Omit<SearchTasksDTO['filters'][number], 'field'>,
    timezone: string,
  ): FilterQuery<any> {
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

  private _getTimeHumanFilter(operator: Omit<SearchTasksDTO['filters'][number], 'field'>): string {
    let value =
      operator.eq || operator.neq || operator.gt || operator.gte || operator.lt || operator.lte

    if (typeof value !== 'string') {
      throw new Error(`Invalid value for time operator: ${JSON.stringify(operator)}`)
    }

    value = value.toString().padStart(5, '0')

    if (operator.eq) {
      return `Время ${value}`
    } else if (operator.neq) {
      return `Время не ${value}`
    } else if (operator.gt || operator.gte) {
      const mongoOperator = operator.gt ? '$gt' : '$gte'

      return `Время ${mongoOperator === '$gt' ? 'после' : 'с'} ${value}`
    } else if (operator.lt || operator.lte) {
      const mongoOperator = operator.lt ? '$lt' : '$lte'

      return `Время ${mongoOperator === '$lt' ? 'до' : 'по'} ${value}`
    } else {
      throw new Error(
        `Operator ${JSON.stringify(operator)} is not fully supported for 'time' field when mapped to 'due_hours'/'due_minutes'. Consider refining the LLM output or how 'time' filters are interpreted.`,
      )
    }
  }
}
