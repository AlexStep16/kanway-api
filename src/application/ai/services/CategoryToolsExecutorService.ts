import { Configurable } from '@/application/ai/interfaces/Configurable.ts'
import CategoryRepository from '@/application/repositories/CategoryRepository.ts'
import { CategoryService } from '@/application/services/CategoryService.ts'
import { AiConfirmationTypeEnum } from '@/domain/enums/AiConfirmationTypeEnum.ts'
import { CustomEvents } from '@/enums/CustomEvents.ts'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import Fuse from 'fuse.js'
import { ClientSession, FilterQuery, Types } from 'mongoose'
import { ConfirmationEntityToolResult } from '../tools/helpers/ConfirmationEntityToolResult.ts'
import { SuccessToolResult } from '../tools/helpers/SuccessToolResult.ts'
import { toServerCaseKeys } from '@/utils/objectTransformers.ts'
import { FailedToolResult } from '../tools/helpers/FailedToolResult.ts'
import z from 'zod'
import { OperationLogService } from '@/application/services/OperationLogService.ts'
import { OperationLogStatusesEnum } from '@/domain/enums/OperationLogStatusesEnum.ts'
import { IResponseWithLog } from '@/application/interfaces/IResponseWithLog.ts'
import { ChatMessageService } from '@/application/services/ChatMessageService.ts'
import { ICategoryRawString } from '@/domain/entities/ICategoryRawString.ts'
import { CreateCategoriesDTO, CreateCategoriesDTOSchema } from '../dtos/CreateCategoriesDTO.ts'
import { BoardService } from '@/application/services/BoardService.ts'
import { ICategoryPopulated } from '@/application/interfaces/ICategoryPopulated.ts'
import { CategoryDTO } from '@/application/dtos/CategoryDTO.ts'
import { UpdateCategoriesDTO, UpdateCategoriesDTOSchema } from '../dtos/UpdateCategoriesDTO.ts'
import { CategoryEditDTO } from '@/application/dtos/CategoryEditDTO.ts'
import { CategoryEditManyDTO } from '@/application/dtos/CategoryEditManyDTO.ts'
import { AbstractToolExecutor } from './AbstractToolExecutor.ts'
import { MoveCategoryDTO, MoveCategoryDTOSchema } from '../dtos/MoveCategoryDTO.ts'
import { CategoryMoveDTO } from '@/application/dtos/CategoryMoveDTO.ts'
import { DispatchPayload } from './ToolDispatcherService.ts'
import { VectorSearchService } from '@/application/services/VectorSearchService.ts'
import { findProperty } from '@/utils/findProperty.ts'

type ICategoryCreatePopulated = Omit<ICategoryPopulated, 'id' | 'createdAt' | 'updatedAt'> & {
  id: string
}

export class CategoryToolsExecutorService extends AbstractToolExecutor {
  constructor(
    private categoryRepository: CategoryRepository,
    private categoryService: CategoryService,
    private boardService: BoardService,
    private operationLogService: OperationLogService,
    private chatMessageService: ChatMessageService,
    private vectorSearchService: VectorSearchService,
  ) {
    super()

    this.toolRegistry = {
      search_categories: this.searchCategories.bind(this),
      create_categories: this.createCategories.bind(this),
      update_categories: this.updateCategories.bind(this),
      move_category: this.moveCategory.bind(this),
      delete_categories: this.deleteCategories.bind(this),
      archive_categories: this.archiveCategories.bind(this),
      recover_categories: this.recoverCategories.bind(this),
      clone_categories: this.cloneCategories.bind(this),
    }
  }

