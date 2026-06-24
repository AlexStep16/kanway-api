import { FilterToMongoQueryService } from './FilterToMongoQueryService.js'
import { SelectionService } from './SelectionService.js'
import { ToolStatusLogLifecycleService } from './ToolStatusLogLifecycleService.js'
import { RunnableConfig } from '@langchain/core/runnables'
import { IConfigContext } from '../interfaces/IConfigContext.js'
import { ClientSession, Types } from 'mongoose'
import { WorkspaceService } from '@/application/services/WorkspaceService.js'
import { Configurable } from '../interfaces/Configurable.js'
import { ISearchEntitiesContent } from '@/application/interfaces/statuses/content/ISearchEntitiesContent.js'
import { StatusLog } from '@/application/types/StatusLog.js'
import { StatusTypesEnum } from '@/enums/StatusTypesEnum.js'
import { StatusStatesEnum } from '@/enums/StatusStatesEnum.js'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { CustomEvents } from '@/enums/CustomEvents.js'
import { EntityTypesEnum } from '@/domain/enums/EntityTypesEnum.js'
import { SuccessToolResult } from '../tools/helpers/ToolResult/SuccessToolResult.js'
import {
  transformRawUpdateToDTO,
  transformRawUpdateToHumanReadableFilters,
} from '../tools/helpers/UpdateWorkspacesHelpers.js'
import { AiConfirmationTypeEnum } from '@/domain/enums/AiConfirmationTypeEnum.js'
import { ConfirmationToolResult } from '../tools/helpers/ToolResult/ConfirmationToolResult.js'
import { FailedToolResult } from '../tools/helpers/ToolResult/FailedToolResult.js'
import { ITextValue } from '@/application/interfaces/statuses/content/ITextValue.js'
import WorkspaceRepository from '@/application/repositories/WorkspaceRepository.js'
import { SearchWorkspacesDTO } from '../tools/schemes/WorkspaceManager/SearchWorkspacesScheme.js'
import { SearchFilter } from '@/application/types/SearchFilter.js'
import { getSearchHumanReadableFilter } from '../tools/helpers/SearchTasksHumanReadableFilters.js'
import { UpdateWorkspacesDTO } from '../tools/schemes/WorkspaceManager/UpdateWorkspacesScheme.js'
import { DeleteArchiveWorkspacesDTO } from '../tools/schemes/WorkspaceManager/DeleteArchiveWorkspacesScheme.js'
import { CloneWorkspacesDTO } from '../tools/schemes/WorkspaceManager/CloneWorkspacesScheme.js'
import { RecoverWorkspacesDTO } from '../tools/schemes/WorkspaceManager/RecoverWorkspacesScheme.js'
import { MoveWorkspacesDTO } from '../tools/schemes/WorkspaceManager/MoveWorkspacesScheme.js'
import { ReorderWorkspacesDTO } from '../tools/schemes/WorkspaceManager/ReorderWorkspacesScheme.js'
import { IWorkspace } from '@/domain/entities/IWorkspace.js'
import { getWorkspaceColorHumanFilter } from '../tools/helpers/UpdateWorkspacesHelpers.js'
import { buildEntitySamples } from '../tools/helpers/EntitySamplesHelpers.js'
import { CreateWorkspacesDTO } from '../tools/schemes/WorkspaceManager/CreateWorkspacesScheme.js'
import { WorkspaceDTO } from '@/application/dtos/WorkspaceDTO.js'
import { BASE_COLORS } from '@/constants/BASE_COLORS.js'

export class WorkspaceToolsExecutorService {
  constructor(
    private workspaceRepository: WorkspaceRepository,

    private workspaceService: WorkspaceService,
    private filterToMongoQueryService: FilterToMongoQueryService,
    private selectionService: SelectionService,
    private toolStatusLogLifecycleService = new ToolStatusLogLifecycleService(),
  ) {}

