import { WorkspaceService } from '@application/services/WorkspaceService.ts'
import { LangGraphRunnableConfig } from '@langchain/langgraph'
import IToolResult from '@/application/interfaces/IToolResult.ts'
import { FailedToolResult } from '../../FailedToolResult.ts'
import { SuccessToolResult } from '../../SuccessToolResult.ts'
import { WorkspaceCommandAdapterService } from '@/application/ai/services/WorkspaceCommandAdapterService.ts'
import { IWorkspace } from '@/domain/entities/IWorkspace.ts'
import * as Sentry from '@sentry/node'
import { Configurable } from '@application/ai/interfaces/Configurable.ts'
import { validateInputByScheme } from '@/utils/validateInputByScheme.ts'
import {
  EditWorkspacesColorDTO,
  EditWorkspacesColorSchema,
  EditWorkspacesNameDTO,
  EditWorkspacesNameSchema,
  EditWorkspacesOrderDTO,
  EditWorkspacesOrderSchema,
  FavoriteWorkspacesDTO,
  FavoriteWorkspacesSchema,
} from '../../schemes/update/workspaceEditSchemes.ts'

export class WorkspaceEditToolAdapter {
  private workspaceService: WorkspaceService
  private workspaceCommandAdapterService: WorkspaceCommandAdapterService

  constructor(
    workspaceService: WorkspaceService,
    workspaceCommandAdapterService: WorkspaceCommandAdapterService,
  ) {
    this.workspaceService = workspaceService
    this.workspaceCommandAdapterService = workspaceCommandAdapterService
  }

  public async updateWorkspacesName(
    dto: EditWorkspacesNameDTO,
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user

    try {
      const validationSchemaMessages = validateInputByScheme(dto, EditWorkspacesNameSchema)

      if (validationSchemaMessages.length > 0) {
        return new FailedToolResult(
          'There are some errors in edit Workspaces name schema:\n' +
            validationSchemaMessages.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const editResult = await this.workspaceCommandAdapterService.translateEditStringAndExecute(
        dto.filter.ids,
        dto.name,
        'name',
        user,
      )

      const dataWithChangedColumns = editResult.data.map((workspace) => {
        const workspaceWithChangedColumns: Partial<IWorkspace> = {
          id: workspace.id,
          name: workspace.name,
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

      return new FailedToolResult(`Error editing workspaces name: ${(e as Error).message}`)
    }
  }

  public async updateWorkspacesOrder(
    dto: EditWorkspacesOrderDTO,
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user

    try {
      const validationSchemaMessages = validateInputByScheme(dto, EditWorkspacesOrderSchema)

      if (validationSchemaMessages.length > 0) {
        return new FailedToolResult(
          'There are some errors in edit Workspaces order schema:\n' +
            validationSchemaMessages.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const editResult = await this.workspaceService.edit(
        {
          order: parseInt(dto.order as any, 10),
        },
        {
          ids: dto.filter.ids,
        },
        user,
      )

      const dataWithChangedColumns = editResult.data.map((workspace) => {
        const workspaceWithChangedColumns: Partial<IWorkspace> = {
          id: workspace.id,
          order: workspace.order,
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

      return new FailedToolResult(`Error updating workspaces order: ${(e as Error).message}`)
    }
  }

  public async updateWorkspacesColor(
    dto: EditWorkspacesColorDTO,
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user

    try {
      const validationSchemaMessages = validateInputByScheme(dto, EditWorkspacesColorSchema)

      if (validationSchemaMessages.length > 0) {
        return new FailedToolResult(
          'There are some errors in edit Workspaces color schema:\n' +
            validationSchemaMessages.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const editResult = await this.workspaceService.edit(
        {
          color: dto.color,
        },
        {
          ids: dto.filter.ids,
        },
        user,
      )

      const dataWithChangedColumns = editResult.data.map((workspace) => {
        const workspaceWithChangedColumns: Partial<IWorkspace> = {
          id: workspace.id,
          color: workspace.color,
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

      return new FailedToolResult(`Error updating workspaces color: ${(e as Error).message}`)
    }
  }

  public async favoriteWorkspaces(
    dto: FavoriteWorkspacesDTO,
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user

    try {
      const validationSchemaMessages = validateInputByScheme(dto, FavoriteWorkspacesSchema)

      if (validationSchemaMessages.length > 0) {
        return new FailedToolResult(
          'There are some errors in favorite Workspaces schema:\n' +
            validationSchemaMessages.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const editResult = await this.workspaceService.edit(
        {
          isFavorite: !!dto.isFavorite,
        },
        {
          ids: dto.filter.ids,
        },
        user,
      )

      const dataWithChangedColumns = editResult.data.map((workspace) => {
        const workspaceWithChangedColumns: Partial<IWorkspace> = {
          id: workspace.id,
          isFavorite: workspace.isFavorite,
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

      return new FailedToolResult(
        `Error updating workspaces favorite status: ${(e as Error).message}`,
      )
    }
  }
}
