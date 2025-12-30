import { WorkspaceService } from '@application/services/WorkspaceService.ts'
import { BaseService } from '@application/services/BaseService.ts'
import {
  WorkspaceFilterDTO,
  WorkspaceFilterSchema,
  WorkspaceCreateDTO,
  WorkspaceCreateSchema,
  EditWorkspacesDTO,
  EditWorkspacesSchema,
} from './toolSchemes.ts'
import { LangGraphRunnableConfig } from '@langchain/langgraph'
import { getFilterNameField } from '../helpers/getFilterNameField.ts'
import IToolResult from '@/application/interfaces/IToolResult.ts'
import { FailedToolResult } from './FailedToolResult.ts'
import { SuccessToolResult } from './SuccessToolResult.ts'
import { WorkspaceDTO } from '@/application/dtos/WorkspaceDTO.ts'
import { Types } from 'mongoose'
import { IUser } from '@/domain/entities/IUser.ts'
import { WorkspaceCommandAdapterService } from '@/application/ai/services/WorkspaceCommandAdapterService.ts'
import { FilterToMongoQueryService } from '@/application/ai/services/FilterToMongoQueryService.ts'
import { IUndoResponse } from '@/application/interfaces/IUndoResponse.ts'
import { IWorkspacesWithChildrenResponse } from '@/application/interfaces/IWorkspacesWithChildrenResponse.ts'
import { IWorkspace } from '@/domain/entities/IWorkspace.ts'
import * as Sentry from '@sentry/node'

interface CompressedWorkspace {
  id: string
  name: string
}

export class WorkspaceToolAdapter {
  private baseService: BaseService
  private workspaceService: WorkspaceService
  private workspaceCommandAdapterService: WorkspaceCommandAdapterService
  private filterToMongoQueryService: FilterToMongoQueryService

  constructor(
    baseService: BaseService,
    workspaceService: WorkspaceService,
    workspaceCommandAdapterService: WorkspaceCommandAdapterService,
    filterToMongoQueryService: FilterToMongoQueryService
  ) {
    this.baseService = baseService
    this.workspaceService = workspaceService
    this.workspaceCommandAdapterService = workspaceCommandAdapterService
    this.filterToMongoQueryService = filterToMongoQueryService
  }

  private _compressWorkspaces(workspaces: IWorkspace[]): Array<CompressedWorkspace> {
    return workspaces.map((workspace) => ({
      id: workspace.id.toString(),
      name: workspace.name,
    }))
  }

  // [Tool 1]
  public async findWorkspacesByFilter(
    dto: WorkspaceFilterDTO,
    config: LangGraphRunnableConfig
  ): Promise<string> {
    const user = config.configurable?.user as IUser
    const timezone = config.configurable?.timezone || 'Europe/Moscow'

    try {
      const errorMsgs = this.baseService.validateInputBySchema(dto, WorkspaceFilterSchema)

      if (errorMsgs.length > 0) {
        return (
          'Filter validation error:\n' + errorMsgs + '\nPlease correct the filter and try again.'
        )
      }

      let mongoFilter = await this.filterToMongoQueryService.prepare(dto, timezone, user.id)

      if (Object.keys(mongoFilter).length === 0) return JSON.stringify([])

      const workspaces = await this.workspaceService.getByFilter(mongoFilter, user.id, 30)

      if (workspaces.length === 0) {
        const workspaceName = getFilterNameField(mongoFilter)

        if (workspaceName) {
          // If no workspaces found but filter includes 'name', try semantic search as fallback
          const semanticSearchResults = await this.baseService.similaritySearchWorkspaces(
            workspaceName,
            user.id,
            2
          )

          if (semanticSearchResults.length === 0) {
            return `No workspaces found matching the filter or semantically similar to the name "${workspaceName}".`
          }

          return (
            `No exact matches found. Here are some workspaces that might be relevant based on the name "${workspaceName}":\n` +
            JSON.stringify(semanticSearchResults)
          )
        }
      }

      const compressedWorkspaces = this._compressWorkspaces(workspaces)

      if (compressedWorkspaces.length === 0) {
        return 'No workspaces found matching the provided filter.'
      } else if (compressedWorkspaces.length > 20) {
        return `Found ${compressedWorkspaces.length} workspaces. Please refine your filter to narrow down the results.`
      }

      return JSON.stringify(compressedWorkspaces)
    } catch (e) {
      Sentry.captureException(e)

      return `Error retrieving workspaces: ${(e as Error).message}`
    }
  }

