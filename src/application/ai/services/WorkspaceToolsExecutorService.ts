import { Configurable } from '@/application/ai/interfaces/Configurable.ts'
import { AiConfirmationTypeEnum } from '@/domain/enums/AiConfirmationTypeEnum.ts'
import { CustomEvents } from '@/enums/CustomEvents.ts'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import Fuse from 'fuse.js'
import { ClientSession, FilterQuery, Types } from 'mongoose'
import { ConfirmationEntityToolResult } from '../tools/helpers/ConfirmationEntityToolResult.ts'
import { SuccessToolResult } from '../tools/helpers/SuccessToolResult.ts'
import { FailedToolResult } from '../tools/helpers/FailedToolResult.ts'
import z from 'zod'
import { OperationLogService } from '@/application/services/OperationLogService.ts'
import { OperationLogStatusesEnum } from '@/domain/enums/OperationLogStatusesEnum.ts'
import { IResponseWithLog } from '@/application/interfaces/IResponseWithLog.ts'
import { ChatMessageService } from '@/application/services/ChatMessageService.ts'
import { AbstractToolExecutor } from './AbstractToolExecutor.ts'
import { WorkspaceService } from '@/application/services/WorkspaceService.ts'
import WorkspaceRepository from '@/application/repositories/WorkspaceRepository.ts'
import { IWorkspaceRawString } from '@/domain/entities/IWorkspaceRawString.ts'
import { IWorkspace } from '@/domain/entities/IWorkspace.ts'
import { CreateWorkspacesDTO, CreateWorkspacesDTOSchema } from '../dtos/CreateWorkspacesDTO.ts'
import { WorkspaceDTO } from '@/application/dtos/WorkspaceDTO.ts'
import { UpdateWorkspacesDTO, UpdateWorkspacesDTOSchema } from '../dtos/UpdateWorkspacesDTO.ts'
import { WorkspaceEditDTO } from '@/application/dtos/WorkspaceEditDTO.ts'
import { WorkspaceEditManyDTO } from '@/application/dtos/WorkspaceEditManyDTO.ts'
import { MoveWorkspaceDTO, MoveWorkspaceDTOSchema } from '../dtos/MoveWorkspaceDTO.ts'
import { WorkspaceMoveDTO } from '@/application/dtos/WorkspaceMoveDTO.ts'
import { DispatchPayload } from './ToolDispatcherService.ts'
import { VectorSearchService } from '@/application/services/VectorSearchService.ts'
import { findProperty } from '@/utils/findProperty.ts'

export class WorkspaceToolsExecutorService extends AbstractToolExecutor {
  constructor(
    private workspaceRepository: WorkspaceRepository,

    private workspaceService: WorkspaceService,
    private operationLogService: OperationLogService,
    private chatMessageService: ChatMessageService,
    private vectorSearchService: VectorSearchService,
  ) {
    super()

    this.toolRegistry = {
      search_workspaces: this.searchWorkspaces.bind(this),
      create_workspaces: this.createWorkspaces.bind(this),
      update_workspaces: this.updateWorkspaces.bind(this),
      move_workspace: this.moveWorkspace.bind(this),
      delete_workspaces: this.deleteWorkspaces.bind(this),
      archive_workspaces: this.archiveWorkspaces.bind(this),
      recover_workspaces: this.recoverWorkspaces.bind(this),
      clone_workspaces: this.cloneWorkspaces.bind(this),
    }
  }

