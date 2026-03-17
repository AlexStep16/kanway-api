import { LangGraphRunnableConfig } from '@langchain/langgraph'
import IToolResult from '@/application/interfaces/IToolResult.ts'
import { CategoryDTO } from '@/application/dtos/CategoryDTO.ts'
import { Types } from 'mongoose'
import * as Sentry from '@sentry/node'
import { Configurable } from '@application/ai/interfaces/Configurable.ts'
import { validateInputByScheme } from '@/utils/validateInputByScheme.ts'
import { FailedToolResult } from '../../FailedToolResult.ts'
import { SuccessToolResult } from '../../SuccessToolResult.ts'
import {
  CategoryCreateDTO,
  CategoryCreateSchema,
} from '../../schemes/create/categoryCreateSchema.ts'
import { getCompressedCategories } from '@/utils/getCompressedCategories.ts'
import { IUser } from '@/domain/entities/IUser.ts'
import { BaseToolAdapter } from '../BaseToolAdapter.ts'

export class CategoryBaseToolAdapter extends BaseToolAdapter {
  public async searchRelevantCategories(
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

      const compressedCategories = getCompressedCategories(populatedCategories)

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
        user,
        configurable,
      )

      const validationSchemaMessages = validateInputByScheme(dto, CategoryCreateSchema)

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
    user: IUser,
    configurable: Configurable,
  ): Promise<CategoryDTO[]> {
    const extendedCategories: CategoryDTO[] = []

    for (const category of categories) {
      const workspaceId = category.workspaceId
        ? category.workspaceId
        : await this._resolveWorkspaceByName(
            'Category',
            configurable,
            errors,
            user,
            category.workspaceName,
          )
      if (!workspaceId) continue

      const boardId = category.boardId
        ? category.boardId
        : await this._resolveBoardByName(
            'Category',
            workspaceId,
            configurable,
            errors,
            user,
            category.boardName,
          )
      if (!boardId) continue

      const categoryExtended: CategoryDTO = {
        ...category,
        boardId: boardId!,
        workspaceId: workspaceId,
      }

      extendedCategories.push(categoryExtended)
    }

    return extendedCategories
  }
}