  public async findRelevantWorkspaces(
    findRelevantDto: { nameToFind: string },
    config: LangGraphRunnableConfig
  ): Promise<string> {
    try {
      const { nameToFind } = findRelevantDto

      if (!nameToFind) {
        return 'Workspace name required to find relevant workspaces.'
      }

      const userId = config.configurable?.user?.id

      const workspaces = await this.baseService.similaritySearchWorkspaces(nameToFind, userId, 30)

      const compressedWorkspaces = this._compressWorkspaces(workspaces)

      if (compressedWorkspaces.length === 0) {
        return 'No workspaces found matching the provided filter.'
      } else if (compressedWorkspaces.length > 20) {
        return `Found ${compressedWorkspaces.length} workspaces. Please refine your filter to narrow down the results.`
      }

      return JSON.stringify(compressedWorkspaces)
    } catch (e) {
      Sentry.captureException(e)

      return `Error finding relevant workspaces: ${(e as Error).message}`
    }
  }

  public async createWorkspaces(
    dto: WorkspaceCreateDTO,
    config: LangGraphRunnableConfig
  ): Promise<IToolResult> {
    const user = config.configurable?.user as IUser
    const threadId = config.configurable?.thread_id as string | undefined

    try {
      const workspaces = dto.workspaces

      if (!workspaces || workspaces.length === 0) {
        return new FailedToolResult('No workspaces provided for creation.')
      }

      const errors: string[] = []

      const extendedWorkspaces = await this._extendWorkspaceCreateDTOWithContext(
        workspaces,
        threadId
      )

      const validationSchemaMessages = this.baseService.validateInputBySchema(
        dto,
        WorkspaceCreateSchema
      )

      errors.push(...validationSchemaMessages)

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors in create Workspaces schema:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.'
        )
      }

      const workspacesResult = await this.workspaceService.createMany(extendedWorkspaces, user)

      if (!workspacesResult) {
        return new FailedToolResult('Workspaces creation failed.')
      }

      if (workspacesResult.data && workspacesResult.data.length === 0) {
        return new FailedToolResult('No workspaces were created.')
      } else if (!workspacesResult.data) {
        return new FailedToolResult('Workspaces creation failed.')
      }

      const integration: IUndoResponse<IWorkspacesWithChildrenResponse> = {
        create: {
          workspaces: workspacesResult.data,
          boards: [],
          categories: [],
          tasks: [],
        },
      }

      const dataWithIntegration = {
        data: workspacesResult.data.map((workspace) => ({
          id: workspace.id,
          name: workspace.name,
        })),
        logId: workspacesResult.logId,
        integration,
      }