  public async searchCategories(payload: DispatchPayload, session?: ClientSession) {
    const HARD_SEARCH_LIMIT = 2000

    const { toolCall, userId } = payload

    const args = toolCall.args as {
      mongo_filter?: FilterQuery<ICategoryRawString>
      search_query?: string
      search_mode?: 'fuzzy' | 'semantic'
      limit?: number
    }

    const { mongo_filter = {}, search_query = '', search_mode = 'fuzzy', limit = 50 } = args

    const scaledLimit = search_query ? HARD_SEARCH_LIMIT : limit

    const isMongoFilterHasDeletedCondition =
      findProperty(mongo_filter, 'is_deleted') !== undefined ||
      findProperty(mongo_filter, 'is_deleted_external') !== undefined

    const baseFilter: FilterQuery<ICategoryRawString> = isMongoFilterHasDeletedCondition
      ? {}
      : {
          is_deleted: { $ne: true },
          is_deleted_external: { $ne: true },
        }

    const unionFilter = { ...baseFilter, ...mongo_filter, user_id: new Types.ObjectId(userId) }

    const filteredCount = await this.categoryRepository.getCountByFilter(unionFilter, session)

    const categories = await this.categoryRepository.findByFilter<ICategoryRawString>(
      unionFilter,
      session,
      {
        isMongoCase: true,
        limit: scaledLimit,
        sort: { rank: 1 },
      },
    )

    if (search_query) {
      if (categories.length === 0) {
        return {
          items: [],
          count: 0,
          hasMore: false,
        }
      }

      let pagedResults: ICategoryRawString[] = []
      let searchedCount = 0

      if (search_mode === 'fuzzy') {
        const fuse = new Fuse(categories, {
          keys: ['name'],
          threshold: 0.3,
          includeScore: true,
        })

        const searchResults = fuse.search(search_query)

        pagedResults = searchResults
          .sort((a, b) => (a.score || 0) - (b.score || 0))
          .slice(0, scaledLimit)
          .map((result) => result.item)
        searchedCount = searchResults.length
      } else if (search_mode === 'semantic') {
        const filteredIds = categories.map((category) => new Types.ObjectId(category._id))

        const semanticCategories = await this.vectorSearchService.similaritySearchCategories(
          [search_query],
          new Types.ObjectId(userId),
          20,
          filteredIds,
        )
        const semanticCategoryIds = semanticCategories.map((category) => category.id.toString())

        pagedResults = categories.filter((category) =>
          semanticCategoryIds.includes(category._id.toString()),
        )
        searchedCount = semanticCategories.length
      }

      return {
        items: pagedResults,
        count: searchedCount,
        hasMore: searchedCount > scaledLimit,
      }
    }

    const hasMore = filteredCount > categories.length

    return {
      items: categories,
      count: filteredCount,
      hasMore,
    }
  }

  private async _populateCategoriesParentData(
    categories: CreateCategoriesDTO['categories'],
    userId: string,
    session?: ClientSession,
  ): Promise<ICategoryCreatePopulated[]> {
    const uniqueBoardIds = Array.from(
      new Set(categories.filter((category) => category.board).map((category) => category.board)),
    )

    const boards = await this.boardService.getByCriteria(
      { ids: uniqueBoardIds },
      new Types.ObjectId(userId),
      session,
    )

    return categories.map((category) => {
      const board = boards.find((b) => b.id.toString() === category.board)

      if (!board) {
        throw new Error(`Board with ID ${category.board} not found for category ${category.name}`)
      }

      return {
        ...toServerCaseKeys(category),
        id: category._id,
        workspace: {
          id: board.workspace.id,
          name: board.workspace.name,
        },
        board: {
          id: board.id,
          name: board.name,
        },
      }
    })
  }

  private _transformRawCreateToDTO(
    categoriesRaw: ICategoryCreatePopulated[],
  ): (CategoryDTO & { id: string })[] {
    return categoriesRaw.map((category) => {
      return {
        id: category.id,
        name: category.name,
        workspaceId: category.workspace.id.toString(),
        boardId: category.board.id.toString(),
      }
    })
  }

  private _transformRawUpdateToDTO(
    categoriesRaw: UpdateCategoriesDTO['updates'],
  ): CategoryEditManyDTO {
    return categoriesRaw.map((category) => {
      const update: CategoryEditDTO = {
        id: category._id,
      }

      if (typeof category.name !== 'undefined') update.name = category.name
      if (typeof category.workspace !== 'undefined') update.workspaceId = category.workspace
      if (typeof category.board !== 'undefined') update.boardId = category.board

      return update
    })
  }

