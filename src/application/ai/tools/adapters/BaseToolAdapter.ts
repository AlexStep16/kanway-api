import IToolResult from '@/application/interfaces/IToolResult.ts'
import { BoardService } from '@/application/services/BoardService.ts'
import { CategoryService } from '@/application/services/CategoryService.ts'
import { OperationLogService } from '@/application/services/OperationLogService.ts'
import { TaskService } from '@/application/services/TaskService.ts'
import { WorkspaceService } from '@/application/services/WorkspaceService.ts'
import { VectorSearchService } from '@/application/services/VectorSearchService.ts'
import { LangGraphRunnableConfig } from 'node_modules/@langchain/langgraph/dist/pregel/runnable_types.js'
import { FailedToolResult } from '@application/ai/tools/FailedToolResult.ts'
import { SuccessToolResult } from '@application/ai/tools/SuccessToolResult.ts'
import { Configurable } from '../../interfaces/Configurable.ts'
import { SearchEntitiesDTO, SearchEntitiesSchema } from '../schemes/search/searchEntitiesSchema.ts'
import { validateInputByScheme } from '@/utils/validateInputByScheme.ts'
import { FilterToMongoQueryService } from '../../services/FilterToMongoQueryService.ts'
import { getFilterNameField } from '../../helpers/getFilterNameField.ts'
import { getCompressedTasks } from '@/utils/getCompressedTasks.ts'
import { getCompressedWorkspaces } from '@/utils/getCompressedWorkspaces.ts'
import { getCompressedBoards } from '@/utils/getCompressedBoards.ts'
import { getCompressedCategories } from '@/utils/getCompressedCategories.ts'
import * as Sentry from '@sentry/node'
import { OperatorDTO } from '../schemes/baseSchemes.ts'
import { Types } from 'mongoose'
import { IUser } from '@/domain/entities/IUser.ts'

export class BaseToolAdapter {
  protected vectorSearchService: VectorSearchService
  protected operationLogService: OperationLogService
  protected filterToMongoQueryService: FilterToMongoQueryService
  protected taskService: TaskService
  protected categoryService: CategoryService
  protected boardService: BoardService
  protected workspaceService: WorkspaceService

  constructor(
    vectorSearchService: VectorSearchService,
    operationLogService: OperationLogService,
    taskService: TaskService,
    categoryService: CategoryService,
    boardService: BoardService,
    workspaceService: WorkspaceService,
    filterToMongoQueryService: FilterToMongoQueryService,
  ) {
    this.vectorSearchService = vectorSearchService
    this.operationLogService = operationLogService
    this.taskService = taskService
    this.categoryService = categoryService
    this.boardService = boardService
    this.workspaceService = workspaceService
    this.filterToMongoQueryService = filterToMongoQueryService
  }

  private _validateTextField(operator: OperatorDTO, value: any): string | null {
    if (operator === 'eq' || operator === 'neq') {
      if (typeof value !== 'string') {
        return `Operator "${operator}" requires a string value.`
      }
    } else if (operator === 'in' || operator === 'nin') {
      if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) {
        return `Operator "${operator}" requires an array of strings.`
      }
    } else if (operator === 'cont' || operator === 'notcont') {
      if (typeof value !== 'string') {
        return `Operator "${operator}" requires a string value.`
      }
    } else {
      return `Unsupported operator "${operator}" for text fields.`
    }

