import { WorkspaceService } from '@application/services/WorkspaceService.ts'
import { VectorSearchService } from '@/application/services/VectorSearchService.ts'
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
import { WorkspaceCommandAdapterService } from '@/application/ai/services/WorkspaceCommandAdapterService.ts'
import { FilterToMongoQueryService } from '@/application/ai/services/FilterToMongoQueryService.ts'
import { IWorkspace } from '@/domain/entities/IWorkspace.ts'
import * as Sentry from '@sentry/node'
import { Configurable } from '@application/ai/interfaces/Configurable.ts'
import { validateInputBySchema } from '@/utils/validateInputBySchema.ts'

interface CompressedWorkspace {
  id: string
  name: string
}

export class WorkspaceToolAdapter {
  private vectorSearchService: VectorSearchService
  private workspaceService: WorkspaceService
  private workspaceCommandAdapterService: WorkspaceCommandAdapterService
  private filterToMongoQueryService: FilterToMongoQueryService

  constructor(
    vectorSearchService: VectorSearchService,
    workspaceService: WorkspaceService,
    workspaceCommandAdapterService: WorkspaceCommandAdapterService,
    filterToMongoQueryService: FilterToMongoQueryService,
  ) {
    this.vectorSearchService = vectorSearchService
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
    config: LangGraphRunnableConfig,
  ): Promise<string> {
    const configurable = config.configurable as Configurable
    const user = configurable.user
    const timezone = configurable.timezone || 'Europe/Moscow'

    try {
      const errorMsgs = validateInputBySchema(dto, WorkspaceFilterSchema)

      if (errorMsgs.length > 0) {
        return (
          'Filter validation error:\n' + errorMsgs + '\nPlease correct the filter and try again.'
        )
      }

      let mongoFilter = await this.filterToMongoQueryService.prepare(dto, timezone, user.id)

      if (Object.keys(mongoFilter).length === 0) return JSON.stringify([])

      const workspaces = await this.workspaceService.getByFilter(
        mongoFilter,
        undefined,
        undefined,
        30,
      )

      if (workspaces.length === 0) {
        const workspaceName = getFilterNameField(mongoFilter)

        if (workspaceName) {
          // If no workspaces found but filter includes 'name', try semantic search as fallback
          const semanticSearchResults = await this.vectorSearchService.similaritySearchWorkspaces(
            [workspaceName],
            user.id,
            5,
          )

          const compressedWorkspaces = this._compressWorkspaces(semanticSearchResults)

          if (semanticSearchResults.length === 0) {
            return `No workspaces found matching the filter or semantically similar to the name "${workspaceName}".`
          }

          return (
            `No exact matches found. Here are some workspaces that might be relevant based on the name "${workspaceName}":\n` +
            JSON.stringify(compressedWorkspaces)
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
    dto: { namesToFind: string[] },
    config: LangGraphRunnableConfig,
  ): Promise<string> {
    try {
      const { namesToFind } = dto
      const configurable = config.configurable as Configurable

      if (!namesToFind || namesToFind.length === 0) {
        return 'Workspace names required to find relevant workspaces.'
      }

      const userId = configurable.user.id

      const workspaces = await this.vectorSearchService.similaritySearchWorkspaces(
        namesToFind,
        userId,
        30,
      )

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
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user

    try {
      const workspaces = dto.workspaces

      if (!workspaces || workspaces.length === 0) {
        return new FailedToolResult('No workspaces provided for creation.')
      }

      const errors: string[] = []

      const extendedWorkspaces = await this._extendWorkspaceCreateDTOWithContext(workspaces)

      const validationSchemaMessages = validateInputBySchema(dto, WorkspaceCreateSchema)

      errors.push(...validationSchemaMessages)

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors in create Workspaces schema:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.',
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

      return new SuccessToolResult({
        data: workspacesResult.data.map((workspace) => ({
          id: workspace.id,
          name: workspace.name,
        })),
        logId: workspacesResult.logId,
        actions: {
          create: {
            workspaces: workspacesResult.data,
          },
        },
      })
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error creating workspaces: ${(e as Error).message}`)
    }
  }

  public async editWorkspaces(
    dto: EditWorkspacesDTO,
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user

    try {
      const errors: string[] = []

      const validationSchemaMessages = validateInputBySchema(dto, EditWorkspacesSchema)

      errors.push(...validationSchemaMessages)

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors in edit Workspaces schema:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const editResult = await this.workspaceCommandAdapterService.translateAndExecute(
        dto.filter.ids,
        dto.changes,
        user,
      )

      // Get only changed columns to return
      const changedColumns = Object.keys(dto.changes)

      const dataWithChangedColumns = editResult.data.map((workspace) => {
        const workspaceWithChangedColumns: any = { id: workspace.id, name: workspace.name }

        for (const column of changedColumns) {
          workspaceWithChangedColumns[column] = (workspace as any)[column]
        }

        return workspaceWithChangedColumns
      })

      return new SuccessToolResult({
        data: dataWithChangedColumns,
        logId: editResult.logId,
        actions: {
          edit: {
            workspaces: editResult.data,
          },
        },
      })
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error editing workspaces: ${(e as Error).message}`)
    }
  }

  public async archiveWorkspaces(
    dto: { ids: string[] },
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user
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
            '\nPlease correct it and try again.',
        )
      }

      const archiveResult = await this.workspaceService.archive({ ids }, user)

      if (!archiveResult) {
        return new FailedToolResult('Workspaces archiving failed.')
      }

      if (archiveResult.data && archiveResult.data.length === 0) {
        return new FailedToolResult('No workspaces were archived.')
      } else if (!archiveResult.data) {
        return new FailedToolResult('Workspaces archiving failed.')
      }

      return new SuccessToolResult({
        data: archiveResult.data.map((workspace) => workspace.id),
        logId: archiveResult.logId,
        actions: {
          archive: {
            workspaces: archiveResult.data,
          },
        },
      })
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error archiving workspaces: ${(e as Error).message}`)
    }
  }

  public async cloneWorkspaces(
    dto: { ids: string[] },
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user
    const ids = dto.ids

    try {
      if (!ids || ids.length === 0) {
        return new FailedToolResult('No workspaces provided for cloning.')
      }

      const errors: string[] = []

      for (const id of ids) {
        if (!Types.ObjectId.isValid(id)) {
          errors.push(`Invalid Id: ${id}`)
        }
      }

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors while cloning workspaces:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const cloneResult = await this.workspaceService.clone({ ids }, user)

      if (!cloneResult) {
        return new FailedToolResult('Workspaces cloning failed.')
      }

      if (cloneResult.data && cloneResult.data.length === 0) {
        return new FailedToolResult('No workspaces were cloned.')
      } else if (!cloneResult.data) {
        return new FailedToolResult('Workspaces cloning failed.')
      }

      return new SuccessToolResult({
        data: cloneResult.data.map((workspace) => workspace.id),
        logId: cloneResult.logId,
        actions: {
          clone: {
            workspaces: cloneResult.data,
          },
        },
      })
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error cloning workspaces: ${(e as Error).message}`)
    }
  }

