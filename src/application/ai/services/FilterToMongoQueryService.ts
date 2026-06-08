import { BoardService } from '@/application/services/BoardService.js'
import { ColumnService } from '@/application/services/ColumnService.js'
import { TaskService } from '@/application/services/TaskService.js'
import { WorkspaceService } from '@/application/services/WorkspaceService.js'
import { FilterQuery, Types } from 'mongoose'
import { SearchTasksDTO } from '../tools/schemes/TaskManager/SearchTasksScheme.js'
import dayjs from 'dayjs'
import { SelectionService } from './SelectionService.js'
import { SearchFilter, SearchFilterOperator } from '@/application/types/SearchFilter.js'

type ColorFilterValue = {
  value?: string
  tone?: 'light' | 'medium' | 'dark'
}

type SearchEntityType = 'task' | 'column' | 'board' | 'workspace'

type PrepareOptions = {
  entityType?: SearchEntityType
}

export class FilterToMongoQueryService {
  protected taskService: TaskService
  protected columnService: ColumnService
  protected boardService: BoardService
  protected workspaceService: WorkspaceService
  protected selectionService: SelectionService

  constructor(
    taskService: TaskService,
    columnService: ColumnService,
    boardService: BoardService,
    workspaceService: WorkspaceService,
    selectionService: SelectionService,
  ) {
    this.taskService = taskService
    this.columnService = columnService
    this.boardService = boardService
    this.workspaceService = workspaceService
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
    } else if (operator.contany) {
      return { $in: this._ensureStringFilterValues(field, 'in', operator.contany) }
    } else if (operator.ncont) {
      return { $not: new RegExp(operator.ncont, 'i') }
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

  private _getSingleTaskColorQuery(value: ColorFilterValue): FilterQuery<any> {
    const query: FilterQuery<any> = {}

    if (value.value) query['color.value'] = value.value
    if (value.tone) query['color.tone'] = value.tone

    if (Object.keys(query).length === 0) {
      throw new Error('Color filter requires at least one of value or tone')
    }

    return query
  }

  private _getSingleWorkspaceColorQuery(value: string): FilterQuery<any> {
    return { color: value }
  }

  private _getTaskColorFilterValue(
    operatorName: string,
    value: NonNullable<SearchFilterOperator['eq']>,
  ): ColorFilterValue {
    if (typeof value === 'string') return { value }
    if (this._isColorFilterValue(value)) return value

    throw new Error(
      `Operator '${operatorName}' for task 'color' field expects a string or color object, got ${JSON.stringify(value)}`,
    )
  }

  private _getWorkspaceColorFilterValue(
    operatorName: string,
    value: NonNullable<SearchFilterOperator['eq']>,
  ): string {
    if (typeof value === 'string') return value

    throw new Error(
      `Operator '${operatorName}' for workspace 'color' field expects a string value, got ${JSON.stringify(value)}`,
    )
  }

  private _getTaskColorQuery(operator: SearchFilterOperator): FilterQuery<any> {
    if (operator.eq) {
      return this._getSingleTaskColorQuery(this._getTaskColorFilterValue('eq', operator.eq))
    } else if (operator.neq) {
      return {
        $nor: [this._getSingleTaskColorQuery(this._getTaskColorFilterValue('neq', operator.neq))],
      }
    }

    throw new Error(`Unsupported operator for task 'color' field: ${JSON.stringify(operator)}`)
  }

  private _getWorkspaceColorQuery(operator: SearchFilterOperator): FilterQuery<any> {
    if (operator.eq) {
      return this._getSingleWorkspaceColorQuery(
        this._getWorkspaceColorFilterValue('eq', operator.eq),
      )
    } else if (operator.neq) {
      return {
        $nor: [
          this._getSingleWorkspaceColorQuery(
            this._getWorkspaceColorFilterValue('neq', operator.neq),
          ),
        ],
      }
    }

    throw new Error(`Unsupported operator for workspace 'color' field: ${JSON.stringify(operator)}`)
  }

  private _getColorQuery(
    operator: SearchFilterOperator,
    entityType: SearchEntityType,
  ): FilterQuery<any> {
    if (entityType === 'workspace') {
      return this._getWorkspaceColorQuery(operator)
    }

    return this._getTaskColorQuery(operator)
  }

  private _ensureNumberFilterValue(field: string, operatorName: string, value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }

    if (typeof value === 'string') {
      const parsedValue = Number(value)

      if (Number.isFinite(parsedValue)) {
        return parsedValue
      }
    }

    throw new Error(
      `Operator '${operatorName}' for '${field}' field expects a numeric value, got ${JSON.stringify(value)}`,
    )
  }