  public async searchWorkspaces(payload: DispatchPayload, session?: ClientSession) {
    const HARD_SEARCH_LIMIT = 2000

    const { toolCall, userId } = payload
    const args = toolCall.args as {
      mongo_filter?: FilterQuery<IWorkspaceRawString>
      search_query?: string
      search_mode?: 'fuzzy' | 'semantic'
      limit?: number
    }

    const { mongo_filter = {}, search_query = '', search_mode = 'fuzzy', limit = 50 } = args

    const scaledLimit = search_query ? HARD_SEARCH_LIMIT : limit

    const isMongoFilterHasDeletedCondition =
      findProperty(mongo_filter, 'is_deleted') !== undefined ||
      findProperty(mongo_filter, 'is_deleted_external') !== undefined

    const baseFilter: FilterQuery<IWorkspaceRawString> = isMongoFilterHasDeletedCondition
      ? {}
      : {
          is_deleted: { $ne: true },
          is_deleted_external: { $ne: true },
        }

    const unionFilter = { ...baseFilter, ...mongo_filter, user_id: new Types.ObjectId(userId) }

    const filteredCount = await this.workspaceRepository.getCountByFilter(unionFilter, session)

    const workspaces = await this.workspaceRepository.findByFilter<IWorkspaceRawString>(
      unionFilter,
      session,
      {
        isMongoCase: true,
        limit: scaledLimit,
        sort: { rank: 1 },
      },
    )

    if (search_query) {
      if (workspaces.length === 0) {
        return {
          items: [],
          count: 0,
          hasMore: false,
        }
      }

      let pagedResults: IWorkspaceRawString[] = []
      let searchedCount = 0

      if (search_mode === 'fuzzy') {
        const fuse = new Fuse(workspaces, {
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
        const filteredIds = workspaces.map((workspace) => new Types.ObjectId(workspace._id))

        const semanticWorkspaces = await this.vectorSearchService.similaritySearchWorkspaces(
          [search_query],
          new Types.ObjectId(userId),
          20,
          filteredIds,
        )
        const semanticWorkspaceIds = semanticWorkspaces.map((workspace) => workspace.id.toString())

        pagedResults = workspaces.filter((workspace) =>
          semanticWorkspaceIds.includes(workspace._id.toString()),
        )
        searchedCount = semanticWorkspaces.length
      }

      return {
        items: pagedResults,
        count: searchedCount,
        hasMore: searchedCount > scaledLimit,
      }
    }

    const hasMore = filteredCount > workspaces.length

    return {
      items: workspaces,
      count: filteredCount,
      hasMore,
    }
  }

  private _transformRawCreateToDTO(
    workspaces: CreateWorkspacesDTO['workspaces'],
    userId: string,
  ): (WorkspaceDTO & { id: string })[] {
    return workspaces.map((workspace) => {
      return {
        id: workspace._id,
        name: workspace.name!,
        userId: new Types.ObjectId(userId),
        color: workspace.color,
        isFavorite: workspace.is_favorite || false,
      }
    })
  }

  private _transformRawUpdateToDTO(
    workspaces: UpdateWorkspacesDTO['updates'],
  ): WorkspaceEditManyDTO {
    return workspaces.map((workspace) => {
      const update: WorkspaceEditDTO = {
        id: workspace._id,
      }

      if (typeof workspace.name !== 'undefined') update.name = workspace.name
      if (typeof workspace.is_favorite !== 'undefined') update.isFavorite = workspace.is_favorite
      if (typeof workspace.color !== 'undefined') update.color = workspace.color

      return update
    })
  }

  public async createWorkspaces(payload: DispatchPayload, session?: ClientSession) {
    const { toolCall, config } = payload
    const args = toolCall.args as CreateWorkspacesDTO
    const toolCallId = toolCall.id

    const configurable = config.configurable as Configurable
    const user = configurable.user

    const validationResult = CreateWorkspacesDTOSchema.safeParse(args)

    if (!validationResult.success) {
      return new FailedToolResult(
        `Validation Error: Invalid arguments. \n${z.prettifyError(
          validationResult.error,
        )}. \nPlease fix the arguments and try again.`,
      )
    }

    let dtoWorkspaces = this._transformRawCreateToDTO(args.workspaces, user.id.toString())

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
          return new SuccessToolResult('Workspace creation cancelled by user.')
        } else if (log.status === OperationLogStatusesEnum.APPROVED) {
          const selectedIds = log.selectedIds || []

          dtoWorkspaces = dtoWorkspaces.filter((workspace) => selectedIds.includes(workspace.id))
        } else {
          return new FailedToolResult('Workspace creation pending user confirmation.')
        }
      } else {
        const mockCreateWorkspaces = await this.workspaceService.createMany(
          dtoWorkspaces,
          user,
          session,
          true,
        )

        if (mockCreateWorkspaces.logId) {
          return new ConfirmationEntityToolResult({
            toolCallId: toolCallId,
            logId: mockCreateWorkspaces.logId.toString(),
          })
        } else return new FailedToolResult('Failed to create operation log for workspace creation.')
      }
    }

    await dispatchCustomEvent(
      CustomEvents.STEP_ADD,
      {
        id: new Types.ObjectId().toString(),
        name: 'Создаю рабочие пространства',
      },
      config,
    )

    const result = await this.workspaceService.createMany(dtoWorkspaces, user, session)

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

