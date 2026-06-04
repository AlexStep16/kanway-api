import CategoryRepository from '@/application/repositories/CategoryRepository.js'
import { CategoryService } from '@/application/services/CategoryService.js'
import { FilterToMongoQueryService } from './FilterToMongoQueryService.js'
import { SelectionService } from './SelectionService.js'
import { ToolStatusLogLifecycleService } from './ToolStatusLogLifecycleService.js'
import { SearchCategoriesDTO } from '../tools/schemes/CategoryManager/SearchCategoriesScheme.js'
import { RunnableConfig } from '@langchain/core/runnables'
import { IConfigContext } from '../interfaces/IConfigContext.js'
import { ClientSession, Types } from 'mongoose'
import { BoardService } from '@/application/services/BoardService.js'
import { Configurable } from '../interfaces/Configurable.js'
import { ISearchEntitiesContent } from '@/application/interfaces/statuses/content/ISearchEntitiesContent.js'
import { StatusLog } from '@/application/types/StatusLog.js'
import { StatusTypesEnum } from '@/enums/StatusTypesEnum.js'
import { StatusStatesEnum } from '@/enums/StatusStatesEnum.js'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { CustomEvents } from '@/enums/CustomEvents.js'
import { EntityTypesEnum } from '@/domain/enums/EntityTypesEnum.js'
import { SuccessToolResult } from '../tools/helpers/ToolResult/SuccessToolResult.js'
import { UpdateCategoriesDTO } from '../tools/schemes/CategoryManager/UpdateCategoriesScheme.js'
import { ICategory } from '@/domain/entities/ICategory.js'
import {
  transformRawUpdateToDTO,
  transformRawUpdateToHumanReadableFilters,
} from '../tools/helpers/UpdateCategoriesHelpers.js'
import { AiConfirmationTypeEnum } from '@/domain/enums/AiConfirmationTypeEnum.js'
import { ConfirmationToolResult } from '../tools/helpers/ToolResult/ConfirmationToolResult.js'
import { FailedToolResult } from '../tools/helpers/ToolResult/FailedToolResult.js'
import { ITextValue } from '@/application/interfaces/statuses/content/ITextValue.js'
import { MoveCategoriesDTO } from '../tools/schemes/CategoryManager/MoveCategoriesScheme.js'
import { DeleteArchiveCategoriesDTO } from '../tools/schemes/CategoryManager/DeleteArchiveCategoriesScheme.js'
import { CloneCategoriesDTO } from '../tools/schemes/CategoryManager/CloneCategoriesScheme.js'
import { RecoverCategoriesDTO } from '../tools/schemes/CategoryManager/RecoverCategoriesScheme.js'
import { SearchFilter } from '@/application/types/SearchFilter.js'
import { getSearchHumanReadableFilter } from '../tools/helpers/SearchTasksHumanReadableFilters.js'
import { buildEntitySamples } from '../tools/helpers/EntitySamplesHelpers.js'

export class CategoryToolsExecutorService {
  constructor(
    private categoryRepository: CategoryRepository,

    private categoryService: CategoryService,
    private boardService: BoardService,
    private filterToMongoQueryService: FilterToMongoQueryService,
    private selectionService: SelectionService,
    private toolStatusLogLifecycleService = new ToolStatusLogLifecycleService(),
  ) {}