  private _ensureNumberFilterValues(
    field: string,
    operatorName: string,
    values: unknown[],
  ): number[] {
    return values.map((value) => this._ensureNumberFilterValue(field, operatorName, value))
  }

  private _isTasksCountMatch(count: number, operator: SearchFilterOperator): boolean {
    if (operator.eq !== undefined) {
      return count === this._ensureNumberFilterValue('tasks_count', 'eq', operator.eq)
    }

    if (operator.neq !== undefined) {
      return count !== this._ensureNumberFilterValue('tasks_count', 'neq', operator.neq)
    }

    if (operator.in !== undefined) {
      const values = this._ensureNumberFilterValues('tasks_count', 'in', operator.in)

      return values.includes(count)
    }

    if (operator.nin !== undefined) {
      const values = this._ensureNumberFilterValues('tasks_count', 'nin', operator.nin)

      return !values.includes(count)
    }

    if (operator.gt !== undefined) {
      return count > this._ensureNumberFilterValue('tasks_count', 'gt', operator.gt)
    }

    if (operator.gte !== undefined) {
      return count >= this._ensureNumberFilterValue('tasks_count', 'gte', operator.gte)
    }

    if (operator.lt !== undefined) {
      return count < this._ensureNumberFilterValue('tasks_count', 'lt', operator.lt)
    }

    if (operator.lte !== undefined) {
      return count <= this._ensureNumberFilterValue('tasks_count', 'lte', operator.lte)
    }

    throw new Error(
      `Unsupported operator for 'tasks_count' field: ${JSON.stringify(operator)}. Supported operators: eq, neq, in, nin, gt, gte, lt, lte.`,
    )
  }

  private _isEntityCountMatch(
    field: 'tasks_count' | 'columns_count' | 'boards_count',
    count: number,
    operator: SearchFilterOperator,
  ): boolean {
    if (field === 'tasks_count') {
      return this._isTasksCountMatch(count, operator)
    }

    if (operator.eq !== undefined) {
      return count === this._ensureNumberFilterValue(field, 'eq', operator.eq)
    }

    if (operator.neq !== undefined) {
      return count !== this._ensureNumberFilterValue(field, 'neq', operator.neq)
    }

    if (operator.in !== undefined) {
      const values = this._ensureNumberFilterValues(field, 'in', operator.in)

      return values.includes(count)
    }

    if (operator.nin !== undefined) {
      const values = this._ensureNumberFilterValues(field, 'nin', operator.nin)

      return !values.includes(count)
    }

    if (operator.gt !== undefined) {
      return count > this._ensureNumberFilterValue(field, 'gt', operator.gt)
    }

    if (operator.gte !== undefined) {
      return count >= this._ensureNumberFilterValue(field, 'gte', operator.gte)
    }

    if (operator.lt !== undefined) {
      return count < this._ensureNumberFilterValue(field, 'lt', operator.lt)
    }

    if (operator.lte !== undefined) {
      return count <= this._ensureNumberFilterValue(field, 'lte', operator.lte)
    }

    throw new Error(
      `Unsupported operator for '${field}' field: ${JSON.stringify(operator)}. Supported operators: eq, neq, in, nin, gt, gte, lt, lte.`,
    )
  }

  private async _getColumnIdsByTasksCount(
    tasksCountOperator: SearchFilterOperator,
    columnFilter: FilterQuery<any>,
    userId: Types.ObjectId,
  ): Promise<Types.ObjectId[]> {
    const columns = await this.columnService.getByFilter(columnFilter)

    if (columns.length === 0) return []

    const columnIds = columns.map((column) => column.id)
    const groupedTaskCounts = await this.taskService.getTasksCountByColumns(columnIds, userId)
    const taskCountByColumnId = new Map(
      groupedTaskCounts.map((entry) => [entry.parentId, entry.count]),
    )

    return columnIds.filter((columnId) => {
      const count = taskCountByColumnId.get(columnId.toString()) ?? 0

      return this._isTasksCountMatch(count, tasksCountOperator)
    })
  }

  private async _getBoardIdsByTasksCount(
    tasksCountOperator: SearchFilterOperator,
    boardFilter: FilterQuery<any>,
    userId: Types.ObjectId,
  ): Promise<Types.ObjectId[]> {
    const boards = await this.boardService.getByFilter(boardFilter)

    if (boards.length === 0) return []

    const boardIds = boards.map((board) => board.id)
    const groupedTaskCounts = await this.taskService.getTasksCountByBoards(boardIds, userId)
    const taskCountByBoardId = new Map(
      groupedTaskCounts.map((entry) => [entry.parentId, entry.count]),
    )

    return boardIds.filter((boardId) => {
      const count = taskCountByBoardId.get(boardId.toString()) ?? 0

      return this._isEntityCountMatch('tasks_count', count, tasksCountOperator)
    })
  }

