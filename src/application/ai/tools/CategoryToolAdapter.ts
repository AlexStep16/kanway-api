import { CategoryService } from '@application/services/CategoryService.ts'
import { VectorSearchService } from '@/application/services/VectorSearchService.ts'
import {
  CategoryFilterDTO,
  CategoryFilterSchema,
  CategoryCreateDTO,
  CategoryCreateSchema,
  EditCategoriesDTO,
  EditCategoriesSchema,
} from './toolSchemes.ts'
import { LangGraphRunnableConfig } from '@langchain/langgraph'
import { getFilterNameField } from '../helpers/getFilterNameField.ts'
import IToolResult from '@/application/interfaces/IToolResult.ts'
import { FailedToolResult } from './FailedToolResult.ts'
import { SuccessToolResult } from './SuccessToolResult.ts'
import { CategoryDTO } from '@/application/dtos/CategoryDTO.ts'
import { Types } from 'mongoose'
import { CategoryCommandAdapterService } from '@/application/ai/services/CategoryCommandAdapterService.ts'
import { FilterToMongoQueryService } from '@/application/ai/services/FilterToMongoQueryService.ts'
import { BoardService } from '@/application/services/BoardService.ts'
import * as Sentry from '@sentry/node'
import { Configurable } from '@application/ai/interfaces/Configurable.ts'
import { ICategoryPopulated } from '@/application/interfaces/ICategoryPopulated.ts'
import { validateInputBySchema } from '@/utils/validateInputBySchema.ts'
import { IBoardPopulated } from '@/application/interfaces/IBoardPopulated.ts'

interface CompressedCategory {
  id: string
  name: string
  boardName?: string
}

export class CategoryToolAdapter {
  private vectorSearchService: VectorSearchService
  private categoryService: CategoryService
  private categoryCommandAdapterService: CategoryCommandAdapterService
  private filterToMongoQueryService: FilterToMongoQueryService
  private boardService: BoardService

  constructor(
    vectorSearchService: VectorSearchService,
    categoryService: CategoryService,
    categoryCommandAdapterService: CategoryCommandAdapterService,
    filterToMongoQueryService: FilterToMongoQueryService,
    boardService: BoardService,
  ) {
    this.vectorSearchService = vectorSearchService
    this.categoryService = categoryService
    this.categoryCommandAdapterService = categoryCommandAdapterService
    this.categoryService = categoryService
    this.filterToMongoQueryService = filterToMongoQueryService
    this.boardService = boardService
  }

  private _compressCategories(categories: ICategoryPopulated[]): Array<CompressedCategory> {
    return categories.map((category) => ({
      id: category.id.toString(),
      name: category.name,
      boardName: category.board.name,
    }))
  }

  // [Tool 1]
  public async findCategoriesByFilter(
    dto: CategoryFilterDTO,
    config: LangGraphRunnableConfig,
  ): Promise<string> {
    const configurable = config.configurable as Configurable
    const user = configurable.user
    const timezone = configurable.timezone || 'Europe/Moscow'

    try {
      const errorMsgs = validateInputBySchema(dto, CategoryFilterSchema)

      if (errorMsgs.length > 0) {
        return (
          'Filter validation error:\n' + errorMsgs + '\nPlease correct the filter and try again.'
        )
      }

      let mongoFilter = await this.filterToMongoQueryService.prepare(
        dto,
        timezone,
        user.id,
        configurable.activeWorkspaceId,
      )

      if (Object.keys(mongoFilter).length === 0) return JSON.stringify([])

      const categories = await this.categoryService.getByFilter(
        mongoFilter,
        undefined,
        undefined,
        30,
      )

      if (categories.length === 0) {
        const categoryName = getFilterNameField(mongoFilter)

        if (categoryName) {
          // If no categories found but filter includes 'name', try semantic search as fallback
          const semanticSearchResults = await this.vectorSearchService.similaritySearchCategories(
            [categoryName],
            user.id,
            5,
          )

          const populatedSemanticResults = await this.categoryService.getByFilter({
            id: { $in: semanticSearchResults.map((cat) => cat.id) },
          })

          const compressedSemanticResults = this._compressCategories(populatedSemanticResults)

          if (semanticSearchResults.length === 0) {
            return `No categories found matching the filter or semantically similar to the name "${categoryName}".`
          }

          return (
            `No exact matches found. Here are some categories that might be relevant based on the name "${categoryName}":\n` +
            JSON.stringify(compressedSemanticResults)
          )
        }
      }

      const compressedCategories = this._compressCategories(categories)

      if (compressedCategories.length === 0) {
        return 'No categories found matching the provided filter.'
      } else if (compressedCategories.length > 20) {
        return `Found ${compressedCategories.length} categories. Please refine your filter to narrow down the results.`
      }

      return JSON.stringify(compressedCategories)
    } catch (e) {
      Sentry.captureException(e)

      return `Error retrieving categories: ${(e as Error).message}`
    }
  }

