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
import { IWorkspace } from '@/domain/entities/IWorkspace.js'
import { getWorkspaceColorHumanFilter } from '../tools/helpers/UpdateWorkspacesHelpers.js'
import { buildEntitySamples } from '../tools/helpers/EntitySamplesHelpers.js'

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
    const { filters, fields_to_include = [] } = payload

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
      const workspaces = await this.workspaceService.getByFilter(mongoQuery, session)
      const workspacesSample = buildEntitySamples(EntityTypesEnum.WORKSPACE, workspaces, {
        timezone: configurable.timezone,
        additionalFields: fields_to_include,
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

      return new SuccessToolResult(
        JSON.stringify({
          selection_id: selection.id.toString(),
          sample: workspacesSample,
          count: workspaces.length,
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
        ids: Array.from(new Set(workspaceIds)),
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
        ids: Array.from(new Set(workspaceIds)),
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

          return new SuccessToolResult('Workspace update operation was rejected by the user.')
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

        let workspacesProcessedCount = 0

        if (result.data && typeof result.data === 'object' && 'deletedCount' in result.data) {
          const deletedCount = (result.data as { deletedCount?: unknown }).deletedCount
          workspacesProcessedCount = typeof deletedCount === 'number' ? deletedCount : 0
        } else if (result.data && Array.isArray(result.data)) {
          workspacesProcessedCount = result.data.length
        } else if (result.data === null && !payload.soft_delete) {
          workspacesProcessedCount = workspaceIds.length
        } else {
          return new FailedToolResult('No workspaces were affected by the operation.')
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
        ids: Array.from(new Set(workspaceIds)),
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
        ids: Array.from(new Set(workspaceIds)),
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