    return null
  }

  private _validateDateTimeField(operator: OperatorDTO, value: any): string | null {
    if (operator === 'eq' || operator === 'neq' || operator === 'gt' || operator === 'lt') {
      if (typeof value !== 'string' || isNaN(Date.parse(value))) {
        return `Operator "${operator}" requires a valid date string.`
      }
    } else {
      return `Unsupported operator "${operator}" for date fields.`
    }

    return null
  }

  private _validateArrayField(operator: OperatorDTO, value: any): string | null {
    if (
      operator === 'eq' ||
      operator === 'neq' ||
      operator === 'in' ||
      operator === 'nin' ||
      operator === 'contany'
    ) {
      if (!Array.isArray(value)) {
        return `Operator "${operator}" requires an array.`
      }
    } else if (operator === 'cont') {
      if (typeof value !== 'string' && !Array.isArray(value)) {
        return `Operator "${operator}" requires a string or array value.`
      }
    }

    return null
  }

  private _validateColorField(operator: OperatorDTO, value: any): string | null {
    if (operator === 'eq' || operator === 'neq') {
      if (typeof value !== 'object') {
        return `Operator "${operator}" requires an object with color and optional tone.`
      } else if (typeof value.color !== 'string') {
        return `Color field must have a "color" string property.`
      } else if (value.tone && typeof value.tone !== 'string') {
        return `Tone property, if provided, must be a string.`
      }
    }

    return null
  }

  private _validateNumberField(operator: OperatorDTO, value: any): string | null {
    if (operator === 'eq' || operator === 'neq' || operator === 'gt' || operator === 'lt') {
      if (typeof value !== 'number') {
        return `Operator "${operator}" requires a number value.`
      }
    } else if (operator === 'in' || operator === 'nin') {
      if (!Array.isArray(value) || !value.every((v) => typeof v === 'number')) {
        return `Operator "${operator}" requires an array of numbers.`
      }
    } else {
      return `Unsupported operator "${operator}" for number fields.`
    }

    return null
  }

  private _validateIdField(operator: OperatorDTO, value: any): string | null {
    if (operator === 'eq' || operator === 'neq') {
      if (typeof value !== 'string' || !Types.ObjectId.isValid(value)) {
        return `Operator "${operator}" requires a valid ObjectId string.`
      }
    } else if (operator === 'in' || operator === 'nin') {
      if (
        !Array.isArray(value) ||
        !value.every((v) => typeof v === 'string' && Types.ObjectId.isValid(v))
      ) {
        return `Operator "${operator}" requires an array of valid ObjectId strings.`
      }
    } else {
      return `Unsupported operator "${operator}" for ID fields.`
    }

    return null
  }

  private validateSearchValues(dto: SearchEntitiesDTO): string[] {
    const errorMessages: string[] = []

    for (const filter of dto.filters) {
      const { field, operator, value } = filter

      if (field === 'name' || field === 'description') {
        const errorMsg = this._validateTextField(operator, value)

        if (errorMsg) {
          errorMessages.push(`Field "${field}": ${errorMsg}`)
        }
      }

      if (field === 'dueDate') {
        const errorMsg = this._validateDateTimeField(operator, value)

        if (errorMsg) {
          errorMessages.push(`Field "${field}": ${errorMsg}`)
        }
      }

      if (field === 'dueTime') {
        const errorMsg = this._validateDateTimeField(operator, value)

        if (errorMsg) {
          errorMessages.push(`Field "${field}": ${errorMsg}`)
        }
      }

      if (field === 'tags') {
        const errorMsg = this._validateArrayField(operator, value)

        if (errorMsg) {
          errorMessages.push(`Field "${field}": ${errorMsg}`)
        }
      }

      if (field === 'color') {
        const errorMsg = this._validateColorField(operator, value)

        if (errorMsg) {
          errorMessages.push(`Field "${field}": ${errorMsg}`)
        }
      }

      if (
        field === 'tasksCount' ||
        field === 'categoriesCount' ||
        field === 'boardsCount' ||
        field === 'order'
      ) {
        const errorMsg = this._validateNumberField(operator, value)

        if (errorMsg) {
          errorMessages.push(`Field "${field}": ${errorMsg}`)
        }
      }

      if (
        field === 'id' ||
        field === 'categoryId' ||
        field === 'boardId' ||
        field === 'workspaceId'
      ) {
        const errorMsg = this._validateIdField(operator, value)

        if (errorMsg) {
          errorMessages.push(`Field "${field}": ${errorMsg}`)
        }
      }

      if (field === 'isFavorite' || field === 'isCompleted' || field === 'isArchived') {
        if (operator === 'eq' || operator === 'neq') {
          if (typeof value !== 'boolean') {
            errorMessages.push(`Field "${field}": Operator "${operator}" requires a boolean value.`)
          }
        } else {
          errorMessages.push(
            `Field "${field}": Unsupported operator "${operator}" for boolean fields.`,
          )
        }
      }
    }

    return errorMessages
  }

  public async searchEntities(dto: SearchEntitiesDTO, config: LangGraphRunnableConfig) {
    const type = dto.entity_type

    const configurable = config.configurable as Configurable
    const user = configurable.user
    const timezone = configurable.timezone || 'Europe/Moscow'

    let service: TaskService | CategoryService | BoardService | WorkspaceService = this.taskService
    let compresser: any = getCompressedTasks
    let similaritySearchFunction: any = this.vectorSearchService.similaritySearchTasks.bind(
      this.vectorSearchService,
    )

    try {
      switch (type) {
        case 'category':
          service = this.categoryService
          compresser = getCompressedCategories
          similaritySearchFunction = this.vectorSearchService.similaritySearchCategories.bind(
            this.vectorSearchService,
          )
          break
        case 'board':
          service = this.boardService
          compresser = getCompressedBoards
          similaritySearchFunction = this.vectorSearchService.similaritySearchBoards.bind(
            this.vectorSearchService,
          )
          break
        case 'workspace':
          service = this.workspaceService
          compresser = getCompressedWorkspaces
          similaritySearchFunction = this.vectorSearchService.similaritySearchWorkspaces.bind(
            this.vectorSearchService,
          )
          break
      }

      const errorMsgs = validateInputByScheme(dto, SearchEntitiesSchema)

      if (errorMsgs.length > 0) {
        return (
          'Filter validation error:\n' + errorMsgs + '\nPlease correct the filter and try again.'
        )
      }

      const validationErrorMsgs = this.validateSearchValues(dto)

      if (validationErrorMsgs.length > 0) {
        return (
          'Filter validation error:\n' +
          validationErrorMsgs.join('\n') +
          '\nPlease correct the filter and try again.'
        )
      }

      const mongoFilter = this.filterToMongoQueryService.prepare(dto, timezone, user.id)

      if (Object.keys(mongoFilter).length === 0) return JSON.stringify([])

      const entities = await service.getByFilter(mongoFilter, undefined, undefined, 30)

      if (entities.length === 0) {
        const entityName = getFilterNameField(mongoFilter)

        if (entityName) {
          const semanticSearchResults = await similaritySearchFunction([entityName], user.id, 5)
          const populatedSemanticResults = await service.getByCriteria({
            ids: semanticSearchResults.map((e: any) => e.id.toString()),
          })

          const compressedSemanticResults = compresser(populatedSemanticResults)

          if (semanticSearchResults.length === 0) {
            return `No ${type} found matching the filter or semantically similar to the name "${entityName}".`
          }

          return (
            `No exact matches found. Here are some ${type} that might be relevant based on the name "${entityName}":\n` +
            JSON.stringify(compressedSemanticResults)
          )
        }
      }

      const compressedEntities = compresser(entities)

      if (compressedEntities.length === 0) {
        return `No ${type} found matching the provided filter.`
      } else if (compressedEntities.length > 20) {
        return `Found ${compressedEntities.length} ${type}. Please refine your filter to narrow down the results.`
      }

      return JSON.stringify(compressedEntities)
    } catch (e) {
      Sentry.captureException(e)

      return `Error retrieving ${type}: ${(e as Error).message}`
    }
  }

  public async showEntitiesToUser(
    dto: {
      ids: string[]
      type: 'task' | 'category' | 'board' | 'workspace'
    },
    config: LangGraphRunnableConfig,
  ) {
    const { ids, type } = dto
    const configurable = config.configurable as Configurable
    const userId = configurable.user.id

    if (!Array.isArray(ids) || ids.length === 0) {
      return 'Invalid IDs.'
    }
    if (!['task', 'category', 'board', 'workspace'].includes(type)) {
      return 'Invalid type.'
    }

    let entities: any[] = []

    switch (type) {
      case 'task':
        entities = await this.taskService.getByCriteria({ ids }, userId)
        break
      case 'category':
        entities = await this.categoryService.getByCriteria({ ids }, userId)
        break
      case 'board':
        entities = await this.boardService.getByCriteria({ ids }, userId)
        break
      case 'workspace':
        entities = await this.workspaceService.getByCriteria({ ids }, userId)
        break
    }

    return entities
  }

  public async undoOperations(
    dto: { operationIds: string[] },
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const operationIds = dto.operationIds
    const user = config.configurable?.user

    if (!Array.isArray(operationIds) || operationIds.length === 0) {
      return new FailedToolResult('Invalid operation IDs.')
    }

    const result = await this.operationLogService.undoOperations(operationIds, user)

    return new SuccessToolResult({
      undo: result,
    })
  }

  protected async _resolveWorkspaceByName(
    entityType: string,
    configurable: Configurable,
    errors: string[],
    user: IUser,
    name?: string,
  ) {
    let workspaceId: string = configurable.activeWorkspaceId

    if (name) {
      const similarWorkspaces = await this.vectorSearchService.similaritySearchWorkspaces(
        [name],
        user.id,
        5,
        true,
      )

      if (similarWorkspaces.length > 1) {
        errors.push(
          `${entityType} "${name}": Multiple workspaces found:\n ${similarWorkspaces
            .map((w) => `- ${w.name} (ID: ${w.id})`)
            .join('\n')}. Please select one.`,
        )

        return null
      } else if (similarWorkspaces.length === 1) {
        workspaceId = similarWorkspaces[0].id.toString()
      } else {
        errors.push(`${entityType} "${name}": No workspace found with name "${name}".`)

        return null
      }
    }

    return workspaceId
  }

  protected async _resolveBoardByName(
    entityType: string,
    workspaceId: string,
    configurable: Configurable,
    errors: string[],
    user: IUser,
    name?: string,
  ) {
    let boardId: string | undefined = configurable.activeBoardId

    if (name) {
      const similarBoards = await this.vectorSearchService.similaritySearchBoards(
        [name],
        user.id,
        5,
        [new Types.ObjectId(workspaceId)],
        true,
      )

      if (similarBoards.length > 1) {
        errors.push(
          `${entityType} "${name}": Multiple boards found:\n ${similarBoards.map((c) => `- ${c.name} (ID: ${c.id})`).join('\n')}. Please select one.`,
        )

        return null
      } else if (similarBoards.length === 1) {
        boardId = similarBoards[0].id.toString()
      } else {
        const createBoardResult = await this.boardService.create(
          {
            name,
            workspaceId: workspaceId.toString(),
          },
          user,
        )

        if (createBoardResult.data) {
          boardId = createBoardResult.data[0].id.toString()
        }
      }
    } else if (!boardId) {
      const createBoardResult = await this.boardService.create(
        {
          name: configurable.defaultBoardName,
          workspaceId,
        },
        user,
      )

      if (createBoardResult.data) {
        boardId = createBoardResult.data[0].id.toString()
      }
    }

    return boardId!
  }

  protected async _resolveCategoryByName(
    entityType: string,
    workspaceId: string,
    boardId: string,
    configurable: Configurable,
    errors: string[],
    user: IUser,
    name?: string,
  ) {
    let categoryId: string | null = null

    if (name) {
      const similarCategories = await this.vectorSearchService.similaritySearchCategories(
        [name],
        user.id,
        5,
        [new Types.ObjectId(boardId)],
        true,
      )

      if (similarCategories.length > 1) {
        errors.push(
          `${entityType} "${name}": Multiple categories found:\n ${similarCategories.map((c) => `- ${c.name} (ID: ${c.id})`).join('\n')}. Please select one.`,
        )

        return null
      } else if (similarCategories.length === 1) {
        categoryId = similarCategories[0].id.toString()
      } else {
        const createCategoryResult = await this.categoryService.create(
          {
            name,
            boardId: boardId!.toString(),
            workspaceId: workspaceId.toString(),
          },
          user,
        )
        if (createCategoryResult.data) {
          categoryId = createCategoryResult.data[0].id.toString()
        }
      }
    } else {
      const defaultCategories = await this.categoryService.getByCriteria(
        {
          name: configurable.defaultCategoryName.trim(),
          boardId: boardId!,
          isDeleted: false,
        },
        user.id,
      )

      if (defaultCategories.length === 0) {
        const createCategoryResult = await this.categoryService.create(
          {
            name: configurable.defaultCategoryName,
            boardId: boardId!,
            workspaceId: workspaceId,
          },
          user,
        )

        if (createCategoryResult.data) {
          categoryId = createCategoryResult.data[0].id.toString()
        }
      } else if (defaultCategories.length > 0) {
        categoryId = defaultCategories[0].id.toString()
      }
    }

    return categoryId!
  }
}