  public async searchWorkspaces(
    payload: SearchWorkspacesDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const toolCall = context.toolCall!
    const configurable = config.configurable as Configurable
    const { filters, fields_to_include = [], sample_limit, offset } = payload

    const mongoQuery = await this.filterToMongoQueryService.prepare(
      filters,
      configurable.timezone,
      configurable.user.id,
      { entityType: 'workspace' },
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
        name: 'search_workspaces',
        content: toolContent,
      },
    }
    await dispatchCustomEvent(CustomEvents.STATUS_ADD_LOG, statusLog)

    try {
      const workspaces = await this.workspaceService.getByFilter(mongoQuery, session, {
        skip: offset,
        sort: { created_at: -1 },
      })
      const workspacesSample = buildEntitySamples(EntityTypesEnum.WORKSPACE, workspaces, {
        timezone: configurable.timezone,
        additionalFields: fields_to_include,
        limit: sample_limit,
      })
      const selection = await this.selectionService.create(
        {
          entityType: EntityTypesEnum.WORKSPACE,
          entityIds: workspaces.map((w) => w.id),
          humanReadableFilters,
          sample: workspacesSample,
          count: workspaces.length,
        },
        configurable.user.id,
        session,
      )

      statusLog.state = StatusStatesEnum.COMPLETED
      toolContent.ids = workspaces.map((w) => w.id.toString())

      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      const finalResponse: any = {
        selection_id: selection.id.toString(),
        sample: workspacesSample,
        count: workspaces.length,
        human_readable_filters: humanReadableFilters,
      }

      if (typeof sample_limit !== 'undefined') {
        finalResponse.sample_count = sample_limit
      }

      if (typeof offset !== 'undefined') {
        finalResponse.offset = offset
      }

      return new SuccessToolResult(JSON.stringify(finalResponse), {
        selections: [selection],
      })
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  public async updateWorkspaces(
    payload: UpdateWorkspacesDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const workspaceIds = await this._resolveWorkspaceIds(payload, configurable.user.id, session)
    const toolCall = context.toolCall!

    const humanReadableUpdates = transformRawUpdateToHumanReadableFilters(payload.updates)

    const statusLog = await this.toolStatusLogLifecycleService.getOrCreateInProgressLog({
      existingLog: context.statusLog,
      toolCallId: toolCall.id!,
      toolName: 'update_workspaces',
      toolContent: {
        count: workspaceIds.length,
        filters: humanReadableUpdates,
      },
    })

    try {
      const workspaces = await this.workspaceRepository.findByFilter<IWorkspace>(
        {
          _id: { $in: workspaceIds },
          user_id: configurable.user.id,
        },
        session,
        {
          limit: workspaceIds.length,
        },
      )

      const dtoWorkspaces = transformRawUpdateToDTO(workspaces, payload.updates)

      if (dtoWorkspaces.length === 0) {
        throw new Error('No workspaces to update')
      }

      let isDryRun = false

      if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
        if (context.isApproved === undefined) {
          isDryRun = true
        } else if (context.isApproved === false) {
          await this.toolStatusLogLifecycleService.setCancelled(statusLog)

          return new SuccessToolResult('Workspace update operation was rejected by the user.')
        }
      }

      const updateWorkspacesResult = await this.workspaceService.editMany(
        dtoWorkspaces,
        configurable.user,
        session,
        isDryRun,
      )

      if (updateWorkspacesResult.logId) {
        const operationLogId = updateWorkspacesResult.logId.toString()

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
          `Successfully updated ${updateWorkspacesResult.data.length} workspaces. Operation Log ID: ${operationLogId}`,
          {
            logId: operationLogId,
          },
        )
      }

      return new FailedToolResult('Failed to create operation log for workspaces update.')
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  public async createWorkspaces(
    payload: CreateWorkspacesDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const toolCall = context.toolCall!

    const statusLog = await this.toolStatusLogLifecycleService.getOrCreateInProgressLog({
      existingLog: context.statusLog,
      toolCallId: toolCall.id!,
      toolName: 'create_workspaces',
      toolContent: {
        count: payload.workspaces.length,
      },
    })

    try {
      const dtoWorkspaces: WorkspaceDTO[] = payload.workspaces.map((workspace) => ({
        name: workspace.name,
        color: (workspace.color ?? BASE_COLORS[0]) as WorkspaceDTO['color'],
        isFavorite: workspace.is_favorite,
      }))

      if (dtoWorkspaces.length === 0) {
        throw new Error('No workspaces to create')
      }

      let isDryRun = false

      if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
        if (context.isApproved === undefined) {
          isDryRun = true
        } else if (context.isApproved === false) {
          await this.toolStatusLogLifecycleService.setCancelled(statusLog)

          return new SuccessToolResult('Workspace create operation was rejected by the user.')
        }
      }

      const createWorkspacesResult = await this.workspaceService.createMany(
        dtoWorkspaces,
        configurable.user,
        session,
        isDryRun,
      )

      if (createWorkspacesResult.logId) {
        const operationLogId = createWorkspacesResult.logId.toString()

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
          content.count = createWorkspacesResult.data.length
          content.logId = operationLogId
        })

        const createdSamples = createWorkspacesResult.data.map((workspace) => ({
          id: workspace.id.toString(),
          name: workspace.name,
        }))

        return new SuccessToolResult(
          `Successfully created workspaces: ${JSON.stringify(createdSamples)}. Operation Log ID: ${operationLogId}`,
          {
            logId: operationLogId,
          },
        )
      }

