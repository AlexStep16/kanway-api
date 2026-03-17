import { Configurable } from '@/application/ai/interfaces/Configurable.ts'
import { AiConfirmationTypeEnum } from '@/domain/enums/AiConfirmationTypeEnum.ts'
import { CustomEvents } from '@/enums/CustomEventsNew.ts'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import Fuse from 'fuse.js'
import { FilterQuery, Types } from 'mongoose'
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

export class WorkspaceToolsExecutorService extends AbstractToolExecutor {
  constructor(
    private workspaceRepository: WorkspaceRepository,

    private workspaceService: WorkspaceService,
    private operationLogService: OperationLogService,
    private chatMessageService: ChatMessageService,
  ) {
    super()

    this.toolRegistry = {
      search_workspaces: this.searchWorkspaces.bind(this),
      create_workspaces: this.createWorkspaces.bind(this),
      update_workspaces: this.updateWorkspaces.bind(this),
    }
  }

  public async searchWorkspaces(
    _id: string,
    args: {
      mongo_filter?: FilterQuery<IWorkspaceRawString>
      search_query?: string
      limit?: number
    },
    userId: string,
  ) {
    const HARD_SEARCH_LIMIT = 2000

    const { mongo_filter = {}, search_query = '', limit = 50 } = args

    const scaledLimit = search_query ? HARD_SEARCH_LIMIT : limit

    const baseFilter: FilterQuery<IWorkspaceRawString> = {
      is_deleted: { $ne: true },
      is_deleted_external: { $ne: true },
    }

    const unionFilter = { ...baseFilter, ...mongo_filter, user_id: new Types.ObjectId(userId) }

    const filteredCount = await this.workspaceRepository.getCountByFilter(unionFilter)

    const workspaces = await this.workspaceRepository.findByFilter<IWorkspaceRawString>(
      unionFilter,
      undefined,
      {
        isMongoCase: true,
        limit: scaledLimit,
      },
    )

    if (search_query) {
      if (workspaces.length === 0) {
        return {
          workspaces: [],
          count: 0,
          hasMore: false,
        }
      }

      const fuse = new Fuse(workspaces, {
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
        workspaces: pagedResults,
        count: searchResults.length,
        hasMore: searchResults.length > scaledLimit,
      }
    }

    const hasMore = filteredCount > workspaces.length

    return {
      workspaces,
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
        id: workspace.id,
        name: workspace.name!,
        order: workspace.order,
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
      if (typeof workspace.order !== 'undefined') update.order = Math.min(workspace.order, 1)
      if (typeof workspace.is_favorite !== 'undefined') update.isFavorite = workspace.is_favorite
      if (typeof workspace.color !== 'undefined') update.color = workspace.color

      return update
    })
  }

  public async createWorkspaces(
    id: string,
    args: CreateWorkspacesDTO,
    _userId: string,
    config: Record<string, any>,
  ) {
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
        { pendingToolCallId: id, role: 'operation' },
        user.id,
      )

      if (messages.length > 0) {
        const logs = await this.operationLogService.getByCriteria(
          { id: messages[0].content },
          user.id,
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
          undefined,
          true,
        )

        if (mockCreateWorkspaces.logId) {
          return new ConfirmationEntityToolResult({
            toolCallId: id,
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

    const createdWorkspaces = await this.workspaceService.createMany(dtoWorkspaces, user)

    const logs = await this.operationLogService.getByCriteria(
      { id: createdWorkspaces.logId!.toString() },
      user.id,
    )

    await dispatchCustomEvent(
      CustomEvents.OPERATION,
      {
        logId: logs[0].id,
        toolCallId: id,
      },
      config,
    )

    return new SuccessToolResult(
      `Successfully created ${createdWorkspaces.data.length} workspaces.`,
    )
  }

  public async updateWorkspaces(
    id: string,
    args: UpdateWorkspacesDTO,
    _userId: string,
    config: Record<string, any>,
  ) {
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
        { pendingToolCallId: id, role: 'operation' },
        user.id,
      )

      if (messages.length > 0) {
        const logs = await this.operationLogService.getByCriteria(
          { id: messages[0].content },
          user.id,
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
          undefined,
          true,
        )

        if (mockUpdateWorkspaces.logId) {
          return new ConfirmationEntityToolResult({
            toolCallId: id,
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

    const updatedWorkspaces = (await this.workspaceService.editMany(
      dtoWorkspaces,
      user,
    )) as IResponseWithLog<IWorkspace[]>
    const logs = await this.operationLogService.getByCriteria(
      { id: updatedWorkspaces.logId!.toString() },
      user.id,
    )

    await dispatchCustomEvent(
      CustomEvents.OPERATION,
      {
        logId: logs[0].id,
        toolCallId: id,
      },
      config,
    )

    return new SuccessToolResult(
      `Successfully updated ${updatedWorkspaces.data.length} workspaces.`,
    )
  }
}