  private async _getBoardIdsByColumnsCount(
    columnsCountOperator: SearchFilterOperator,
    boardFilter: FilterQuery<any>,
    userId: Types.ObjectId,
  ): Promise<Types.ObjectId[]> {
    const boards = await this.boardService.getByFilter(boardFilter)

    if (boards.length === 0) return []

    const boardIds = boards.map((board) => board.id)
    const groupedColumnCounts = await this.columnService.getColumnsCountByBoards(boardIds, userId)
    const columnCountByBoardId = new Map(
      groupedColumnCounts.map((entry) => [entry.parentId, entry.count]),
    )

    return boardIds.filter((boardId) => {
      const count = columnCountByBoardId.get(boardId.toString()) ?? 0

      return this._isEntityCountMatch('columns_count', count, columnsCountOperator)
    })
  }

  private async _getWorkspaceIdsByBoardsCount(
    boardsCountOperator: SearchFilterOperator,
    workspaceFilter: FilterQuery<any>,
    userId: Types.ObjectId,
  ): Promise<Types.ObjectId[]> {
    const workspaces = await this.workspaceService.getByFilter(workspaceFilter)

    if (workspaces.length === 0) return []

    const workspaceIds = workspaces.map((workspace) => workspace.id)
    const groupedBoardCounts = await this.boardService.getBoardsCountByWorkspaces(
      workspaceIds,
      userId,
    )
    const boardCountByWorkspaceId = new Map(
      groupedBoardCounts.map((entry) => [entry.parentId, entry.count]),
    )

    return workspaceIds.filter((workspaceId) => {
      const count = boardCountByWorkspaceId.get(workspaceId.toString()) ?? 0

      return this._isEntityCountMatch('boards_count', count, boardsCountOperator)
    })
  }

  private async _getWorkspaceIdsByColumnsCount(
    columnsCountOperator: SearchFilterOperator,
    workspaceFilter: FilterQuery<any>,
    userId: Types.ObjectId,
  ): Promise<Types.ObjectId[]> {
    const workspaces = await this.workspaceService.getByFilter(workspaceFilter)

    if (workspaces.length === 0) return []

    const workspaceIds = workspaces.map((workspace) => workspace.id)
    const groupedColumnCounts = await this.columnService.getColumnsCountByWorkspaces(
      workspaceIds,
      userId,
    )
    const columnCountByWorkspaceId = new Map(
      groupedColumnCounts.map((entry) => [entry.parentId, entry.count]),
    )

    return workspaceIds.filter((workspaceId) => {
      const count = columnCountByWorkspaceId.get(workspaceId.toString()) ?? 0

      return this._isEntityCountMatch('columns_count', count, columnsCountOperator)
    })
  }

  private async _getWorkspaceIdsByTasksCount(
    tasksCountOperator: SearchFilterOperator,
    workspaceFilter: FilterQuery<any>,
    userId: Types.ObjectId,
  ): Promise<Types.ObjectId[]> {
    const workspaces = await this.workspaceService.getByFilter(workspaceFilter)

    if (workspaces.length === 0) return []

    const workspaceIds = workspaces.map((workspace) => workspace.id)
    const groupedTaskCounts = await this.taskService.getTasksCountByWorkspaces(workspaceIds, userId)
    const taskCountByWorkspaceId = new Map(
      groupedTaskCounts.map((entry) => [entry.parentId, entry.count]),
    )

    return workspaceIds.filter((workspaceId) => {
      const count = taskCountByWorkspaceId.get(workspaceId.toString()) ?? 0

      return this._isEntityCountMatch('tasks_count', count, tasksCountOperator)
    })
  }