      return new SuccessToolResult(dataWithIntegration)
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error creating workspaces: ${(e as Error).message}`)
    }
  }

  public async editWorkspaces(
    dto: EditWorkspacesDTO,
    config: LangGraphRunnableConfig
  ): Promise<IToolResult> {
    const user = config.configurable?.user as IUser
    const threadId = config.configurable?.thread_id as string | undefined

    try {
      const errors: string[] = []

      const validationSchemaMessages = this.baseService.validateInputBySchema(
        dto,
        EditWorkspacesSchema
      )

      errors.push(...validationSchemaMessages)

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors in edit Workspaces schema:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.'
        )
      }

      const editResult = await this.workspaceCommandAdapterService.translateAndExecute(
        dto.filter.ids,
        dto.changes,
        user,
        undefined,
        threadId
      )

      const integration: IUndoResponse<IWorkspacesWithChildrenResponse> = {
        update: {
          workspaces: editResult.data,
          boards: [],
          categories: [],
          tasks: [],
        },
      }

      // Get only changed columns to return
      const changedColumns = Object.keys(dto.changes)

      const dataWithChangedColumns = editResult.data.map((workspace) => {
        const workspaceWithChangedColumns: any = { id: workspace.id, name: workspace.name }

        for (const column of changedColumns) {
          workspaceWithChangedColumns[column] = (workspace as any)[column]
        }

        return workspaceWithChangedColumns
      })

      const dataWithIntegration = {
        data: dataWithChangedColumns,
        logId: editResult.logId,
        integration,
      }

      return new SuccessToolResult(dataWithIntegration)
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error editing workspaces: ${(e as Error).message}`)
    }
  }

  public async archiveWorkspaces(
    dto: { ids: string[] },
    config: LangGraphRunnableConfig
  ): Promise<IToolResult> {
    const user = config.configurable?.user as IUser
    const ids = dto.ids

    try {
      if (!ids || ids.length === 0) {
        return new FailedToolResult('No workspaces provided for archiving.')
      }

      const errors: string[] = []

      for (const id of ids) {
        if (!Types.ObjectId.isValid(id)) {
          errors.push(`Invalid Id: ${id}`)
        }
      }

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors while archiving workspaces:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.'
        )
      }

      const archiveResult = await this.workspaceService.archive({ ids }, user)

      if (!archiveResult) {
        return new FailedToolResult('Workspaces archiving failed.')
      }

      if (
        archiveResult.data &&
        archiveResult.data.workspaces &&
        archiveResult.data.workspaces.length === 0
      ) {
        return new FailedToolResult('No workspaces were archived.')
      } else if (!archiveResult.data) {
        return new FailedToolResult('Workspaces archiving failed.')
      }

      const integration: IUndoResponse<IWorkspacesWithChildrenResponse> = {
        update: {
          workspaces: archiveResult.data.workspaces,
          boards: archiveResult.data.boards,
          categories: archiveResult.data.categories,
          tasks: archiveResult.data.tasks,
        },
      }

      const dataWithIntegration = {
        data: archiveResult.data.workspaces.map((workspace) => workspace.id),
        logId: archiveResult.logId,
        integration,
      }

      return new SuccessToolResult(dataWithIntegration)
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error archiving workspaces: ${(e as Error).message}`)
    }
  }

  public async deleteWorkspaces(
    dto: { ids: string[] },
    config: LangGraphRunnableConfig
  ): Promise<IToolResult> {
    const user = config.configurable?.user as IUser
    const ids = dto.ids

    try {
      if (!ids || ids.length === 0) {
        return new FailedToolResult('No workspaces provided for deletion.')
      }

      const errors: string[] = []

      for (const id of ids) {
        if (!Types.ObjectId.isValid(id)) {
          errors.push(`Invalid Id: ${id}`)
        }
      }

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors while deleting workspaces:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.'
        )
      }

      const deleteResult = await this.workspaceService.delete({ ids }, user)

      if (!deleteResult) {
        return new FailedToolResult('Workspaces deletion failed.')
      }

      const deletedIds: unknown = ids.map((id) => ({ id }))

      const integration: IUndoResponse<IWorkspacesWithChildrenResponse> = {
        update: {
          workspaces: deleteResult,
          boards: [],
          categories: [],
          tasks: [],
        },
        delete: {
          workspaces: deletedIds as IWorkspace[],
          boards: [],
          categories: [],
          tasks: [],
        },
      }

      const dataWithIntegration = {
        data: deleteResult.map((workspace) => workspace.id),
        integration,
      }

      return new SuccessToolResult(dataWithIntegration)
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error deleting workspaces: ${(e as Error).message}`)
    }
  }

  public async recoverWorkspaces(
    dto: { ids: string[] },
    config: LangGraphRunnableConfig
  ): Promise<IToolResult> {
    const user = config.configurable?.user as IUser
    const ids = dto.ids

    try {
      if (!ids || ids.length === 0) {
        return new FailedToolResult('No workspaces provided for recovering.')
      }

      const errors: string[] = []

      for (const id of ids) {
        if (!Types.ObjectId.isValid(id)) {
          errors.push(`Invalid Id: ${id}`)
        }
      }

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors while recovering workspaces:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.'
        )
      }

      const recoverResult = await this.workspaceService.recover({ ids }, user)

      if (!recoverResult) {
        return new FailedToolResult('Workspaces recovering failed.')
      }

      if (
        recoverResult.data &&
        recoverResult.data.workspaces &&
        recoverResult.data.workspaces.length === 0
      ) {
        return new FailedToolResult('No workspaces were recovered.')
      } else if (!recoverResult.data) {
        return new FailedToolResult('Workspaces recovering failed.')
      }

      const integration: IUndoResponse<IWorkspacesWithChildrenResponse> = {
        update: {
          workspaces: recoverResult.data.workspaces,
          boards: recoverResult.data.boards,
          categories: recoverResult.data.categories,
          tasks: recoverResult.data.tasks,
        },
      }

      const dataWithIntegration = {
        data: recoverResult.data.workspaces.map((workspace) => workspace.id),
        logId: recoverResult.logId,
        integration,
      }

      return new SuccessToolResult(dataWithIntegration)
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error recovering workspaces: ${(e as Error).message}`)
    }
  }

  private async _extendWorkspaceCreateDTOWithContext(
    workspaces: WorkspaceCreateDTO['workspaces'],
    threadId?: string
  ): Promise<WorkspaceDTO[]> {
    const extendedWorkspaces: WorkspaceDTO[] = []

    for (const workspace of workspaces) {
      const closestColor = this.workspaceService.getNearestColor(workspace.color)

      const workspaceExtended: WorkspaceDTO = {
        ...workspace,
        color: closestColor,
      }

      if (threadId) {
        workspaceExtended.threadId = threadId
      }

      extendedWorkspaces.push(workspaceExtended)
    }

    return extendedWorkspaces
  }
}