    const resultInfo = result.data.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
    }))

    const resultMessage = `
      Successfully created ${result.data.length} workspaces: ${JSON.stringify(resultInfo)}
      Log ID: ${result.logId}
    `

    return new SuccessToolResult(resultMessage)
  }

  public async updateWorkspaces(payload: DispatchPayload, session?: ClientSession) {
    const { toolCall, config } = payload
    const args = toolCall.args as UpdateWorkspacesDTO
    const toolCallId = toolCall.id

    const configurable = config.configurable as Configurable
    const user = configurable.user

    const validationResult = UpdateWorkspacesDTOSchema.safeParse(args)

    if (!validationResult.success) {
      return new FailedToolResult(
        `Validation Error: Invalid arguments. \n${z.prettifyError(
          validationResult.error,
        )}. \nPlease fix the arguments and try again.`,
      )
    }

    let dtoWorkspaces = this._transformRawUpdateToDTO(args.updates)

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
          return new SuccessToolResult('Workspace update cancelled by user.')
        } else if (log.status === OperationLogStatusesEnum.APPROVED) {
          const selectedIds = log.selectedIds || []

          dtoWorkspaces = dtoWorkspaces.filter((workspace) => selectedIds.includes(workspace.id))
        }
      } else {
        const mockUpdateWorkspaces = await this.workspaceService.editMany(
          dtoWorkspaces,
          user,
          session,
          true,
        )

        if (mockUpdateWorkspaces.logId) {
          return new ConfirmationEntityToolResult({
            toolCallId: toolCallId,
            logId: mockUpdateWorkspaces.logId.toString(),
          })
        } else return new FailedToolResult('Failed to create operation log for workspace update.')
      }
    }

    await dispatchCustomEvent(
      CustomEvents.STEP_ADD,
      {
        id: new Types.ObjectId().toString(),
        name: 'Обновляю рабочие пространства',
      },
      config,
    )

    const result = (await this.workspaceService.editMany(
      dtoWorkspaces,
      user,
      session,
    )) as IResponseWithLog<IWorkspace[]>
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
      Successfully updated ${result.data.length} workspaces: ${JSON.stringify(resultInfo)}
      Log ID: ${result.logId}
    `

    return new SuccessToolResult(resultMessage)
  }

  public async moveWorkspace(payload: DispatchPayload, session?: ClientSession) {
    const { toolCall, config } = payload
    const args = toolCall.args as MoveWorkspaceDTO
    const toolCallId = toolCall.id

    const configurable = config.configurable as Configurable
    const user = configurable.user

    const validationResult = MoveWorkspaceDTOSchema.safeParse(args)

    if (!validationResult.success) {
      return new FailedToolResult(
        `Validation Error: Invalid arguments. \n${z.prettifyError(
          validationResult.error,
        )}. \nPlease fix the arguments and try again.`,
      )
    }

    const dto: WorkspaceMoveDTO = {
      id: args.id,
      beforeId: args.before_id ? args.before_id : undefined,
      afterId: args.after_id ? args.after_id : undefined,
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
          return new SuccessToolResult('Workspace move cancelled by user.')
        }
      } else {
        const mockMoveWorkspace = await this.workspaceService.move(dto, user, session, true)

        if (mockMoveWorkspace.logId) {
          return new ConfirmationEntityToolResult({
            toolCallId: toolCallId,
            logId: mockMoveWorkspace.logId.toString(),
          })
        } else return new FailedToolResult('Failed to create operation log for workspace move.')
      }
    }

    await dispatchCustomEvent(
      CustomEvents.STEP_ADD,
      {
        id: new Types.ObjectId().toString(),
        name: 'Перемещаю рабочие пространства',
      },
      config,
    )

    const result = await this.workspaceService.move(dto, user, session)

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
      Successfully updated ${result.data.length} workspaces: ${JSON.stringify(resultInfo)}
      Log ID: ${result.logId}
    `

    return new SuccessToolResult(resultMessage)
  }

  public async deleteWorkspaces(payload: DispatchPayload, session?: ClientSession) {
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
          return new SuccessToolResult('Workspace delete cancelled by user.')
        } else if (log.status === OperationLogStatusesEnum.APPROVED) {
          const selectedIds = log.selectedIds || []

          args.ids = args.ids.filter((id) => selectedIds.includes(id))
        }
      } else {
        const mockDeleteWorkspace = await this.workspaceService.delete(
          {
            ids: args.ids,
          },
          user,
          session,
          true,
        )

        if (mockDeleteWorkspace.logId) {
          return new ConfirmationEntityToolResult({
            toolCallId: toolCallId,
            logId: mockDeleteWorkspace.logId.toString(),
          })
        } else return new FailedToolResult('Failed to create operation log for workspace delete.')
      }
    }

    await dispatchCustomEvent(
      CustomEvents.STEP_ADD,
      {
        id: new Types.ObjectId().toString(),
        name: 'Удаляю рабочие пространства',
      },
      config,
    )

    const result = await this.workspaceService.delete(
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
        logId: result.logId,
        toolCallId: toolCallId,
      },
      config,
    )

    const resultInfo = (logs[0].entitiesBefore || []).map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
    }))

    const resultMessage = `
      Successfully deleted ${resultInfo.length} workspaces: ${JSON.stringify(resultInfo)}
      Log ID: ${result.logId}
    `

    return new SuccessToolResult(resultMessage)
  }

  public async archiveWorkspaces(payload: DispatchPayload, session?: ClientSession) {
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
          return new SuccessToolResult('Workspaces archive cancelled by user.')
        } else if (log.status === OperationLogStatusesEnum.APPROVED) {
          const selectedIds = log.selectedIds || []

          args.ids = args.ids.filter((id) => selectedIds.includes(id))
        }
      } else {
        const mockArchiveWorkspace = await this.workspaceService.archive(
          {
            ids: args.ids,
          },
          user,
          session,
          true,
        )

        if (mockArchiveWorkspace.logId) {
          return new ConfirmationEntityToolResult({
            toolCallId: toolCallId,
            logId: mockArchiveWorkspace.logId.toString(),
          })
        } else return new FailedToolResult('Failed to create operation log for workspace archive.')
      }
    }

    await dispatchCustomEvent(
      CustomEvents.STEP_ADD,
      {
        id: new Types.ObjectId().toString(),
        name: 'Архивирую рабочие пространства',
      },
      config,
    )

    const result = await this.workspaceService.archive(
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

    const resultInfo = (logs[0].entitiesAfter || []).map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
    }))

    const resultMessage = `
      Successfully archived ${result.data.length} workspaces: ${JSON.stringify(resultInfo)}
      Log ID: ${result.logId}
    `

    return new SuccessToolResult(resultMessage)
  }

  public async recoverWorkspaces(payload: DispatchPayload, session?: ClientSession) {
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
          return new SuccessToolResult('Workspaces recovery cancelled by user.')
        } else if (log.status === OperationLogStatusesEnum.APPROVED) {
          const selectedIds = log.selectedIds || []

          args.ids = args.ids.filter((id) => selectedIds.includes(id))
        }
      } else {
        const mockRecoverWorkspace = await this.workspaceService.recover(
          {
            ids: args.ids,
          },
          user,
          session,
          true,
        )

        if (mockRecoverWorkspace.logId) {
          return new ConfirmationEntityToolResult({
            toolCallId: toolCallId,
            logId: mockRecoverWorkspace.logId.toString(),
          })
        } else return new FailedToolResult('Failed to create operation log for workspace recovery.')
      }
    }

    await dispatchCustomEvent(
      CustomEvents.STEP_ADD,
      {
        id: new Types.ObjectId().toString(),
        name: 'Восстанавливаю рабочие пространства',
      },
      config,
    )

    const result = await this.workspaceService.recover(
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

    const resultInfo = (logs[0].entitiesAfter || []).map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
    }))

    const resultMessage = `
      Successfully recovered ${result.data.length} workspaces: ${JSON.stringify(resultInfo)}
      Log ID: ${result.logId}
    `

    return new SuccessToolResult(resultMessage)
  }

  public async cloneWorkspaces(payload: DispatchPayload, session?: ClientSession) {
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
          return new SuccessToolResult('Workspaces clone cancelled by user.')
        } else if (log.status === OperationLogStatusesEnum.APPROVED) {
          const selectedIds = log.selectedIds || []

          args.ids = args.ids.filter((id) => selectedIds.includes(id))
        }
      } else {
        const mockCloneWorkspace = await this.workspaceService.clone(
          {
            ids: args.ids,
          },
          user,
          session,
          true,
          args.tempIds,
        )

        if (mockCloneWorkspace.logId) {
          return new ConfirmationEntityToolResult({
            toolCallId: toolCallId,
            logId: mockCloneWorkspace.logId.toString(),
          })
        } else return new FailedToolResult('Failed to create operation log for workspace clone.')
      }
    }

    await dispatchCustomEvent(
      CustomEvents.STEP_ADD,
      {
        id: new Types.ObjectId().toString(),
        name: 'Копирую рабочие пространства',
      },
      config,
    )

    const result = await this.workspaceService.clone(
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
        logId: result.logId,
        toolCallId: toolCallId,
      },
      config,
    )

    const resultInfo = (logs[0].entitiesAfter || []).map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
    }))

    const resultMessage = `
      Successfully cloned ${result.data.length} workspaces: ${JSON.stringify(resultInfo)}
      Log ID: ${result.logId}
    `

    return new SuccessToolResult(resultMessage)
  }
}
