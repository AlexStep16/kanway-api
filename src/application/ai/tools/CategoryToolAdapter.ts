import { CategoryService } from '@application/services/CategoryService.ts'
import { BaseToolAdapter } from '@application/ai/tools/BaseToolAdapter.ts'
import { BaseService } from '@application/services/BaseService.ts'
import {
  ConditionalCategoryFilterDTO,
  ConditionalCategoryFilterSchema,
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
import { IUser } from '@/domain/entities/IUser.ts'
import { CategoryCommandAdapterService } from '@/application/ai/services/CategoryCommandAdapterService.ts'
import { FilterToMongoQueryService } from '@/application/ai/services/FilterToMongoQueryService.ts'
import { BoardService } from '@/application/services/BoardService.ts'
import { IUndoResponse } from '@/application/interfaces/IUndoResponse.ts'
import { ICategoriesWithChildrenResponse } from '@/application/interfaces/ICategoriesWithChildrenResponse.ts'
import { ICategory } from '@/domain/entities/ICategory.ts'

export class CategoryToolAdapter extends BaseToolAdapter {
  private categoryService: CategoryService
  private categoryCommandAdapterService: CategoryCommandAdapterService
  private filterToMongoQueryService: FilterToMongoQueryService
  private boardService: BoardService

  constructor(
    baseService: BaseService,
    categoryService: CategoryService,
    categoryCommandAdapterService: CategoryCommandAdapterService,
    filterToMongoQueryService: FilterToMongoQueryService,
    boardService: BoardService
  ) {
    super(baseService)

    this.categoryService = categoryService
    this.categoryCommandAdapterService = categoryCommandAdapterService
    this.categoryService = categoryService
    this.filterToMongoQueryService = filterToMongoQueryService
    this.boardService = boardService
  }

  // [Tool 1]
  public async findCategoriesByFilter(
    dto: ConditionalCategoryFilterDTO,
    config: LangGraphRunnableConfig
  ): Promise<string> {
    const user = config.configurable?.user as IUser
    const timezone = config.configurable?.timezone || 'Europe/Moscow'

    try {
      const errorMsgs = this.baseService.validateInputBySchema(dto, ConditionalCategoryFilterSchema)

      if (errorMsgs.length > 0) {
        return (
          'Filter validation error:\n' + errorMsgs + '\nPlease correct the filter and try again.'
        )
      }

      let mongoFilter = await this.filterToMongoQueryService.prepare(dto, timezone, user.id)

      if (Object.keys(mongoFilter).length === 0) return JSON.stringify([])

      const categories = await this.categoryService.getByFilter(mongoFilter, user.id, 30)

      if (categories.length === 0) {
        const categoryName = getFilterNameField(mongoFilter)

        if (categoryName) {
          // If no categories found but filter includes 'name', try semantic search as fallback
          console.log(user)
          const semanticSearchResults = await this.baseService.similaritySearchCategories(
            categoryName,
            user.id,
            2
          )

          if (semanticSearchResults.length === 0) {
            return `No categories found matching the filter or semantically similar to the name "${categoryName}".`
          }

          return (
            `No exact matches found. Here are some categories that might be relevant based on the name "${categoryName}":\n` +
            JSON.stringify(semanticSearchResults)
          )
        }
      }

      return JSON.stringify(categories)
    } catch (e) {
      return `Error retrieving categories: ${(e as Error).message}`
    }
  }

  public async findRelevantCategories(
    findRelevantDto: { nameToFind: string },
    config: LangGraphRunnableConfig
  ): Promise<string> {
    try {
      const { nameToFind } = findRelevantDto

      if (!nameToFind) {
        return 'Category name required to find relevant categories.'
      }

      const userId = config.configurable?.user?.id

      const categories = await this.baseService.similaritySearchCategories(nameToFind, userId, 20)

      return JSON.stringify(
        categories.map((category) => ({
          id: category.id.toString(),
          name: category.name,
        }))
      )
    } catch (e) {
      return `Error finding relevant categories: ${(e as Error).message}`
    }
  }

  public async createCategories(
    dto: CategoryCreateDTO,
    config: LangGraphRunnableConfig
  ): Promise<IToolResult> {
    const user = config.configurable?.user as IUser
    const threadId = config.configurable?.thread_id as string | undefined

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
        threadId
      )

      const validationSchemaMessages = this.baseService.validateInputBySchema(
        dto,
        CategoryCreateSchema
      )

      errors.push(...validationSchemaMessages)

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors in create Categories schema:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.'
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

      const integration: IUndoResponse<ICategoriesWithChildrenResponse> = {
        create: {
          categories: categoriesResult.data,
          tasks: [],
        },
      }

      const dataWithIntegration = {
        ...categoriesResult,
        integration,
      }

      return new SuccessToolResult(dataWithIntegration)
    } catch (e) {
      return new FailedToolResult(`Error creating categories: ${(e as Error).message}`)
    }
  }

  public async editCategories(
    dto: EditCategoriesDTO,
    config: LangGraphRunnableConfig
  ): Promise<IToolResult> {
    const user = config.configurable?.user as IUser
    const threadId = config.configurable?.thread_id as string | undefined

    try {
      const boardIdValidationMessage = dto.changes.boardId
        ? await this._validateBoardId(dto.changes.boardId, user.id)
        : ''

      if (boardIdValidationMessage) {
        return new FailedToolResult(boardIdValidationMessage)
      }

      const errors: string[] = []

      const validationSchemaMessages = this.baseService.validateInputBySchema(
        dto,
        EditCategoriesSchema
      )

      errors.push(...validationSchemaMessages)

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors in edit Categories schema:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.'
        )
      }

      const editResult = await this.categoryCommandAdapterService.translateAndExecute(
        dto.filter.ids,
        dto.changes,
        user,
        undefined,
        threadId
      )

      const integration: IUndoResponse<ICategoriesWithChildrenResponse> = {
        update: {
          categories: editResult.data,
          tasks: [],
        },
      }

      const dataWithIntegration = {
        ...editResult,
        integration,
      }

      return new SuccessToolResult(dataWithIntegration)
    } catch (e) {
      return new FailedToolResult(`Error editing categories: ${(e as Error).message}`)
    }
  }

  public async archiveCategories(
    dto: { ids: string[] },
    config: LangGraphRunnableConfig
  ): Promise<IToolResult> {
    const user = config.configurable?.user as IUser
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
            '\nPlease correct it and try again.'
        )
      }

      const archiveResult = await this.categoryService.archive({ ids }, user)

      if (!archiveResult) {
        return new FailedToolResult('Categories archiving failed.')
      }

      if (
        archiveResult.data &&
        archiveResult.data.categories &&
        archiveResult.data.categories.length === 0
      ) {
        return new FailedToolResult('No categories were archived.')
      } else if (!archiveResult.data) {
        return new FailedToolResult('Categories archiving failed.')
      }

      const integration: IUndoResponse<ICategoriesWithChildrenResponse> = {
        update: {
          categories: archiveResult.data.categories,
          tasks: archiveResult.data.tasks,
        },
      }

      const dataWithIntegration = {
        ...archiveResult,
        integration,
      }

      return new SuccessToolResult(dataWithIntegration)
    } catch (e) {
      return new FailedToolResult(`Error archiving categories: ${(e as Error).message}`)
    }
  }

  public async deleteCategories(
    dto: { ids: string[] },
    config: LangGraphRunnableConfig
  ): Promise<IToolResult> {
    const user = config.configurable?.user as IUser
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
            '\nPlease correct it and try again.'
        )
      }

      const deleteResult = await this.categoryService.delete({ ids }, user)

      if (!deleteResult) {
        return new FailedToolResult('Categories deletion failed.')
      }

      const deletedIds: unknown = ids.map((id) => ({ id }))

      const integration: IUndoResponse<ICategoriesWithChildrenResponse> = {
        update: {
          categories: deleteResult,
          tasks: [],
        },
        delete: {
          categories: deletedIds as ICategory[],
          tasks: [],
        },
      }

      const dataWithIntegration = {
        result: deleteResult,
        integration,
      }

      return new SuccessToolResult(dataWithIntegration)
    } catch (e) {
      return new FailedToolResult(`Error deleting categories: ${(e as Error).message}`)
    }
  }

  public async recoverCategories(
    dto: { ids: string[] },
    config: LangGraphRunnableConfig
  ): Promise<IToolResult> {
    const user = config.configurable?.user as IUser
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
            '\nPlease correct it and try again.'
        )
      }

      const recoverResult = await this.categoryService.recover({ ids }, user)

      if (!recoverResult) {
        return new FailedToolResult('Categories recovering failed.')
      }

      if (
        recoverResult.data &&
        recoverResult.data.categories &&
        recoverResult.data.categories.length === 0
      ) {
        return new FailedToolResult('No categories were recovered.')
      } else if (!recoverResult.data) {
        return new FailedToolResult('Categories recovering failed.')
      }

      const integration: IUndoResponse<ICategoriesWithChildrenResponse> = {
        update: {
          categories: recoverResult.data.categories,
          tasks: recoverResult.data.tasks,
        },
      }

      const dataWithIntegration = {
        ...recoverResult,
        integration,
      }

      return new SuccessToolResult(dataWithIntegration)
    } catch (e) {
      return new FailedToolResult(`Error recovering categories: ${(e as Error).message}`)
    }
  }

  private async _extendCategoryCreateDTOWithContext(
    categories: CategoryCreateDTO['categories'],
    errors: string[],
    userId: Types.ObjectId,
    threadId?: string
  ): Promise<CategoryDTO[]> {
    const extendedCategories: CategoryDTO[] = []

    for (const category of categories) {
      const board = await this.boardService.getById(category.boardId, userId)

      if (!board) {
        errors.push(`Board with ID ${category.boardId} not found.`)

        continue
      }

      const categoryExtended: CategoryDTO = {
        ...category,
        boardId: category.boardId.toString(),
        boardName: board.name,
        workspaceId: board.workspaceId.toString(),
        workspaceName: board.workspaceName,
      }

      if (threadId) {
        categoryExtended.threadId = threadId
      }

      extendedCategories.push(categoryExtended)
    }

    return extendedCategories
  }

  private async _validateBoardId(boardId: string, userId: Types.ObjectId): Promise<string> {
    const board = await this.categoryService.getById(boardId, userId)

    if (!board) {
      return `Board with ID ${boardId} not found.`
    }

    return ''
  }
}