  /**
   * Преобразует "плоский" объект фильтра от LLM в валидный MongoDB-запрос.
   * @param input - Объект, соответствующий FindTasksSchema.
   * @returns - Объект, готовый для передачи в Mongoose `find()`.
   */
  public async prepare(
    filters: SearchFilter[],
    timezone: string,
    userId: Types.ObjectId,
    options?: PrepareOptions,
  ): Promise<FilterQuery<any>> {
    const currentAndConditions: any[] = []
    const tasksCountFilters: SearchFilterOperator[] = []
    const boardTasksCountFilters: SearchFilterOperator[] = []
    const workspaceTasksCountFilters: SearchFilterOperator[] = []
    const columnsCountFilters: SearchFilterOperator[] = []
    const workspaceColumnsCountFilters: SearchFilterOperator[] = []
    const boardsCountFilters: SearchFilterOperator[] = []
    let isArchviedFilterPresent = false
    const entityType = options?.entityType ?? 'task'

    try {
      for (const filter of filters) {
        const { field, ...rest } = filter

        if (field === 'id') {
          if (rest.eq) {
            currentAndConditions.push({
              _id: Types.ObjectId.createFromHexString(
                this._ensureStringFilterValue('id', 'eq', rest.eq),
              ),
            })
          } else if (rest.neq) {
            currentAndConditions.push({
              _id: {
                $ne: Types.ObjectId.createFromHexString(
                  this._ensureStringFilterValue('id', 'neq', rest.neq),
                ),
              },
            })
          } else if (rest.in) {
            currentAndConditions.push({
              _id: {
                $in: this._ensureStringFilterValues('id', 'in', rest.in).map((id) =>
                  Types.ObjectId.createFromHexString(id),
                ),
              },
            })
          } else if (rest.nin) {
            currentAndConditions.push({
              _id: {
                $nin: this._ensureStringFilterValues('id', 'nin', rest.nin).map((id) =>
                  Types.ObjectId.createFromHexString(id),
                ),
              },
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

        if (field === 'tasks_count') {
          if (entityType === 'column') {
            tasksCountFilters.push(rest)
          } else if (entityType === 'board') {
            boardTasksCountFilters.push(rest)
          } else if (entityType === 'workspace') {
            workspaceTasksCountFilters.push(rest)
          } else {
            throw new Error(
              `Field 'tasks_count' is supported only for column, board and workspace search`,
            )
          }
        }

        if (field === 'columns_count') {
          if (entityType === 'board') {
            columnsCountFilters.push(rest)
          } else if (entityType === 'workspace') {
            workspaceColumnsCountFilters.push(rest)
          } else {
            throw new Error(
              `Field 'columns_count' is supported only for board and workspace search`,
            )
          }
        }

        if (field === 'boards_count') {
          if (entityType !== 'workspace') {
            throw new Error(`Field 'boards_count' is supported only for workspace search`)
          }

          boardsCountFilters.push(rest)
        }

        if (field === 'created_at') {
          currentAndConditions.push(this._getSimpleDateQuery('createdAt', rest, timezone))
        }

        if (field === 'updated_at') {
          currentAndConditions.push(this._getSimpleDateQuery('updatedAt', rest, timezone))
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

        if (field === 'color') {
          currentAndConditions.push(this._getColorQuery(rest, entityType))
        }

        if (field === 'is_completed') {
          if (typeof rest.eq === 'boolean') {
            currentAndConditions.push({ is_completed: !!rest.eq })
          } else if (typeof rest.neq === 'boolean') {
            currentAndConditions.push({ is_completed: { $ne: !!rest.neq } })
          } else {
            throw new Error(
              `Unsupported operator for 'is_completed' field: ${JSON.stringify(rest)}. Supported only 'eq' and 'neq' operators.`,
            )
          }
        }

        if (field === 'is_deleted') {
          if (typeof rest.eq === 'boolean') {
            currentAndConditions.push({ is_deleted: !!rest.eq })

            isArchviedFilterPresent = true
          } else if (typeof rest.neq === 'boolean') {
            currentAndConditions.push({ is_deleted: { $ne: !!rest.neq } })

            isArchviedFilterPresent = true
          } else {
            throw new Error(
              `Unsupported operator for 'is_deleted' field: ${JSON.stringify(rest)}. Supported only 'eq' and 'neq' operators.`,
            )
          }
        }

        if (field === 'is_favorite') {
          if (typeof rest.eq === 'boolean') {
            currentAndConditions.push({ is_favorite: !!rest.eq })
          } else if (typeof rest.neq === 'boolean') {
            currentAndConditions.push({ is_favorite: { $ne: !!rest.neq } })
          } else {
            throw new Error(
              `Unsupported operator for 'is_favorite' field: ${JSON.stringify(rest)}. Supported only 'eq' and 'neq' operators.`,
            )
          }
        }

        if (field === 'column_id') {
          currentAndConditions.push({
            column: this._getIdFilter('column', rest),
          })
        }

        if (field === 'column_selection_id') {
          if (typeof rest.eq === 'string') {
            const selections = await this.selectionService.getByCriteria({
              id: rest.eq,
            })

            if (selections.length === 0) {
              throw new Error(`Selection with id ${rest.eq} not found`)
            }

            const selection = selections[0]

            currentAndConditions.push({
              column: {
                $in: selection.entityIds,
              },
            })
          } else {
            throw new Error(
              `Unsupported operator for 'column_selection_id' field: ${JSON.stringify(rest)}. Supported only 'eq' operator.`,
            )
          }
        }

        if (field === 'board_id') {
          currentAndConditions.push({
            board: this._getIdFilter('board', rest),
          })
        }

        if (field === 'board_selection_id') {
          if (typeof rest.eq === 'string') {
            const selections = await this.selectionService.getByCriteria({
              id: rest.eq,
            })

            if (selections.length === 0) {
              throw new Error(`Selection with id ${rest.eq} not found`)
            }

            const selection = selections[0]

            currentAndConditions.push({
              board: {
                $in: selection.entityIds,
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
          if (typeof rest.eq === 'string') {
            const selections = await this.selectionService.getByCriteria({
              id: rest.eq,
            })

            if (selections.length === 0) {
              throw new Error(`Selection with id ${rest.eq} not found`)
            }

            const selection = selections[0]

            currentAndConditions.push({
              workspace: {
                $in: selection.entityIds,
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

      if (tasksCountFilters.length > 0) {
        let columnFilter: FilterQuery<any> =
          currentAndConditions.length > 1
            ? { $and: [...currentAndConditions] }
            : currentAndConditions[0]

        for (const tasksCountFilter of tasksCountFilters) {
          const matchedColumnIds = await this._getColumnIdsByTasksCount(
            tasksCountFilter,
            columnFilter,
            userId,
          )

          currentAndConditions.push({ _id: { $in: matchedColumnIds } })
          columnFilter = { $and: [...currentAndConditions] }
        }
      }

      if (columnsCountFilters.length > 0) {
        let boardFilter: FilterQuery<any> =
          currentAndConditions.length > 1
            ? { $and: [...currentAndConditions] }
            : currentAndConditions[0]

        for (const columnsCountFilter of columnsCountFilters) {
          const matchedBoardIds = await this._getBoardIdsByColumnsCount(
            columnsCountFilter,
            boardFilter,
            userId,
          )

          currentAndConditions.push({ _id: { $in: matchedBoardIds } })
          boardFilter = { $and: [...currentAndConditions] }
        }
      }

      if (boardTasksCountFilters.length > 0) {
        let boardFilter: FilterQuery<any> =
          currentAndConditions.length > 1
            ? { $and: [...currentAndConditions] }
            : currentAndConditions[0]

        for (const boardTasksCountFilter of boardTasksCountFilters) {
          const matchedBoardIds = await this._getBoardIdsByTasksCount(
            boardTasksCountFilter,
            boardFilter,
            userId,
          )

          currentAndConditions.push({ _id: { $in: matchedBoardIds } })
          boardFilter = { $and: [...currentAndConditions] }
        }
      }

      if (boardsCountFilters.length > 0) {
        let workspaceFilter: FilterQuery<any> =
          currentAndConditions.length > 1
            ? { $and: [...currentAndConditions] }
            : currentAndConditions[0]

        for (const boardsCountFilter of boardsCountFilters) {
          const matchedWorkspaceIds = await this._getWorkspaceIdsByBoardsCount(
            boardsCountFilter,
            workspaceFilter,
            userId,
          )

          currentAndConditions.push({ _id: { $in: matchedWorkspaceIds } })
          workspaceFilter = { $and: [...currentAndConditions] }
        }
      }

      if (workspaceColumnsCountFilters.length > 0) {
        let workspaceFilter: FilterQuery<any> =
          currentAndConditions.length > 1
            ? { $and: [...currentAndConditions] }
            : currentAndConditions[0]

        for (const workspaceColumnsCountFilter of workspaceColumnsCountFilters) {
          const matchedWorkspaceIds = await this._getWorkspaceIdsByColumnsCount(
            workspaceColumnsCountFilter,
            workspaceFilter,
            userId,
          )

          currentAndConditions.push({ _id: { $in: matchedWorkspaceIds } })
          workspaceFilter = { $and: [...currentAndConditions] }
        }
      }

      if (workspaceTasksCountFilters.length > 0) {
        let workspaceFilter: FilterQuery<any> =
          currentAndConditions.length > 1
            ? { $and: [...currentAndConditions] }
            : currentAndConditions[0]

        for (const workspaceTasksCountFilter of workspaceTasksCountFilters) {
          const matchedWorkspaceIds = await this._getWorkspaceIdsByTasksCount(
            workspaceTasksCountFilter,
            workspaceFilter,
            userId,
          )

          currentAndConditions.push({ _id: { $in: matchedWorkspaceIds } })
          workspaceFilter = { $and: [...currentAndConditions] }
        }
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
}