      return new FailedToolResult('Failed to create operation log for workspaces create.')
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  private async _resolveWorkspaceIds(
    payload: {
      selection_id?: string
      workspace_ids?: string[]
    },
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<string[]> {
    let workspaceIds: string[] = []

    if (!payload.workspace_ids && !payload.selection_id) {
      throw new Error('Either workspace_ids or selection_id must be provided')
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

      workspaceIds = selection.entityIds.map((id) => id.toString())
    }

    if (payload.workspace_ids) {
      payload.workspace_ids.forEach((id) => {
        if (!Types.ObjectId.isValid(id)) {
          throw new Error(`Invalid workspace id: ${id}`)
        }
      })

      workspaceIds = Array.from(new Set(payload.workspace_ids))
    }

    if (workspaceIds.length === 0) {
      throw new Error('No workspaces to update')
    }

    return workspaceIds
  }

  private async _resolveHumanReadableFilters(
    payload: {
      selection_id?: string
      workspace_ids?: string[]
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

    if (payload.workspace_ids) {
      payload.workspace_ids.forEach((id) => {
        if (!Types.ObjectId.isValid(id)) {
          throw new Error(`Invalid workspace id: ${id}`)
        }
      })

      const workspaces = await this.workspaceService.getByCriteria(
        { ids: payload.workspace_ids },
        userId,
        session,
      )

      return workspaces.map((workspace) => ({
        text: 'Название',
        value: workspace.name,
      }))
    }

    return []
  }

  public async deleteArchiveWorkspaces(
    payload: DeleteArchiveWorkspacesDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const workspaceIds = await this._resolveWorkspaceIds(payload, configurable.user.id, session)
    const humanReadableFilters = await this._resolveHumanReadableFilters(
      payload,
      configurable.user.id,
      session,
    )
    const toolCall = context.toolCall!

    const mainFunction = payload.soft_delete
      ? this.workspaceService.archive.bind(this.workspaceService)
      : this.workspaceService.delete.bind(this.workspaceService)

    const statusLog = await this.toolStatusLogLifecycleService.getOrCreateInProgressLog({
      existingLog: context.statusLog,
      toolCallId: toolCall.id!,
      toolName: 'delete_archive_workspaces',
      toolContent: {
        count: workspaceIds.length,
        filters: humanReadableFilters,
        isSoftDelete: payload.soft_delete,
      },
    })

    const actionString = payload.soft_delete ? 'archived' : 'deleted'

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

          return new SuccessToolResult(
            `Workspace ${actionString} operation was rejected by the user. The user decided not to proceed with ${actionString}. Do not attempt to ${actionString} the workspaces again.`,
          )
        }
      }

      const result = await mainFunction(
        {
          ids: workspaceIds,
        },
        configurable.user,
        session,
        isDryRun,
      )

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

        let workspacesProcessedCount = 0

        if (result.data && typeof result.data === 'object' && 'deletedCount' in result.data) {
          const deletedCount = (result.data as { deletedCount?: unknown }).deletedCount
          workspacesProcessedCount = typeof deletedCount === 'number' ? deletedCount : 0
        } else if (result.data && Array.isArray(result.data)) {
          workspacesProcessedCount = result.data.length
        } else if (result.data === null && !payload.soft_delete) {
          workspacesProcessedCount = workspaceIds.length
        } else {
          return new FailedToolResult(`No workspaces were ${actionString} by the operation.`)
        }

        return new SuccessToolResult(
          `Successfully ${actionString} ${workspacesProcessedCount} workspaces. Operation Log ID: ${operationLogId}`,
          {
            logId: operationLogId,
          },
        )
      }

