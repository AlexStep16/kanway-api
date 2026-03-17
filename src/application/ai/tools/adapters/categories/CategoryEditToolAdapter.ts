import { CategoryService } from '@application/services/CategoryService.ts'
import { LangGraphRunnableConfig } from '@langchain/langgraph'
import IToolResult from '@/application/interfaces/IToolResult.ts'
import { FailedToolResult } from '../../FailedToolResult.ts'
import { SuccessToolResult } from '../../SuccessToolResult.ts'
import { CategoryCommandAdapterService } from '@/application/ai/services/CategoryCommandAdapterService.ts'
import { ICategory } from '@/domain/entities/ICategory.ts'
import * as Sentry from '@sentry/node'
import { Configurable } from '@application/ai/interfaces/Configurable.ts'
import { ICategoryPopulated } from '@/application/interfaces/ICategoryPopulated.ts'
import { validateInputByScheme } from '@/utils/validateInputByScheme.ts'
import {
  EditCategoriesNameDTO,
  EditCategoriesNameSchema,
  EditCategoriesOrderDTO,
  EditCategoriesOrderSchema,
  MoveCategoriesDTO,
  MoveCategoriesSchema,
} from '../../schemes/update/categoryEditSchemes.ts'
import { BoardService } from '@/application/services/BoardService.ts'

export class CategoryEditToolAdapter {
  private categoryService: CategoryService
  private boardService: BoardService
  private categoryCommandAdapterService: CategoryCommandAdapterService

  constructor(
    categoryService: CategoryService,
    boardService: BoardService,
    categoryCommandAdapterService: CategoryCommandAdapterService,
  ) {
    this.categoryService = categoryService
    this.boardService = boardService
    this.categoryCommandAdapterService = categoryCommandAdapterService
  }

  public async updateCategoriesName(
    dto: EditCategoriesNameDTO,
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user

    try {
      const validationSchemaMessages = validateInputByScheme(dto, EditCategoriesNameSchema)

      if (validationSchemaMessages.length > 0) {
        return new FailedToolResult(
          'There are some errors in edit Categories name schema:\n' +
            validationSchemaMessages.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const editResult = await this.categoryCommandAdapterService.translateEditStringAndExecute(
        dto.filter.ids,
        dto.name,
        'name',
        user,
      )

      const dataWithChangedColumns = editResult.data.map((category) => {
        const categoryWithChangedColumns: Partial<ICategory> = {
          id: category.id,
          name: category.name,
        }

        return categoryWithChangedColumns
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

      return new FailedToolResult(`Error editing categories name: ${(e as Error).message}`)
    }
  }

  public async moveCategories(
    dto: MoveCategoriesDTO,
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user

    try {
      const validationSchemaMessages = validateInputByScheme(dto, MoveCategoriesSchema)

      if (validationSchemaMessages.length > 0) {
        return new FailedToolResult(
          'There are some errors in move Categories schema:\n' +
            validationSchemaMessages.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const boardCount = await this.boardService.getCount({ id: dto.boardId }, user.id)

      if (boardCount === 0) {
        return new FailedToolResult(`Board with ID ${dto.boardId} not found.`)
      }

      const editResult = await this.categoryCommandAdapterService.translateEditBoardAndExecute(
        dto.filter.ids,
        dto.boardId,
        user,
      )

      const dataWithChangedColumns = editResult.data.map((category) => {
        const categoryWithChangedColumns: Partial<ICategoryPopulated> = {
          id: category.id,
          board: category.board,
        }

        return categoryWithChangedColumns
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

      return new FailedToolResult(`Error moving categories: ${(e as Error).message}`)
    }
  }

  public async updateCategoriesOrder(
    dto: EditCategoriesOrderDTO,
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user

    try {
      const validationSchemaMessages = validateInputByScheme(dto, EditCategoriesOrderSchema)

      if (validationSchemaMessages.length > 0) {
        return new FailedToolResult(
          'There are some errors in edit Categories order schema:\n' +
            validationSchemaMessages.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const editResult = await this.categoryService.edit(
        {
          order: parseInt(dto.order as any, 10),
        },
        {
          ids: dto.filter.ids,
        },
        user,
      )

      const dataWithChangedColumns = editResult.data.map((category) => {
        const categoryWithChangedColumns: Partial<ICategory> = {
          id: category.id,
          order: category.order,
        }

        return categoryWithChangedColumns
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

      return new FailedToolResult(`Error updating categories order: ${(e as Error).message}`)
    }
  }
}
