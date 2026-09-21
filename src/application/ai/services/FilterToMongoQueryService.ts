import { BoardService } from '@/application/services/BoardService.js'
import { ColumnService } from '@/application/services/ColumnService.js'
import { TaskService } from '@/application/services/TaskService.js'
import { WorkspaceService } from '@/application/services/WorkspaceService.js'
import { FilterQuery, Types } from 'mongoose'
import { SearchTasksDTO } from '../tools/schemes/TaskManager/SearchTasksScheme.js'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import { SelectionService } from './SelectionService.js'
import { SearchFilter, SearchFilterOperator } from '@/application/types/SearchFilter.js'

dayjs.extend(utc)
dayjs.extend(timezone)

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

  private _escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  private _getStringFilter(field: string, operator: SearchFilterOperator): any {
    if (operator.eq !== undefined) {
      return { $eq: this._ensureStringFilterValue(field, 'eq', operator.eq) }
    } else if (operator.cont !== undefined) {
      return { $regex: new RegExp(this._escapeRegex(operator.cont), 'i') }
    } else if (operator.contany !== undefined) {
      const values = this._ensureStringFilterValues(field, 'contany', operator.contany)
      const pattern = values.map(this._escapeRegex).join('|')
      return { $regex: new RegExp(pattern, 'i') }
    } else if (operator.ncont !== undefined) {
      return { $not: new RegExp(this._escapeRegex(operator.ncont), 'i') }
    } else if (operator.ncontany !== undefined) {
      const values = this._ensureStringFilterValues(field, 'ncontany', operator.ncontany)
      const pattern = values.map(this._escapeRegex).join('|')
      return { $not: new RegExp(pattern, 'i') }
    } else if (operator.neq !== undefined) {
      return { $ne: this._ensureStringFilterValue(field, 'neq', operator.neq) }
    } else if (operator.in !== undefined) {
      return { $in: this._ensureStringFilterValues(field, 'in', operator.in) }
    } else if (operator.nin !== undefined) {
      return { $nin: this._ensureStringFilterValues(field, 'nin', operator.nin) }
    } else {
      throw new Error(`Unsupported operator for '${field}' field: ${JSON.stringify(operator)}`)
    }
  }

  private _getIdFilter(field: string, operator: SearchFilterOperator): any {
    if (operator.eq !== undefined) {
      return { $eq: this._ensureStringFilterValue(field, 'eq', operator.eq) }
    } else if (operator.neq !== undefined) {
      return { $ne: this._ensureStringFilterValue(field, 'neq', operator.neq) }
    } else if (operator.in !== undefined) {
      return { $in: this._ensureStringFilterValues(field, 'in', operator.in) }
    } else if (operator.nin !== undefined) {
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
    values: unknown,
  ): string[] {
    if (!Array.isArray(values)) {
      throw new Error(`Operator '${operatorName}' for '${field}' expects an array of strings`)
    }
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
    if (operator.eq !== undefined) {
      return this._getSingleTaskColorQuery(this._getTaskColorFilterValue('eq', operator.eq))
    } else if (operator.neq !== undefined) {
      return {
        $nor: [this._getSingleTaskColorQuery(this._getTaskColorFilterValue('neq', operator.neq))],
      }
    }
    throw new Error(`Unsupported operator for task 'color' field: ${JSON.stringify(operator)}`)
  }

  private _getWorkspaceColorQuery(operator: SearchFilterOperator): FilterQuery<any> {
    if (operator.eq !== undefined) {
      return this._getSingleWorkspaceColorQuery(
        this._getWorkspaceColorFilterValue('eq', operator.eq),
      )
    } else if (operator.neq !== undefined) {
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
    values: unknown,
  ): number[] {
    if (!Array.isArray(values)) {
      throw new Error(`Operator '${operatorName}' for '${field}' expects an array of numbers`)
    }
    return values.map((value) => this._ensureNumberFilterValue(field, operatorName, value))
  }

  private _isTasksCountMatch(count: number, operator: SearchFilterOperator): boolean {
    if (operator.eq !== undefined)
      return count === this._ensureNumberFilterValue('tasks_count', 'eq', operator.eq)
    if (operator.neq !== undefined)
      return count !== this._ensureNumberFilterValue('tasks_count', 'neq', operator.neq)
    if (operator.in !== undefined)
      return this._ensureNumberFilterValues('tasks_count', 'in', operator.in).includes(count)
    if (operator.nin !== undefined)
      return !this._ensureNumberFilterValues('tasks_count', 'nin', operator.nin).includes(count)
    if (operator.gt !== undefined)
      return count > this._ensureNumberFilterValue('tasks_count', 'gt', operator.gt)
    if (operator.gte !== undefined)
      return count >= this._ensureNumberFilterValue('tasks_count', 'gte', operator.gte)
    if (operator.lt !== undefined)
      return count < this._ensureNumberFilterValue('tasks_count', 'lt', operator.lt)
    if (operator.lte !== undefined)
      return count <= this._ensureNumberFilterValue('tasks_count', 'lte', operator.lte)

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

    if (operator.eq !== undefined)
      return count === this._ensureNumberFilterValue(field, 'eq', operator.eq)
    if (operator.neq !== undefined)
      return count !== this._ensureNumberFilterValue(field, 'neq', operator.neq)
    if (operator.in !== undefined)
      return this._ensureNumberFilterValues(field, 'in', operator.in).includes(count)
    if (operator.nin !== undefined)
      return !this._ensureNumberFilterValues(field, 'nin', operator.nin).includes(count)
    if (operator.gt !== undefined)
      return count > this._ensureNumberFilterValue(field, 'gt', operator.gt)
    if (operator.gte !== undefined)
      return count >= this._ensureNumberFilterValue(field, 'gte', operator.gte)
    if (operator.lt !== undefined)
      return count < this._ensureNumberFilterValue(field, 'lt', operator.lt)
    if (operator.lte !== undefined)
      return count <= this._ensureNumberFilterValue(field, 'lte', operator.lte)

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
    let isArchivedFilterPresent = false
    const entityType = options?.entityType ?? 'task'

    try {
      for (const filter of filters) {
        const { field, ...rest } = filter

        if (field === 'id') {
          if (rest.eq !== undefined) {
            currentAndConditions.push({
              _id: Types.ObjectId.createFromHexString(
                this._ensureStringFilterValue('id', 'eq', rest.eq),
              ),
            })
          } else if (rest.neq !== undefined) {
            currentAndConditions.push({
              _id: {
                $ne: Types.ObjectId.createFromHexString(
                  this._ensureStringFilterValue('id', 'neq', rest.neq),
                ),
              },
            })
          } else if (rest.in !== undefined) {
            currentAndConditions.push({
              _id: {
                $in: this._ensureStringFilterValues('id', 'in', rest.in).map((id) =>
                  Types.ObjectId.createFromHexString(id),
                ),
              },
            })
          } else if (rest.nin !== undefined) {
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
            isArchivedFilterPresent = true
          } else if (typeof rest.neq === 'boolean') {
            currentAndConditions.push({ is_deleted: { $ne: !!rest.neq } })
            isArchivedFilterPresent = true
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
            const selections = await this.selectionService.getByCriteria({ id: rest.eq })
            if (selections.length === 0) throw new Error(`Selection with id ${rest.eq} not found`)

            currentAndConditions.push({
              column: { $in: selections[0].entityIds },
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
            const selections = await this.selectionService.getByCriteria({ id: rest.eq })
            if (selections.length === 0) throw new Error(`Selection with id ${rest.eq} not found`)

            currentAndConditions.push({
              board: { $in: selections[0].entityIds },
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
            const selections = await this.selectionService.getByCriteria({ id: rest.eq })
            if (selections.length === 0) throw new Error(`Selection with id ${rest.eq} not found`)

            currentAndConditions.push({
              workspace: { $in: selections[0].entityIds },
            })
          } else {
            throw new Error(
              `Unsupported operator for 'workspace_selection_id' field: ${JSON.stringify(rest)}. Supported only 'eq' operator.`,
            )
          }
        }
      }

      currentAndConditions.push({ user_id: userId })

      if (!isArchivedFilterPresent) {
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

  private _getSimpleDateQuery(
    field: string,
    operator: Omit<SearchTasksDTO['filters'][number], 'field'>,
    userTimezone: string,
  ): FilterQuery<any> {
    const toUtcDate = (val: unknown): Date => {
      if (typeof val !== 'string') {
        throw new Error(
          `Invalid date value for field '${field}': expected string, got ${JSON.stringify(val)}`,
        )
      }
      const date = dayjs.tz(val, userTimezone)
      if (!date.isValid()) {
        throw new Error(`Invalid date format for field '${field}': ${val}`)
      }
      return date.utc().toDate()
    }

    if (operator.in !== undefined) {
      if (!Array.isArray(operator.in) || operator.in.length === 0) {
        throw new Error(
          `Operator 'in' for '${field}' field expects a non-empty array of date strings`,
        )
      }
      return { [field]: { $in: operator.in.map(toUtcDate) } }
    }

    if (operator.nin !== undefined) {
      if (!Array.isArray(operator.nin) || operator.nin.length === 0) {
        throw new Error(
          `Operator 'nin' for '${field}' field expects a non-empty array of date strings`,
        )
      }
      return { [field]: { $nin: operator.nin.map(toUtcDate) } }
    }

    const value =
      operator.eq ?? operator.neq ?? operator.gt ?? operator.gte ?? operator.lt ?? operator.lte

    if (typeof value !== 'string') {
      throw new Error(`Invalid value for date operator on '${field}': ${JSON.stringify(operator)}`)
    }

    const utcDate = toUtcDate(value)

    if (operator.eq !== undefined) {
      return { [field]: { $eq: utcDate } }
    } else if (operator.neq !== undefined) {
      return { [field]: { $ne: utcDate } }
    } else if (operator.gt !== undefined) {
      return { [field]: { $gt: utcDate } }
    } else if (operator.gte !== undefined) {
      return { [field]: { $gte: utcDate } }
    } else if (operator.lt !== undefined) {
      return { [field]: { $lt: utcDate } }
    } else if (operator.lte !== undefined) {
      return { [field]: { $lte: utcDate } }
    } else {
      throw new Error(`Unsupported operator for '${field}' field: ${JSON.stringify(operator)}`)
    }
  }

  private _getDateQuery(
    operator: Omit<SearchTasksDTO['filters'][number], 'field'>,
    userTimezone: string,
  ): FilterQuery<any> {
    const notNullDueDate = { due_date: { $exists: true, $nin: [null, ''] } }

    const safeDateConversion = {
      $convert: {
        input: '$due_date',
        to: 'date',
        onError: null,
        onNull: null,
      },
    }

    const safeHours = { $convert: { input: '$due_hours', to: 'int', onError: 0, onNull: 0 } }
    const safeMinutes = { $convert: { input: '$due_minutes', to: 'int', onError: 0, onNull: 0 } }

    const constructedDateExpr = {
      $let: {
        vars: {
          d: safeDateConversion,
          h: safeHours,
          m: safeMinutes,
        },
        in: {
          $cond: {
            if: { $eq: ['$$d', null] },
            then: new Date(0),
            else: {
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

    const getDayInterval = (val: unknown): { startOfDay: Date; nextDayStart: Date } => {
      if (typeof val !== 'string') {
        throw new Error(`Expected date string, got ${JSON.stringify(val)}`)
      }
      const dateStr = val.split('T')[0]
      const targetDate = dayjs.tz(dateStr, userTimezone)
      if (!targetDate.isValid()) {
        throw new Error(`Invalid date: ${val}`)
      }

      return {
        startOfDay: targetDate.startOf('day').toDate(),
        nextDayStart: targetDate.add(1, 'day').startOf('day').toDate(),
      }
    }

    if (operator.in !== undefined) {
      if (!Array.isArray(operator.in) || operator.in.length === 0) {
        throw new Error(`Operator 'in' for 'due_date' expects a non-empty array of dates`)
      }

      const orConditions = operator.in.map((item) => {
        const { startOfDay, nextDayStart } = getDayInterval(item)
        return {
          $and: [
            { $gte: [constructedDateExpr, startOfDay] },
            { $lt: [constructedDateExpr, nextDayStart] },
          ],
        }
      })

      return {
        $and: [notNullDueDate, { $expr: { $or: orConditions } }],
      }
    }

    if (operator.nin !== undefined) {
      if (!Array.isArray(operator.nin) || operator.nin.length === 0) {
        throw new Error(`Operator 'nin' for 'due_date' expects a non-empty array of dates`)
      }

      const andConditions = operator.nin.map((item) => {
        const { startOfDay, nextDayStart } = getDayInterval(item)
        return {
          $or: [
            { $lt: [constructedDateExpr, startOfDay] },
            { $gte: [constructedDateExpr, nextDayStart] },
          ],
        }
      })

      return {
        $and: [notNullDueDate, { $expr: { $and: andConditions } }],
      }
    }

    const value =
      operator.eq ?? operator.neq ?? operator.gt ?? operator.gte ?? operator.lt ?? operator.lte

    if (typeof value !== 'string') {
      throw new Error(`Invalid value for date operator: ${JSON.stringify(operator)}`)
    }

    const { startOfDay, nextDayStart } = getDayInterval(value)

    if (operator.eq !== undefined) {
      return {
        $and: [
          notNullDueDate,
          {
            $expr: {
              $and: [
                { $gte: [constructedDateExpr, startOfDay] },
                { $lt: [constructedDateExpr, nextDayStart] },
              ],
            },
          },
        ],
      }
    } else if (operator.neq !== undefined) {
      return {
        $and: [
          notNullDueDate,
          {
            $expr: {
              $or: [
                { $lt: [constructedDateExpr, startOfDay] },
                { $gte: [constructedDateExpr, nextDayStart] },
              ],
            },
          },
        ],
      }
    } else if (operator.gt !== undefined) {
      return { $and: [notNullDueDate, { $expr: { $gte: [constructedDateExpr, nextDayStart] } }] }
    } else if (operator.gte !== undefined) {
      return { $and: [notNullDueDate, { $expr: { $gte: [constructedDateExpr, startOfDay] } }] }
    } else if (operator.lt !== undefined) {
      return { $and: [notNullDueDate, { $expr: { $lt: [constructedDateExpr, startOfDay] } }] }
    } else if (operator.lte !== undefined) {
      return { $and: [notNullDueDate, { $expr: { $lt: [constructedDateExpr, nextDayStart] } }] }
    } else {
      throw new Error(`Unsupported operator for 'due_date' field: ${JSON.stringify(operator)}`)
    }
  }

  private _getTimeQuery(
    operator: Omit<SearchTasksDTO['filters'][number], 'field'>,
    timezone: string,
  ): FilterQuery<any> {
    const value =
      operator.eq ?? operator.neq ?? operator.gt ?? operator.gte ?? operator.lt ?? operator.lte

    if (typeof value !== 'string') {
      throw new Error(`Invalid value for time operator: ${JSON.stringify(operator)}`)
    }

    const parsedValue = value.toString().padStart(5, '0')
    const [rawHour, rawMinute] = parsedValue.split(':')

    // ИСПРАВЛЕНИЕ: Цепочка вызовов Day.js, так как объект иммутабелен
    const dateUtc = dayjs()
      .tz(timezone)
      .hour(parseInt(rawHour, 10))
      .minute(parseInt(rawMinute, 10))
      .second(0)
      .millisecond(0)
      .utc()

    const hour = dateUtc.hour()
    const minute = dateUtc.minute()

    if (operator.eq !== undefined) {
      return {
        $and: [{ due_hours: hour }, { due_minutes: minute }],
      }
    } else if (operator.neq !== undefined) {
      return {
        $nor: [
          {
            $and: [{ due_hours: hour }, { due_minutes: minute }],
          },
        ],
      }
    } else if (operator.gt !== undefined || operator.gte !== undefined) {
      const mongoOperator = operator.gt !== undefined ? '$gt' : '$gte'

      return {
        $or: [
          { due_hours: { $gt: hour } },
          {
            $and: [{ due_hours: hour }, { due_minutes: { [mongoOperator]: minute } }],
          },
        ],
      }
    } else if (operator.lt !== undefined || operator.lte !== undefined) {
      const mongoOperator = operator.lt !== undefined ? '$lt' : '$lte'

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
        `Operator ${JSON.stringify(operator)} is not fully supported for 'due_time' field.`,
      )
    }
  }

  private _getArrayQuery(
    field: string,
    operator: Omit<SearchTasksDTO['filters'][number], 'field'>,
  ): FilterQuery<any> {
    const toArray = (val: unknown): unknown[] => (Array.isArray(val) ? val : [val])

    if (operator.eq !== undefined) {
      return { [field]: { $all: toArray(operator.eq) } }
    } else if (operator.neq !== undefined) {
      return { [field]: { $not: { $all: toArray(operator.neq) } } }
    } else if (operator.in !== undefined) {
      return { [field]: { $in: toArray(operator.in) } }
    } else if (operator.nin !== undefined) {
      return { [field]: { $nin: toArray(operator.nin) } }
    } else if (operator.cont !== undefined) {
      // ИСПРАВЛЕНИЕ: гарантируем массив для $in
      return { [field]: { $in: toArray(operator.cont) } }
    } else if (operator.contany !== undefined) {
      return { [field]: { $in: toArray(operator.contany) } }
    } else if (operator.ncontany !== undefined) {
      return { [field]: { $nin: toArray(operator.ncontany) } }
    } else {
      throw new Error(
        `Unsupported array operator for '${field}' field: ${JSON.stringify(operator)}`,
      )
    }
  }
}