      return new FailedToolResult(`Failed to create operation log for workspaces ${actionString}.`)
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  public async cloneWorkspaces(
    payload: CloneWorkspacesDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const workspaceIds = await this._resolveWorkspaceIds(payload, configurable.user.id, session)
    const humanReadableFilters = await this._resolveHumanReadableFilters(
      payload,
      configurable.user.id,
      session,
    )
    const toolCall = context.toolCall!

    const statusLog = await this.toolStatusLogLifecycleService.getOrCreateInProgressLog({
      existingLog: context.statusLog,
      toolCallId: toolCall.id!,
      toolName: 'clone_workspaces',
      toolContent: {
        count: workspaceIds.length,
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

          return new SuccessToolResult('Workspace clone operation was rejected by the user.')
        }
      }

      const cloneWorkspacesResult = await this.workspaceService.clone(
        {
          ids: workspaceIds,
        },
        configurable.user,
        session,
        isDryRun,
      )

      if (cloneWorkspacesResult.logId) {
        const operationLogId = cloneWorkspacesResult.logId.toString()

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
          `Successfully cloned ${cloneWorkspacesResult.data.length} workspaces. Operation Log ID: ${operationLogId}`,
          {
            logId: operationLogId,
          },
        )
      }

      return new FailedToolResult('Failed to create operation log for workspaces clone.')
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  public async recoverWorkspaces(
    payload: RecoverWorkspacesDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const workspaceIds = await this._resolveWorkspaceIds(payload, configurable.user.id, session)
    const humanReadableFilters = await this._resolveHumanReadableFilters(
      payload,
      configurable.user.id,
      session,
    )
    const toolCall = context.toolCall!

    const statusLog = await this.toolStatusLogLifecycleService.getOrCreateInProgressLog({
      existingLog: context.statusLog,
      toolCallId: toolCall.id!,
      toolName: 'recover_workspaces',
      toolContent: {
        count: workspaceIds.length,
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

          return new SuccessToolResult('Workspace recover operation was rejected by the user.')
        }
      }

      const recoverWorkspacesResult = await this.workspaceService.recover(
        {
          ids: workspaceIds,
        },
        configurable.user,
        session,
        isDryRun,
      )

      if (recoverWorkspacesResult.logId) {
        const operationLogId = recoverWorkspacesResult.logId.toString()

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
          `Successfully recovered ${recoverWorkspacesResult.data.length} workspaces. Operation Log ID: ${operationLogId}`,
          {
            logId: operationLogId,
          },
        )
      }

      return new FailedToolResult('Failed to create operation log for workspaces recover.')
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  private async _resolveMoveHumanReadableFilters(
    payload: MoveWorkspacesDTO,
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

    const anchorWorkspaceIds = Array.from(
      new Set([payload.beforeWorkspaceId, payload.afterWorkspaceId].filter(Boolean) as string[]),
    )
    const anchorWorkspaceNamesById = new Map<string, string>()

    if (anchorWorkspaceIds.length > 0) {
      const anchorWorkspaces = await this.workspaceService.getByCriteria(
        { ids: anchorWorkspaceIds },
        userId,
        session,
      )

      anchorWorkspaces.forEach((workspace) => {
        anchorWorkspaceNamesById.set(workspace.id.toString(), workspace.name)
      })
    }

    if (payload.beforeWorkspaceId) {
      filters.push({
        text: 'Перед рабочим пространством',
        value: anchorWorkspaceNamesById.get(payload.beforeWorkspaceId) ?? payload.beforeWorkspaceId,
      })
    }

    if (payload.afterWorkspaceId) {
      filters.push({
        text: 'После рабочего пространства',
        value: anchorWorkspaceNamesById.get(payload.afterWorkspaceId) ?? payload.afterWorkspaceId,
      })
    }

    return filters
  }

  private async _resolveReorderHumanReadableFilters(
    payload: ReorderWorkspacesDTO,
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<ITextValue[]> {
    const filters: ITextValue[] = []
    const newNames: string[] = []
    const workspaceNamesMap = new Map<string, string>()

    if (payload.workspace_ids && payload.workspace_ids.length > 0) {
      const workspaces = await this.workspaceService.getByCriteria(
        { ids: payload.workspace_ids },
        userId,
        session,
      )

      workspaces.forEach((workspace) => {
        workspaceNamesMap.set(workspace.id.toString(), workspace.name)
      })
    }

    payload.workspace_ids.forEach((id) => {
      const name = workspaceNamesMap.get(id) ?? id
      newNames.push(name)
    })

    filters.push({
      text: 'Новый порядок пространств',
      value: newNames.join(', '),
    })

    return filters
  }

  public async moveWorkspaces(
    payload: MoveWorkspacesDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const workspaceIds = await this._resolveWorkspaceIds(payload, configurable.user.id, session)
    const humanReadableFilters = await this._resolveMoveHumanReadableFilters(
      payload,
      configurable.user.id,
      session,
    )
    const toolCall = context.toolCall!

    const statusLog = await this.toolStatusLogLifecycleService.getOrCreateInProgressLog({
      existingLog: context.statusLog,
      toolCallId: toolCall.id!,
      toolName: 'move_workspaces',
      toolContent: {
        count: workspaceIds.length,
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

          return new SuccessToolResult('Workspace move operation was rejected by the user.')
        }
      }

      const moveWorkspacesResult = await this.workspaceService.moveMany(
        {
          ids: workspaceIds,
          beforeWorkspaceId: payload.beforeWorkspaceId,
          afterWorkspaceId: payload.afterWorkspaceId,
          toStart: payload.toStart,
          toEnd: payload.toEnd,
        },
        configurable.user,
        session,
        isDryRun,
      )

      if (moveWorkspacesResult.logId) {
        const operationLogId = moveWorkspacesResult.logId.toString()

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
          `Successfully moved ${moveWorkspacesResult.data.length} workspaces. Operation Log ID: ${operationLogId}`,
          {
            logId: operationLogId,
          },
        )
      }

      return new FailedToolResult('Failed to create operation log for workspaces move.')
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  public async reorderWorkspaces(
    payload: ReorderWorkspacesDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const workspaceIds = await this._resolveWorkspaceIds(
      { workspace_ids: payload.workspace_ids },
      configurable.user.id,
      session,
    )
    const humanReadableFilters = await this._resolveReorderHumanReadableFilters(
      payload,
      configurable.user.id,
      session,
    )
    const toolCall = context.toolCall!

    const statusLog = await this.toolStatusLogLifecycleService.getOrCreateInProgressLog({
      existingLog: context.statusLog,
      toolCallId: toolCall.id!,
      toolName: 'reorder_workspaces',
      toolContent: {
        count: workspaceIds.length,
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

          return new SuccessToolResult('Workspace reorder operation was rejected by the user.')
        }
      }

      const reorderWorkspacesResult = await this.workspaceService.reorder(
        {
          ids: workspaceIds,
        },
        configurable.user,
        session,
        isDryRun,
      )

      if (reorderWorkspacesResult.logId) {
        const operationLogId = reorderWorkspacesResult.logId.toString()

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
          `Successfully reordered ${reorderWorkspacesResult.data.length} workspaces. Operation Log ID: ${operationLogId}`,
          {
            logId: operationLogId,
          },
        )
      }

      return new FailedToolResult('Failed to create operation log for workspaces reorder.')
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
          const { field, ...operator } = filter

          if (field === 'color') return getWorkspaceColorHumanFilter(operator)

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