  public async deleteWorkspaces(
    dto: { ids: string[] },
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user
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
            '\nPlease correct it and try again.',
        )
      }

      const workspacesToDelete = await this.workspaceService.getByCriteria({ ids }, user.id)

      await this.workspaceService.delete({ ids }, user)

      return new SuccessToolResult({
        data: workspacesToDelete.map((workspace) => workspace.id),
        actions: {
          delete: {
            workspaces: workspacesToDelete,
          },
        },
      })
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error deleting workspaces: ${(e as Error).message}`)
    }
  }

  public async recoverWorkspaces(
    dto: { ids: string[] },
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user
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
            '\nPlease correct it and try again.',
        )
      }

      const recoverResult = await this.workspaceService.recover({ ids }, user)

      if (!recoverResult) {
        return new FailedToolResult('Workspaces recovering failed.')
      }

      if (recoverResult.data && recoverResult.data.length === 0) {
        return new FailedToolResult('No workspaces were recovered.')
      } else if (!recoverResult.data) {
        return new FailedToolResult('Workspaces recovering failed.')
      }

      const dataWithIntegration = {
        data: recoverResult.data.map((workspace) => workspace.id),
        logId: recoverResult.logId,
        actions: {
          recover: {
            workspaces: recoverResult.data,
          },
        },
      }

      return new SuccessToolResult(dataWithIntegration)
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error recovering workspaces: ${(e as Error).message}`)
    }
  }

  private async _extendWorkspaceCreateDTOWithContext(
    workspaces: WorkspaceCreateDTO['workspaces'],
  ): Promise<WorkspaceDTO[]> {
    const extendedWorkspaces: WorkspaceDTO[] = []

    for (const workspace of workspaces) {
      const closestColor = this.workspaceService.getNearestColor(workspace.color)

      const workspaceExtended: WorkspaceDTO = {
        ...workspace,
        color: closestColor,
      }

      extendedWorkspaces.push(workspaceExtended)
    }

    return extendedWorkspaces
  }
}