  public async searchCategories(
    payload: SearchCategoriesDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const toolCall = context.toolCall!
    const configurable = config.configurable as Configurable
    const { filters, fields_to_include = [] } = payload

    const mongoQuery = await this.filterToMongoQueryService.prepare(
      filters,
      configurable.timezone,
      configurable.user.id,
      { entityType: 'category' },
    )
    const humanReadableFilters = this._transformSearchFiltersToHumanReadableFilters(filters)

    const toolContent: ISearchEntitiesContent = {
      filters: humanReadableFilters,
    }
    const statusLog: StatusLog = {
      id: new Types.ObjectId().toString(),
      type: StatusTypesEnum.TOOL,
      state: StatusStatesEnum.IN_PROGRESS,
      content: {
        id: toolCall.id!,
        name: 'search_categories',
        content: toolContent,
      },
    }
    await dispatchCustomEvent(CustomEvents.STATUS_ADD_LOG, statusLog)

    try {
      const categories = await this.categoryService.getByFilter(mongoQuery, session)
      const categoriesSample = buildEntitySamples(EntityTypesEnum.CATEGORY, categories, {
        timezone: configurable.timezone,
        additionalFields: fields_to_include,
      })
      const selection = await this.selectionService.create(
        {
          entityType: EntityTypesEnum.CATEGORY,
          entityIds: categories.map((c) => c.id),
          humanReadableFilters,
          sample: categoriesSample,
          count: categories.length,
        },
        configurable.user.id,
        session,
      )

      statusLog.state = StatusStatesEnum.COMPLETED
      toolContent.ids = categories.map((c) => c.id.toString())

      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      return new SuccessToolResult(
        JSON.stringify({
          selection_id: selection.id.toString(),
          sample: categoriesSample,
          count: categories.length,
          human_readable_filters: humanReadableFilters,
        }),
        {
          selections: [selection],
        },
      )
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  public async updateCategories(
    payload: UpdateCategoriesDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const categoryIds = await this._resolveCategoryIds(payload, configurable.user.id, session)
    const toolCall = context.toolCall!

    const humanReadableUpdates = transformRawUpdateToHumanReadableFilters(payload.updates)

    const statusLog = await this.toolStatusLogLifecycleService.getOrCreateInProgressLog({
      existingLog: context.statusLog,
      toolCallId: toolCall.id!,
      toolName: 'update_categories',
      toolContent: {
        ids: Array.from(new Set(categoryIds)),
        filters: humanReadableUpdates,
      },
    })

    try {
      const categories = await this.categoryRepository.findByFilter<ICategory>(
        {
          _id: { $in: categoryIds },
          user_id: configurable.user.id,
        },
        session,
        {
          limit: categoryIds.length,
        },
      )

      const dtoCategories = transformRawUpdateToDTO(categories, payload.updates)

      if (dtoCategories.length === 0) {
        throw new Error('No categories to update')
      }

      let isDryRun = false

      if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
        if (context.isApproved === undefined) {
          isDryRun = true
        } else if (context.isApproved === false) {
          await this.toolStatusLogLifecycleService.setCancelled(statusLog)

          return new SuccessToolResult('Category update operation was rejected by the user.')
        }
      }

      const updateCategoriesResult = await this.categoryService.editMany(
        dtoCategories,
        configurable.user,
        session,
        isDryRun,
      )

      if (updateCategoriesResult.logId) {
        const operationLogId = updateCategoriesResult.logId.toString()

        if (isDryRun) {
          await this.toolStatusLogLifecycleService.setAwaitingConfirmation(statusLog, (content) => {
            content.logId = operationLogId
          })

          return new ConfirmationToolResult({
            logId: operationLogId,
          })
        }

        await dispatchCustomEvent(CustomEvents.OPERATION, {
          logId: operationLogId,
          session,
        })

        await this.toolStatusLogLifecycleService.setCompleted(statusLog, (content) => {
          content.logId = operationLogId
        })

        return new SuccessToolResult(
          `Successfully updated ${updateCategoriesResult.data.length} categories. Operation Log ID: ${operationLogId}`,
          {
            logId: operationLogId,
          },
        )
      }

      return new FailedToolResult('Failed to create operation log for categories update.')
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  private async _resolveCategoryIds(
    payload: {
      selection_id?: string
      category_ids?: string[]
    },
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<string[]> {
    let categoryIds: string[] = []

    if (!payload.category_ids && !payload.selection_id) {
      throw new Error('Either category_ids or selection_id must be provided')
    }

    if (payload.selection_id) {
      const selections = await this.selectionService.getByCriteria(
        {
          id: payload.selection_id,
        },
        userId,
        session,
      )

      if (selections.length === 0) {
        throw new Error('Selection not found')
      }

      const selection = selections[0]

      categoryIds = selection.entityIds.map((id) => id.toString())
    }

    if (payload.category_ids) {
      payload.category_ids.forEach((id) => {
        if (!Types.ObjectId.isValid(id)) {
          throw new Error(`Invalid category id: ${id}`)
        }
      })

      categoryIds = Array.from(new Set(payload.category_ids))
    }

    if (categoryIds.length === 0) {
      throw new Error('No categories to update')
    }

    return categoryIds
  }

  private async _resolveHumanReadableFilters(
    payload: {
      selection_id?: string
      category_ids?: string[]
    },
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<ITextValue[]> {
    if (payload.selection_id) {
      const selections = await this.selectionService.getByCriteria(
        {
          id: payload.selection_id,
        },
        userId,
        session,
      )

      if (selections.length === 0) {
        throw new Error('Selection not found')
      }

      const selection = selections[0]

      return selection.humanReadableFilters
    }

    if (payload.category_ids) {
      payload.category_ids.forEach((id) => {
        if (!Types.ObjectId.isValid(id)) {
          throw new Error(`Invalid category id: ${id}`)
        }
      })

      const categories = await this.categoryService.getByCriteria(
        { ids: payload.category_ids },
        userId,
        session,
      )

      return categories.map((category) => ({
        text: 'Название',
        value: category.name,
      }))
    }

    return []
  }

  private async _resolveMoveHumanReadableFilters(
    payload: MoveCategoriesDTO,
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<ITextValue[]> {
    const filters: ITextValue[] = []

    if (payload.toStart) {
      filters.push({
        text: 'Позиция',
        value: 'в начало',
      })
    }

    if (payload.toEnd) {
      filters.push({
        text: 'Позиция',
        value: 'в конец',
      })
    }

    const anchorCategoryIds = Array.from(
      new Set([payload.beforeCategoryId, payload.afterCategoryId].filter(Boolean) as string[]),
    )
    const anchorCategoryNamesById = new Map<string, string>()

    if (anchorCategoryIds.length > 0) {
      const anchorCategories = await this.categoryService.getByCriteria(
        { ids: anchorCategoryIds },
        userId,
        session,
      )

      anchorCategories.forEach((category) => {
        anchorCategoryNamesById.set(category.id.toString(), category.name)
      })
    }

    if (payload.beforeCategoryId) {
      filters.push({
        text: 'Перед категорией',
        value: anchorCategoryNamesById.get(payload.beforeCategoryId) ?? payload.beforeCategoryId,
      })
    }

    if (payload.afterCategoryId) {
      filters.push({
        text: 'После категории',
        value: anchorCategoryNamesById.get(payload.afterCategoryId) ?? payload.afterCategoryId,
      })
    }

    if (payload.newBoardId) {
      const boards = await this.boardService.getByCriteria(
        { id: payload.newBoardId },
        userId,
        session,
      )

      filters.push({
        text: 'Новая доска',
        value: boards[0]?.name ?? payload.newBoardId,
      })
    }

    return filters
  }

  public async deleteArchiveCategories(
    payload: DeleteArchiveCategoriesDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const categoryIds = await this._resolveCategoryIds(payload, configurable.user.id, session)
    const humanReadableFilters = await this._resolveHumanReadableFilters(
      payload,
      configurable.user.id,
      session,
    )
    const toolCall = context.toolCall!

    const mainFunction = payload.soft_delete
      ? this.categoryService.archive.bind(this.categoryService)
      : this.categoryService.delete.bind(this.categoryService)

    const statusLog = await this.toolStatusLogLifecycleService.getOrCreateInProgressLog({
      existingLog: context.statusLog,
      toolCallId: toolCall.id!,
      toolName: 'delete_archive_categories',
      toolContent: {
        ids: Array.from(new Set(categoryIds)),
        filters: humanReadableFilters,
        isSoftDelete: payload.soft_delete,
      },
    })

    let isDryRun = false
    try {
      if (
        [AiConfirmationTypeEnum.ALWAYS, AiConfirmationTypeEnum.ONLY_FOR_SENSITIVE].includes(
          configurable.aiConfirmationType,
        )
      ) {
        if (context.isApproved === undefined) {
          isDryRun = true
        } else if (context.isApproved === false) {
          await this.toolStatusLogLifecycleService.setCancelled(statusLog)

          return new SuccessToolResult('Category update operation was rejected by the user.')
        }
      }

      const result = await mainFunction(
        {
          ids: categoryIds,
        },
        configurable.user,
        session,
        isDryRun,
      )

      const actionString = payload.soft_delete ? 'archived' : 'deleted'

      if (result.logId) {
        const operationLogId = result.logId.toString()

        if (isDryRun) {
          await this.toolStatusLogLifecycleService.setAwaitingConfirmation(statusLog, (content) => {
            content.logId = operationLogId
          })

          return new ConfirmationToolResult({
            logId: operationLogId,
          })
        }

        await dispatchCustomEvent(CustomEvents.OPERATION, {
          logId: operationLogId,
          session,
        })

        await this.toolStatusLogLifecycleService.setCompleted(statusLog, (content) => {
          content.logId = operationLogId
        })

        let categoriesProcessedCount = 0

        if (result.data && 'deletedCount' in result.data) {
          categoriesProcessedCount = result.data.deletedCount
        } else if (result.data && Array.isArray(result.data)) {
          categoriesProcessedCount = result.data.length
        } else {
          return new FailedToolResult('No categories were affected by the operation.')
        }

        return new SuccessToolResult(
          `Successfully ${actionString} ${categoriesProcessedCount} categories. Operation Log ID: ${operationLogId}`,
          {
            logId: operationLogId,
          },
        )
      }

      return new FailedToolResult(`Failed to create operation log for categories ${actionString}.`)
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  public async cloneCategories(
    payload: CloneCategoriesDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const categoryIds = await this._resolveCategoryIds(payload, configurable.user.id, session)
    const humanReadableFilters = await this._resolveHumanReadableFilters(
      payload,
      configurable.user.id,
      session,
    )
    const toolCall = context.toolCall!

    const statusLog = await this.toolStatusLogLifecycleService.getOrCreateInProgressLog({
      existingLog: context.statusLog,
      toolCallId: toolCall.id!,
      toolName: 'clone_categories',
      toolContent: {
        ids: Array.from(new Set(categoryIds)),
        filters: humanReadableFilters,
      },
    })

    try {
      let isDryRun = false

      if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
        if (context.isApproved === undefined) {
          isDryRun = true
        } else if (context.isApproved === false) {
          await this.toolStatusLogLifecycleService.setCancelled(statusLog)

          return new SuccessToolResult('Category clone operation was rejected by the user.')
        }
      }

      const cloneCategoriesResult = await this.categoryService.clone(
        {
          ids: categoryIds,
        },
        configurable.user,
        session,
        isDryRun,
      )

      if (cloneCategoriesResult.logId) {
        const operationLogId = cloneCategoriesResult.logId.toString()

        if (isDryRun) {
          await this.toolStatusLogLifecycleService.setAwaitingConfirmation(statusLog, (content) => {
            content.logId = operationLogId
          })

          return new ConfirmationToolResult({
            logId: operationLogId,
          })
        }

        await dispatchCustomEvent(CustomEvents.OPERATION, {
          logId: operationLogId,
          session,
        })

        await this.toolStatusLogLifecycleService.setCompleted(statusLog, (content) => {
          content.logId = operationLogId
        })

        return new SuccessToolResult(
          `Successfully cloned ${cloneCategoriesResult.data.length} categories. Operation Log ID: ${operationLogId}`,
          {
            logId: operationLogId,
          },
        )
      }

      return new FailedToolResult('Failed to create operation log for categories clone.')
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  public async recoverCategories(
    payload: RecoverCategoriesDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const categoryIds = await this._resolveCategoryIds(payload, configurable.user.id, session)
    const humanReadableFilters = await this._resolveHumanReadableFilters(
      payload,
      configurable.user.id,
      session,
    )
    const toolCall = context.toolCall!

    const statusLog = await this.toolStatusLogLifecycleService.getOrCreateInProgressLog({
      existingLog: context.statusLog,
      toolCallId: toolCall.id!,
      toolName: 'recover_categories',
      toolContent: {
        ids: Array.from(new Set(categoryIds)),
        filters: humanReadableFilters,
      },
    })

    let isDryRun = false

    try {
      if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
        if (context.isApproved === undefined) {
          isDryRun = true
        } else if (context.isApproved === false) {
          await this.toolStatusLogLifecycleService.setCancelled(statusLog)

          return new SuccessToolResult('Category recover operation was rejected by the user.')
        }
      }

      const recoverCategoriesResult = await this.categoryService.recover(
        {
          ids: categoryIds,
        },
        configurable.user,
        session,
        isDryRun,
      )

      if (recoverCategoriesResult.logId) {
        const operationLogId = recoverCategoriesResult.logId.toString()

        if (isDryRun) {
          await this.toolStatusLogLifecycleService.setAwaitingConfirmation(statusLog, (content) => {
            content.logId = operationLogId
          })

          return new ConfirmationToolResult({
            logId: operationLogId,
          })
        }

        await dispatchCustomEvent(CustomEvents.OPERATION, {
          logId: operationLogId,
          session,
        })

        await this.toolStatusLogLifecycleService.setCompleted(statusLog, (content) => {
          content.logId = operationLogId
        })

        return new SuccessToolResult(
          `Successfully recovered ${recoverCategoriesResult.data.length} categories. Operation Log ID: ${operationLogId}`,
          {
            logId: operationLogId,
          },
        )
      }

      return new FailedToolResult('Failed to create operation log for categories recover.')
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  public async moveCategories(
    payload: MoveCategoriesDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const categoryIds = await this._resolveCategoryIds(payload, configurable.user.id, session)
    const humanReadableFilters = await this._resolveMoveHumanReadableFilters(
      payload,
      configurable.user.id,
      session,
    )
    const toolCall = context.toolCall!

    const statusLog = await this.toolStatusLogLifecycleService.getOrCreateInProgressLog({
      existingLog: context.statusLog,
      toolCallId: toolCall.id!,
      toolName: 'move_categories',
      toolContent: {
        ids: Array.from(new Set(categoryIds)),
        filters: humanReadableFilters,
      },
    })

    let isDryRun = false

    try {
      if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
        if (context.isApproved === undefined) {
          isDryRun = true
        } else if (context.isApproved === false) {
          await this.toolStatusLogLifecycleService.setCancelled(statusLog)

          return new SuccessToolResult('Category move operation was rejected by the user.')
        }
      }

      const moveCategoriesResult = await this.categoryService.moveMany(
        {
          ids: categoryIds,
          beforeCategoryId: payload.beforeCategoryId,
          afterCategoryId: payload.afterCategoryId,
          toStart: payload.toStart,
          toEnd: payload.toEnd,
          newBoardId: payload.newBoardId,
        },
        configurable.user,
        session,
        isDryRun,
      )

      if (moveCategoriesResult.logId) {
        const operationLogId = moveCategoriesResult.logId.toString()

        if (isDryRun) {
          await this.toolStatusLogLifecycleService.setAwaitingConfirmation(statusLog, (content) => {
            content.logId = operationLogId
          })

          return new ConfirmationToolResult({
            logId: operationLogId,
          })
        }

        await dispatchCustomEvent(CustomEvents.OPERATION, {
          logId: operationLogId,
          session,
        })

        await this.toolStatusLogLifecycleService.setCompleted(statusLog, (content) => {
          content.logId = operationLogId
        })

        return new SuccessToolResult(
          `Successfully moved ${moveCategoriesResult.data.length} categories. Operation Log ID: ${operationLogId}`,
          {
            logId: operationLogId,
          },
        )
      }

      return new FailedToolResult('Failed to create operation log for categories move.')
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  private _transformSearchFiltersToHumanReadableFilters(filters: SearchFilter[]): ITextValue[] {
    return filters
      .map((filter) => {
        try {
          return getSearchHumanReadableFilter(filter)
        } catch (error) {
          console.error(
            `Error transforming filter to human-readable format: ${error instanceof Error ? error.message : error}`,
          )
          return null
        }
      })
      .filter((filter): filter is ITextValue => filter !== null)
  }
}