  public async createCategories(payload: DispatchPayload, session?: ClientSession) {
    const { toolCall, config } = payload
    const args = toolCall.args as CreateCategoriesDTO
    const toolCallId = toolCall.id

    const configurable = config.configurable as Configurable
    const user = configurable.user

    const validationResult = CreateCategoriesDTOSchema.safeParse(args)

    if (!validationResult.success) {
      return new FailedToolResult(
        `Validation Error: Invalid arguments. \n${z.prettifyError(
          validationResult.error,
        )}. \nPlease fix the arguments and try again.`,
      )
    }

    const populatedCategories = await this._populateCategoriesParentData(
      args.categories,
      user.id.toString(),
      session,
    )

    let dtoCategories = this._transformRawCreateToDTO(populatedCategories)

    if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
      const messages = await this.chatMessageService.getByCriteria(
        { pendingToolCallId: toolCallId, role: 'operation' },
        user.id,
        session,
      )

      if (messages.length > 0) {
        const logs = await this.operationLogService.getByCriteria(
          { id: messages[0].content },
          user.id,
          session,
        )

        const log = logs[0]

        if (log.status === OperationLogStatusesEnum.CANCELLED) {
          return new SuccessToolResult('Category creation cancelled by user.')
        } else if (log.status === OperationLogStatusesEnum.APPROVED) {
          const selectedIds = log.selectedIds || []

          dtoCategories = dtoCategories.filter((category) => selectedIds.includes(category.id))
        } else {
          return new FailedToolResult('Category creation pending user confirmation.')
        }
      } else {
        const mockCreateCategories = await this.categoryService.createMany(
          dtoCategories,
          user,
          session,
          true,
        )

        if (mockCreateCategories.logId) {
          return new ConfirmationEntityToolResult({
            toolCallId: toolCallId,
            logId: mockCreateCategories.logId.toString(),
          })
        } else return new FailedToolResult('Failed to create operation log for category creation.')
      }
    }

    await dispatchCustomEvent(
      CustomEvents.STEP_ADD,
      {
        id: new Types.ObjectId().toString(),
        name: 'Создаю категории',
      },
      config,
    )

    const createdCategories = await this.categoryService.createMany(dtoCategories, user, session)

    const logs = await this.operationLogService.getByCriteria(
      { id: createdCategories.logId!.toString() },
      user.id,
      session,
    )

    await dispatchCustomEvent(
      CustomEvents.OPERATION,
      {
        logId: logs[0].id,
        toolCallId: toolCallId,
      },
      config,
    )

    const resultInfo = createdCategories.data.map((category) => ({
      id: category.id,
      name: category.name,
    }))

    const resultMessage = `
      Successfully created ${createdCategories.data.length} categories: ${JSON.stringify(resultInfo)}
      Log ID: ${createdCategories.logId}
    `