  public async findRelevantCategories(
    dto: { namesToFind: string[] },
    config: LangGraphRunnableConfig,
  ): Promise<string> {
    try {
      const { namesToFind } = dto
      const configurable = config.configurable as Configurable

      if (!namesToFind || namesToFind.length === 0) {
        return 'Category names required to find relevant categories.'
      }

      const userId = configurable.user.id

      const categories = await this.vectorSearchService.similaritySearchCategories(
        namesToFind,
        userId,
        30,
      )
      const populatedCategories = await this.categoryService.getByFilter({
        id: { $in: categories.map((cat) => cat.id) },
      })

      const compressedCategories = this._compressCategories(populatedCategories)

      if (compressedCategories.length === 0) {
        return 'No categories found matching the provided filter.'
      } else if (compressedCategories.length > 20) {
        return `Found ${compressedCategories.length} categories. Please refine your filter to narrow down the results.`
      }

      return JSON.stringify(compressedCategories)
    } catch (e) {
      Sentry.captureException(e)

      return `Error finding relevant categories: ${(e as Error).message}`
    }
  }

  public async createCategories(
    dto: CategoryCreateDTO,
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user

    try {
      const categories = dto.categories

      if (!categories || categories.length === 0) {
        return new FailedToolResult('No categories provided for creation.')
      }

      const errors: string[] = []

      const extendedCategories = await this._extendCategoryCreateDTOWithContext(
        categories,
        errors,
        user.id,
      )

      const validationSchemaMessages = validateInputBySchema(dto, CategoryCreateSchema)

      errors.push(...validationSchemaMessages)

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors in create Categories schema:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const categoriesResult = await this.categoryService.createMany(extendedCategories, user)

      if (!categoriesResult) {
        return new FailedToolResult('Categories creation failed.')
      }

      if (categoriesResult.data && categoriesResult.data.length === 0) {
        return new FailedToolResult('No categories were created.')
      } else if (!categoriesResult.data) {
        return new FailedToolResult('Categories creation failed.')
      }

      return new SuccessToolResult({
        data: categoriesResult.data.map((category) => ({ id: category.id, name: category.name })),
        logId: categoriesResult.logId,
        actions: {
          create: {
            categories: categoriesResult.data,
          },
        },
      })
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error creating categories: ${(e as Error).message}`)
    }
  }

  public async editCategories(
    dto: EditCategoriesDTO,
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user

    try {
      const boardIdValidationMessage = dto.changes.boardId
        ? await this._validateBoardId(dto.changes.boardId, user.id)
        : ''

      if (boardIdValidationMessage) {
        return new FailedToolResult(boardIdValidationMessage)
      }

      const errors: string[] = []

      const validationSchemaMessages = validateInputBySchema(dto, EditCategoriesSchema)

      errors.push(...validationSchemaMessages)

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors in edit Categories schema:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const editResult = await this.categoryCommandAdapterService.translateAndExecute(
        dto.filter.ids,
        dto.changes,
        user,
      )

      // Get only changed columns to return
      const changedColumns = Object.keys(dto.changes)

      const dataWithChangedColumns = editResult.data.map((task) => {
        const taskWithChangedColumns: any = { id: task.id, name: task.name }

        for (const column of changedColumns) {
          taskWithChangedColumns[column] = (task as any)[column]
        }

        return taskWithChangedColumns
      })

      return new SuccessToolResult({
        data: dataWithChangedColumns,
        logId: editResult.logId,
        actions: {
          edit: {
            categories: editResult.data,
          },
        },
      })
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error editing categories: ${(e as Error).message}`)
    }
  }

  public async archiveCategories(
    dto: { ids: string[] },
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user
    const ids = dto.ids

    try {
      if (!ids || ids.length === 0) {
        return new FailedToolResult('No categories provided for archiving.')
      }

      const errors: string[] = []

      for (const id of ids) {
        if (!Types.ObjectId.isValid(id)) {
          errors.push(`Invalid Id: ${id}`)
        }
      }

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors while archiving categories:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const archiveResult = await this.categoryService.archive({ ids }, user)

      if (!archiveResult) {
        return new FailedToolResult('Categories archiving failed.')
      }

      if (archiveResult.data && archiveResult.data.length === 0) {
        return new FailedToolResult('No categories were archived.')
      } else if (!archiveResult.data) {
        return new FailedToolResult('Categories archiving failed.')
      }

      return new SuccessToolResult({
        data: archiveResult.data.map((category) => category.id),
        logId: archiveResult.logId,
        actions: {
          archive: {
            categories: archiveResult.data,
          },
        },
      })
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error archiving categories: ${(e as Error).message}`)
    }
  }

  public async cloneCategories(
    dto: { ids: string[] },
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user
    const ids = dto.ids

    try {
      if (!ids || ids.length === 0) {
        return new FailedToolResult('No categories provided for cloning.')
      }

      const errors: string[] = []

      for (const id of ids) {
        if (!Types.ObjectId.isValid(id)) {
          errors.push(`Invalid Id: ${id}`)
        }
      }

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors while cloning categories:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const cloneResult = await this.categoryService.clone({ ids }, user)

      if (!cloneResult) {
        return new FailedToolResult('Categories cloning failed.')
      }

      if (cloneResult.data && cloneResult.data.length === 0) {
        return new FailedToolResult('No categories were cloned.')
      } else if (!cloneResult.data) {
        return new FailedToolResult('Categories cloning failed.')
      }

      return new SuccessToolResult({
        data: cloneResult.data.map((category) => category.id),
        logId: cloneResult.logId,
        actions: {
          clone: {
            categories: cloneResult.data,
          },
        },
      })
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error cloning categories: ${(e as Error).message}`)
    }
  }

  public async deleteCategories(
    dto: { ids: string[] },
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user
    const ids = dto.ids

    try {
      if (!ids || ids.length === 0) {
        return new FailedToolResult('No categories provided for deletion.')
      }

      const errors: string[] = []

      for (const id of ids) {
        if (!Types.ObjectId.isValid(id)) {
          errors.push(`Invalid Id: ${id}`)
        }
      }

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors while deleting categories:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const categoriesToDelete = await this.categoryService.getByCriteria({ ids }, user.id)

      await this.categoryService.delete({ ids }, user)

      return new SuccessToolResult({
        data: categoriesToDelete.map((category) => category.id),
        actions: {
          delete: {
            categories: categoriesToDelete,
          },
        },
      })
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error deleting categories: ${(e as Error).message}`)
    }
  }

  public async recoverCategories(
    dto: { ids: string[] },
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user
    const ids = dto.ids

    try {
      if (!ids || ids.length === 0) {
        return new FailedToolResult('No categories provided for recovering.')
      }

      const errors: string[] = []

      for (const id of ids) {
        if (!Types.ObjectId.isValid(id)) {
          errors.push(`Invalid Id: ${id}`)
        }
      }

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors while recovering categories:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const recoverResult = await this.categoryService.recover({ ids }, user)

      if (!recoverResult) {
        return new FailedToolResult('Categories recovering failed.')
      }

      if (recoverResult.data && recoverResult.data.length === 0) {
        return new FailedToolResult('No categories were recovered.')
      } else if (!recoverResult.data) {
        return new FailedToolResult('Categories recovering failed.')
      }

      return new SuccessToolResult({
        data: recoverResult.data.map((category) => category.id),
        logId: recoverResult.logId,
        actions: {
          recover: {
            categories: recoverResult.data,
          },
        },
      })
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error recovering categories: ${(e as Error).message}`)
    }
  }

  private async _extendCategoryCreateDTOWithContext(
    categories: CategoryCreateDTO['categories'],
    errors: string[],
    userId: Types.ObjectId,
  ): Promise<CategoryDTO[]> {
    const extendedCategories: CategoryDTO[] = []

    const boardIdsSet = new Set<string>()

    for (const category of categories) {
      boardIdsSet.add(category.boardId)
    }

    const boardIds = Array.from(boardIdsSet)

    const existingBoards = await this.boardService.getByCriteria({ ids: boardIds }, userId)

    const existingBoardsMap = new Map<string, IBoardPopulated>()

    for (const board of existingBoards) {
      existingBoardsMap.set(board.id.toString(), board)
    }

    for (const category of categories) {
      const board = existingBoardsMap.get(category.boardId)

      if (!board) {
        errors.push(`Board with ID ${category.boardId} not found.`)

        continue
      }

      const categoryExtended: CategoryDTO = {
        ...category,
        boardId: category.boardId,
        workspaceId: board.workspace.id.toString(),
      }

      extendedCategories.push(categoryExtended)
    }

    return extendedCategories
  }

  private async _validateBoardId(boardId: string, userId: Types.ObjectId): Promise<string> {
    const boards = await this.categoryService.getByCriteria({ id: boardId }, userId)
    const board = boards[0]

    if (!board) {
      return `Board with ID ${boardId} not found.`
    }

    return ''
  }
}
