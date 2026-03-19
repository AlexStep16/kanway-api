import { Configurable } from '@/application/ai/interfaces/Configurable.ts'
import CategoryRepository from '@/application/repositories/CategoryRepository.ts'
import { CategoryService } from '@/application/services/CategoryService.ts'
import { AiConfirmationTypeEnum } from '@/domain/enums/AiConfirmationTypeEnum.ts'
import { CustomEvents } from '@/enums/CustomEventsNew.ts'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import Fuse from 'fuse.js'
import { FilterQuery, Types } from 'mongoose'
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

type ICategoryCreatePopulated = Partial<
  Omit<ICategoryPopulated, 'id' | 'createdAt' | 'updatedAt'>
> & {
  id: string
}

export class CategoryToolsExecutorService extends AbstractToolExecutor {
  constructor(
    private categoryRepository: CategoryRepository,
    private categoryService: CategoryService,
    private boardService: BoardService,
    private operationLogService: OperationLogService,
    private chatMessageService: ChatMessageService,
  ) {
    super()

    this.toolRegistry = {
      search_categories: this.searchCategories.bind(this),
      create_categories: this.createCategories.bind(this),
      update_categories: this.updateCategories.bind(this),
      move_category: this.moveCategory.bind(this),
    }
  }

  public async searchCategories(payload: DispatchPayload) {
    const HARD_SEARCH_LIMIT = 2000

    const { toolCall, userId } = payload

    const args = toolCall.args as {
      mongo_filter?: FilterQuery<ICategoryRawString>
      search_query?: string
      limit?: number
    }

    const { mongo_filter = {}, search_query = '', limit = 50 } = args

    const scaledLimit = search_query ? HARD_SEARCH_LIMIT : limit

    const baseFilter: FilterQuery<ICategoryRawString> = {
      is_deleted: { $ne: true },
      is_deleted_external: { $ne: true },
    }

    const unionFilter = { ...baseFilter, ...mongo_filter, user_id: new Types.ObjectId(userId) }

    const filteredCount = await this.categoryRepository.getCountByFilter(unionFilter)

    const categories = await this.categoryRepository.findByFilter<ICategoryRawString>(
      unionFilter,
      undefined,
      {
        isMongoCase: true,
        limit: scaledLimit,
      },
    )

    if (search_query) {
      if (categories.length === 0) {
        return {
          categories: [],
          count: 0,
          hasMore: false,
        }
      }

      const fuse = new Fuse(categories, {
        keys: ['name'],
        threshold: 0.3,
        includeScore: true,
      })

      const searchResults = fuse.search(search_query)

      const pagedResults = searchResults
        .sort((a, b) => (a.score || 0) - (b.score || 0))
        .slice(0, scaledLimit)
        .map((result) => result.item)

      return {
        categories: pagedResults,
        count: searchResults.length,
        hasMore: searchResults.length > scaledLimit,
      }
    }

    const hasMore = filteredCount > categories.length

    return {
      categories,
      count: filteredCount,
      hasMore,
    }
  }

  private async _populateCategoriesParentData(
    categories: CreateCategoriesDTO['categories'],
    userId: string,
    tempToRealIdMap: Record<string, string>,
  ): Promise<ICategoryCreatePopulated[]> {
    const uniqueBoardIds = Array.from(
      new Set(
        categories
          .filter((category) => tempToRealIdMap[category.board] || category.board)
          .map((category) => tempToRealIdMap[category.board] || category.board),
      ),
    )

    const boards = await this.boardService.getByCriteria(
      { ids: uniqueBoardIds },
      new Types.ObjectId(userId),
    )

    return categories.map((category) => {
      const board = boards.find(
        (b) => b.id.toString() === (tempToRealIdMap[category.board] || category.board),
      )

      return {
        ...toServerCaseKeys(category),
        id: category._id,
        workspace: {
          id: board!.workspace.id,
          name: board!.workspace.name,
        },
        board: {
          id: board!.id,
          name: board!.name,
        },
      }
    })
  }

  private _transformRawCreateToDTO(
    categoriesRaw: ICategoryCreatePopulated[],
    userId: string,
  ): (CategoryDTO & { id: string })[] {
    return categoriesRaw.map((category) => {
      return {
        id: category.id,
        name: category.name!,
        userId: new Types.ObjectId(userId),
        workspaceId: category.workspace!.id.toString(),
        boardId: category.board!.id.toString(),
      }
    })
  }