    return new SuccessToolResult(resultMessage)
  }

  public async updateCategories(payload: DispatchPayload, session?: ClientSession) {
    const { toolCall, config } = payload
    const args = toolCall.args as UpdateCategoriesDTO
    const toolCallId = toolCall.id

    const configurable = config.configurable as Configurable
    const user = configurable.user

    const validationResult = UpdateCategoriesDTOSchema.safeParse(args)

    if (!validationResult.success) {
      return new FailedToolResult(
        `Validation Error: Invalid arguments. \n${z.prettifyError(
          validationResult.error,
        )}. \nPlease fix the arguments and try again.`,
      )
    }

    let dtoCategories = this._transformRawUpdateToDTO(args.updates)

    if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
      const messages = await this.chatMessageService.getByCriteria(
        { pendingToolCallId: toolCallId, role: 'operation' },
        user.id,
        session,
      )

      if (messages.length > 0) {
        const logs = await this.operationLogService.getByCriteria(
          { id: messages[0].content },
          user.id,
          session,
        )

        const log = logs[0]

        if (log.status === OperationLogStatusesEnum.CANCELLED) {
          return new SuccessToolResult('Category update cancelled by user.')
        } else if (log.status === OperationLogStatusesEnum.APPROVED) {
          const selectedIds = log.selectedIds || []

          dtoCategories = dtoCategories.filter((category) => selectedIds.includes(category.id))
        }
      } else {
        const mockUpdateCategories = await this.categoryService.editMany(
          dtoCategories,
          user,
          session,
          true,
        )

        if (mockUpdateCategories.logId) {
          return new ConfirmationEntityToolResult({
            toolCallId: toolCallId,
            logId: mockUpdateCategories.logId.toString(),
          })
        } else return new FailedToolResult('Failed to create operation log for category update.')
      }
    }

    await dispatchCustomEvent(
      CustomEvents.STEP_ADD,
      {
        id: new Types.ObjectId().toString(),
        name: 'Обновляю категории',
      },
      config,
    )

    const updatedCategories = (await this.categoryService.editMany(
      dtoCategories,
      user,
      session,
    )) as IResponseWithLog<ICategoryPopulated[]>
    const logs = await this.operationLogService.getByCriteria(
      { id: updatedCategories.logId!.toString() },
      user.id,
      session,
    )

    await dispatchCustomEvent(
      CustomEvents.OPERATION,
      {
        logId: logs[0].id,
        toolCallId: toolCallId,
      },
      config,
    )

    const resultInfo = logs[0].entitiesAfter

    const resultMessage = `
      Successfully updated ${updatedCategories.data.length} categories: ${JSON.stringify(resultInfo)}
      Log ID: ${updatedCategories.logId}
    `

    return new SuccessToolResult(resultMessage)
  }

  public async moveCategory(payload: DispatchPayload, session?: ClientSession) {
    const { toolCall, config } = payload
    const args = toolCall.args as MoveCategoryDTO
    const toolCallId = toolCall.id

    const configurable = config.configurable as Configurable
    const user = configurable.user

    const validationResult = MoveCategoryDTOSchema.safeParse(args)

    if (!validationResult.success) {
      return new FailedToolResult(
        `Validation Error: Invalid arguments. \n${z.prettifyError(
          validationResult.error,
        )}. \nPlease fix the arguments and try again.`,
      )
    }

    const dto: CategoryMoveDTO = {
      id: args.id,
      beforeId: args.before_id ? args.before_id : undefined,
      afterId: args.after_id ? args.after_id : undefined,
      newBoardId: args.new_board_id ? args.new_board_id : undefined,
    }

    if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
      const messages = await this.chatMessageService.getByCriteria(
        { pendingToolCallId: toolCallId, role: 'operation' },
        user.id,
        session,
      )

      if (messages.length > 0) {
        const logs = await this.operationLogService.getByCriteria(
          { id: messages[0].content },
          user.id,
          session,
        )

        const log = logs[0]

        if (log.status === OperationLogStatusesEnum.CANCELLED) {
          return new SuccessToolResult('Category move cancelled by user.')
        }
      } else {
        const mockMoveCategory = await this.categoryService.move(dto, user, session, true)

        if (mockMoveCategory.logId) {
          return new ConfirmationEntityToolResult({
            toolCallId: toolCallId,
            logId: mockMoveCategory.logId.toString(),
          })
        } else return new FailedToolResult('Failed to create operation log for category move.')
      }
    }

    await dispatchCustomEvent(
      CustomEvents.STEP_ADD,
      {
        id: new Types.ObjectId().toString(),
        name: 'Перемещаю категории',
      },
      config,
    )

    const result = await this.categoryService.move(dto, user, session)

    const logs = await this.operationLogService.getByCriteria(
      { id: result.logId!.toString() },
      user.id,
      session,
    )

    await dispatchCustomEvent(
      CustomEvents.OPERATION,
      {
        logId: logs[0].id,
        toolCallId: toolCallId,
      },
      config,
    )

    const resultInfo = logs[0].entitiesAfter

    const resultMessage = `
      Successfully moved ${result.data.length} categories: ${JSON.stringify(resultInfo)}
      Log ID: ${result.logId}
    `

    return new SuccessToolResult(resultMessage)
  }

  public async deleteCategories(payload: DispatchPayload, session?: ClientSession) {
    const { toolCall, config } = payload

    const args = toolCall.args as { ids: string[] }
    const toolCallId = toolCall.id

    const configurable = config.configurable as Configurable
    const user = configurable.user

    if (!args.ids || !Array.isArray(args.ids) || args.ids.some((id) => typeof id !== 'string')) {
      return new FailedToolResult(
        'Validation Error: Invalid arguments. Please provide an object with an ids property which is array of string IDs.',
      )
    }

    if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
      const messages = await this.chatMessageService.getByCriteria(
        { pendingToolCallId: toolCallId, role: 'operation' },
        user.id,
        session,
      )

      if (messages.length > 0) {
        const logs = await this.operationLogService.getByCriteria(
          { id: messages[0].content },
          user.id,
          session,
        )

        const log = logs[0]

        if (log.status === OperationLogStatusesEnum.CANCELLED) {
          return new SuccessToolResult('Category move cancelled by user.')
        } else if (log.status === OperationLogStatusesEnum.APPROVED) {
          const selectedIds = log.selectedIds || []

          args.ids = args.ids.filter((id) => selectedIds.includes(id))
        }
      } else {
        const mockDeleteCategory = await this.categoryService.delete(
          {
            ids: args.ids,
          },
          user,
          session,
          true,
        )

        if (mockDeleteCategory.logId) {
          return new ConfirmationEntityToolResult({
            toolCallId: toolCallId,
            logId: mockDeleteCategory.logId.toString(),
          })
        } else return new FailedToolResult('Failed to create operation log for category delete.')
      }
    }

    await dispatchCustomEvent(
      CustomEvents.STEP_ADD,
      {
        id: new Types.ObjectId().toString(),
        name: 'Удаляю категории',
      },
      config,
    )

    const result = await this.categoryService.delete(
      {
        ids: args.ids,
      },
      user,
      session,
    )

    const logs = await this.operationLogService.getByCriteria(
      { id: result.logId!.toString() },
      user.id,
      session,
    )

    await dispatchCustomEvent(
      CustomEvents.OPERATION,
      {
        logId: logs[0].id,
        toolCallId: toolCallId,
      },
      config,
    )

    const resultInfo = (logs[0].entitiesBefore || []).map((category) => ({
      id: category.id,
      name: category.name,
    }))

    const resultMessage = `
      Successfully deleted ${resultInfo.length} categories: ${JSON.stringify(resultInfo)}
      Log ID: ${result.logId}
    `

    return new SuccessToolResult(resultMessage)
  }

  public async archiveCategories(payload: DispatchPayload, session?: ClientSession) {
    const { toolCall, config } = payload

    const args = toolCall.args as { ids: string[] }
    const toolCallId = toolCall.id

    const configurable = config.configurable as Configurable
    const user = configurable.user

    if (!args.ids || !Array.isArray(args.ids) || args.ids.some((id) => typeof id !== 'string')) {
      return new FailedToolResult(
        'Validation Error: Invalid arguments. Please provide an object with an ids property which is array of string IDs.',
      )
    }

    if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
      const messages = await this.chatMessageService.getByCriteria(
        { pendingToolCallId: toolCallId, role: 'operation' },
        user.id,
        session,
      )

      if (messages.length > 0) {
        const logs = await this.operationLogService.getByCriteria(
          { id: messages[0].content },
          user.id,
          session,
        )

        const log = logs[0]

        if (log.status === OperationLogStatusesEnum.CANCELLED) {
          return new SuccessToolResult('Categories archive cancelled by user.')
        } else if (log.status === OperationLogStatusesEnum.APPROVED) {
          const selectedIds = log.selectedIds || []

          args.ids = args.ids.filter((id) => selectedIds.includes(id))
        }
      } else {
        const mockArchiveCategory = await this.categoryService.archive(
          {
            ids: args.ids,
          },
          user,
          session,
          true,
        )

        if (mockArchiveCategory.logId) {
          return new ConfirmationEntityToolResult({
            toolCallId: toolCallId,
            logId: mockArchiveCategory.logId.toString(),
          })
        } else return new FailedToolResult('Failed to create operation log for category archive.')
      }
    }

    await dispatchCustomEvent(
      CustomEvents.STEP_ADD,
      {
        id: new Types.ObjectId().toString(),
        name: 'Архивирую категории',
      },
      config,
    )

    const result = await this.categoryService.archive(
      {
        ids: args.ids,
      },
      user,
      session,
    )

    const logs = await this.operationLogService.getByCriteria(
      { id: result.logId!.toString() },
      user.id,
      session,
    )

    await dispatchCustomEvent(
      CustomEvents.OPERATION,
      {
        logId: logs[0].id,
        toolCallId: toolCallId,
      },
      config,
    )

    const resultInfo = (logs[0].entitiesAfter || []).map((category) => ({
      id: category.id,
      name: category.name,
    }))

    const resultMessage = `
      Successfully archived ${result.data.length} categories: ${JSON.stringify(resultInfo)}
      Log ID: ${result.logId}
    `

    return new SuccessToolResult(resultMessage)
  }

  public async recoverCategories(payload: DispatchPayload, session?: ClientSession) {
    const { toolCall, config } = payload

    const args = toolCall.args as { ids: string[] }
    const toolCallId = toolCall.id

    const configurable = config.configurable as Configurable
    const user = configurable.user

    if (!args.ids || !Array.isArray(args.ids) || args.ids.some((id) => typeof id !== 'string')) {
      return new FailedToolResult(
        'Validation Error: Invalid arguments. Please provide an object with an ids property which is array of string IDs.',
      )
    }

    if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
      const messages = await this.chatMessageService.getByCriteria(
        { pendingToolCallId: toolCallId, role: 'operation' },
        user.id,
        session,
      )

      if (messages.length > 0) {
        const logs = await this.operationLogService.getByCriteria(
          { id: messages[0].content },
          user.id,
          session,
        )

        const log = logs[0]

        if (log.status === OperationLogStatusesEnum.CANCELLED) {
          return new SuccessToolResult('Categories recovery cancelled by user.')
        } else if (log.status === OperationLogStatusesEnum.APPROVED) {
          const selectedIds = log.selectedIds || []

          args.ids = args.ids.filter((id) => selectedIds.includes(id))
        }
      } else {
        const mockRecoverCategory = await this.categoryService.recover(
          {
            ids: args.ids,
          },
          user,
          session,
          true,
        )

        if (mockRecoverCategory.logId) {
          return new ConfirmationEntityToolResult({
            toolCallId: toolCallId,
            logId: mockRecoverCategory.logId.toString(),
          })
        } else return new FailedToolResult('Failed to create operation log for category recovery.')
      }
    }

    await dispatchCustomEvent(
      CustomEvents.STEP_ADD,
      {
        id: new Types.ObjectId().toString(),
        name: 'Восстанавливаю категории',
      },
      config,
    )

    const result = await this.categoryService.recover(
      {
        ids: args.ids,
      },
      user,
      session,
    )

    const logs = await this.operationLogService.getByCriteria(
      { id: result.logId!.toString() },
      user.id,
      session,
    )

    await dispatchCustomEvent(
      CustomEvents.OPERATION,
      {
        logId: logs[0].id,
        toolCallId: toolCallId,
      },
      config,
    )

    const resultInfo = (logs[0].entitiesAfter || []).map((category) => ({
      id: category.id,
      name: category.name,
    }))

    const resultMessage = `
      Successfully recovered ${result.data.length} categories: ${JSON.stringify(resultInfo)}
      Log ID: ${result.logId}
    `

    return new SuccessToolResult(resultMessage)
  }

  public async cloneCategories(payload: DispatchPayload, session?: ClientSession) {
    const { toolCall, config } = payload

    const args = toolCall.args as { ids: string[]; tempIds: string[] }
    const toolCallId = toolCall.id

    const configurable = config.configurable as Configurable
    const user = configurable.user

    if (!args.ids || !Array.isArray(args.ids) || args.ids.some((id) => typeof id !== 'string')) {
      return new FailedToolResult(
        'Validation Error: Invalid arguments. Please provide an object with an ids property which is array of string IDs.',
      )
    }

    if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
      const messages = await this.chatMessageService.getByCriteria(
        { pendingToolCallId: toolCallId, role: 'operation' },
        user.id,
        session,
      )

      if (messages.length > 0) {
        const logs = await this.operationLogService.getByCriteria(
          { id: messages[0].content },
          user.id,
          session,
        )

        const log = logs[0]

        if (log.status === OperationLogStatusesEnum.CANCELLED) {
          return new SuccessToolResult('Categories clone cancelled by user.')
        } else if (log.status === OperationLogStatusesEnum.APPROVED) {
          const selectedIds = log.selectedIds || []

          args.ids = args.ids.filter((id) => selectedIds.includes(id))
        }
      } else {
        const mockCloneCategory = await this.categoryService.clone(
          {
            ids: args.ids,
          },
          user,
          session,
          true,
          args.tempIds,
        )

        if (mockCloneCategory.logId) {
          return new ConfirmationEntityToolResult({
            toolCallId: toolCallId,
            logId: mockCloneCategory.logId.toString(),
          })
        } else return new FailedToolResult('Failed to create operation log for category clone.')
      }
    }

    await dispatchCustomEvent(
      CustomEvents.STEP_ADD,
      {
        id: new Types.ObjectId().toString(),
        name: 'Копирую категории',
      },
      config,
    )

    const result = await this.categoryService.clone(
      {
        ids: args.ids,
      },
      user,
      session,
      false,
      args.tempIds,
    )

    const logs = await this.operationLogService.getByCriteria(
      { id: result.logId!.toString() },
      user.id,
      session,
    )

    await dispatchCustomEvent(
      CustomEvents.OPERATION,
      {
        logId: logs[0].id,
        toolCallId: toolCallId,
      },
      config,
    )

    const resultInfo = (logs[0].entitiesAfter || []).map((category) => ({
      id: category.id,
      name: category.name,
    }))

    const resultMessage = `
      Successfully cloned ${result.data.length} categories: ${JSON.stringify(resultInfo)}
      Log ID: ${result.logId}
    `

    return new SuccessToolResult(resultMessage)
  }
}
