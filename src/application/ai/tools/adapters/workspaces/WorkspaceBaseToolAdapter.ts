import { LangGraphRunnableConfig } from '@langchain/langgraph'
import IToolResult from '@/application/interfaces/IToolResult.ts'
import { WorkspaceDTO } from '@/application/dtos/WorkspaceDTO.ts'
import { Types } from 'mongoose'
import * as Sentry from '@sentry/node'
import { Configurable } from '@application/ai/interfaces/Configurable.ts'
import { validateInputByScheme } from '@/utils/validateInputByScheme.ts'
import { FailedToolResult } from '../../FailedToolResult.ts'
import { SuccessToolResult } from '../../SuccessToolResult.ts'
import {
  WorkspaceCreateDTO,
  WorkspaceCreateSchema,
} from '../../schemes/create/workspaceCreateSchema.ts'
import { getCompressedWorkspaces } from '@/utils/getCompressedWorkspaces.ts'
import { BaseToolAdapter } from '../BaseToolAdapter.ts'

export class WorkspaceBaseToolAdapter extends BaseToolAdapter {
  public async searchRelevantWorkspaces(
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

      const compressedWorkspaces = getCompressedWorkspaces(workspaces)

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

      const extendedWorkspaces = this._extendWorkspaceCreateDTOWithContext(workspaces)

      const validationSchemaMessages = validateInputByScheme(dto, WorkspaceCreateSchema)

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

  private _extendWorkspaceCreateDTOWithContext(
    workspaces: WorkspaceCreateDTO['workspaces'],
  ): WorkspaceDTO[] {
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