  private _transformRawUpdateToDTO(
    categoriesRaw: UpdateCategoriesDTO['updates'],
    tempToRealIdMap: Record<string, string>,
  ): CategoryEditManyDTO {
    return categoriesRaw.map((category) => {
      const update: CategoryEditDTO = {
        id: tempToRealIdMap[category._id] || category._id,
      }

      if (typeof category.name !== 'undefined') update.name = category.name
      if (typeof category.workspace !== 'undefined')
        update.workspaceId = tempToRealIdMap[category.workspace] || category.workspace
      if (typeof category.board !== 'undefined')
        update.boardId = tempToRealIdMap[category.board] || category.board

      return update
    })
  }

  public async createCategories(payload: DispatchPayload) {
    const { toolCall, config, tempToRealIdMap } = payload
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
      tempToRealIdMap,
    )

    let dtoCategories = this._transformRawCreateToDTO(populatedCategories, user.id.toString())

    if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
      const messages = await this.chatMessageService.getByCriteria(
        { pendingToolCallId: toolCallId, role: 'operation' },
        user.id,
      )

      if (messages.length > 0) {
        const logs = await this.operationLogService.getByCriteria(
          { id: messages[0].content },
          user.id,
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
          undefined,
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

    const createdCategories = await this.categoryService.createMany(dtoCategories, user)

    const logs = await this.operationLogService.getByCriteria(
      { id: createdCategories.logId!.toString() },
      user.id,
    )

    await dispatchCustomEvent(
      CustomEvents.OPERATION,
      {
        logId: logs[0].id,
        toolCallId: toolCallId,
      },
      config,
    )

    const tempToRealIdMapNew: Record<string, string> = {}

    for (let i = 0; i < createdCategories.data.length; i++) {
      tempToRealIdMapNew[args.categories[i]._id] = createdCategories.data[i].id.toString()
    }

    const resultInfo = createdCategories.data.map((category) => ({
      id: category.id,
      name: category.name,
    }))

    const resultMessage = `Successfully created ${createdCategories.data.length} categories: ${JSON.stringify(resultInfo)}`

    return new SuccessToolResult(resultMessage, {
      tempToRealIdMap: tempToRealIdMapNew,
    })
  }

  public async updateCategories(payload: DispatchPayload) {
    const { toolCall, config, tempToRealIdMap } = payload
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

    let dtoCategories = this._transformRawUpdateToDTO(args.updates, tempToRealIdMap)

    if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
      const messages = await this.chatMessageService.getByCriteria(
        { pendingToolCallId: toolCallId, role: 'operation' },
        user.id,
      )

      if (messages.length > 0) {
        const logs = await this.operationLogService.getByCriteria(
          { id: messages[0].content },
          user.id,
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
          undefined,
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
    )) as IResponseWithLog<ICategoryPopulated[]>
    const logs = await this.operationLogService.getByCriteria(
      { id: updatedCategories.logId!.toString() },
      user.id,
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

    const resultMessage = `Successfully updated ${updatedCategories.data.length} categories: ${JSON.stringify(resultInfo)}`

    return new SuccessToolResult(resultMessage)
  }

  public async moveCategory(payload: DispatchPayload) {
    const { toolCall, config, tempToRealIdMap } = payload
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
      id: tempToRealIdMap[args.id] || args.id,
      beforeCategoryId: args.before_category_id
        ? tempToRealIdMap[args.before_category_id] || args.before_category_id
        : undefined,
      afterCategoryId: args.after_category_id
        ? tempToRealIdMap[args.after_category_id] || args.after_category_id
        : undefined,
      newBoardId: args.new_board_id
        ? tempToRealIdMap[args.new_board_id] || args.new_board_id
        : undefined,
    }

    if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
      const messages = await this.chatMessageService.getByCriteria(
        { pendingToolCallId: toolCallId, role: 'operation' },
        user.id,
      )

      if (messages.length > 0) {
        const logs = await this.operationLogService.getByCriteria(
          { id: messages[0].content },
          user.id,
        )

        const log = logs[0]

        if (log.status === OperationLogStatusesEnum.CANCELLED) {
          return new SuccessToolResult('Category move cancelled by user.')
        }
      } else {
        const mockMoveCategory = await this.categoryService.move(dto, user, undefined, true)

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

    const result = await this.categoryService.move(dto, user)

    const logs = await this.operationLogService.getByCriteria(
      { id: result.logId!.toString() },
      user.id,
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

    const resultMessage = `Successfully moved ${result.data.length} categories: ${JSON.stringify(resultInfo)}`

    return new SuccessToolResult(resultMessage)
  }
}
