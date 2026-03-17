import { WorkspaceService } from '@application/services/WorkspaceService.ts'
import { ClientSession, Types } from 'mongoose'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.ts'
import { WorkspaceEditDTO } from '@dtos/WorkspaceEditDTO.ts'
import { VectorSearchService } from '@/application/services/VectorSearchService.ts'
import { AISemanticService } from '@application/services/AISemanticService.ts'
import { IUser } from '@domain/entities/IUser.ts'
import { StringModificationDTO } from '../tools/schemes/baseSchemes.ts'
import { IWorkspace } from '@/domain/entities/IWorkspace.ts'

export class WorkspaceCommandAdapterService {
  protected workspaceService: WorkspaceService
  protected vectorSearchService: VectorSearchService
  protected aiSemanticService: AISemanticService

  constructor(
    workspaceService: WorkspaceService,
    vectorSearchService: VectorSearchService,
    aiSemanticService: AISemanticService,
  ) {
    this.workspaceService = workspaceService
    this.vectorSearchService = vectorSearchService
    this.aiSemanticService = aiSemanticService
  }
  private _getTransformedWorkspacesForStringModification(
    workspaces: IWorkspace[],
    field: 'name',
  ): { id: Types.ObjectId; text: string }[] {
    return workspaces.map((workspace) => ({
      id: workspace.id,
      text: workspace[field] || '',
    }))
  }

  public async translateEditStringAndExecute(
    workspaceIds: string[],
    dto: StringModificationDTO,
    field: 'name',
    user: IUser,
    session?: ClientSession,
  ): Promise<IResponseWithLog<IWorkspace[]>> {
    if (typeof dto === 'undefined' || dto === null || Object.keys(dto).length === 0) {
      return {
        data: [],
        logId: null,
      }
    }

    const workspacesToUpdate: WorkspaceEditDTO[] = []

    const existingWorkspaces = await this.workspaceService.getByCriteria(
      { ids: workspaceIds },
      user.id,
      session,
    )
    const transformedWorkspaces = this._getTransformedWorkspacesForStringModification(
      existingWorkspaces,
      field,
    )

    let updatedTexts: { id: Types.ObjectId; text: string }[] = []

    if (dto.set) {
      updatedTexts = this.aiSemanticService.buildTextForEntities(
        transformedWorkspaces,
        String(dto.set),
        'set',
      )
    }
    if (dto.append) {
      updatedTexts = this.aiSemanticService.buildTextForEntities(
        updatedTexts.length > 0 ? updatedTexts : transformedWorkspaces,
        String(dto.append),
        'append',
      )
    }
    if (dto.prepend) {
      updatedTexts = this.aiSemanticService.buildTextForEntities(
        updatedTexts.length > 0 ? updatedTexts : transformedWorkspaces,
        String(dto.prepend),
        'prepend',
      )
    }
    if (dto.replace_part) {
      updatedTexts = this.aiSemanticService.buildTextForEntities(
        updatedTexts.length > 0 ? updatedTexts : transformedWorkspaces,
        String(dto.replace_part.replace_with),
        'replace',
        String(dto.replace_part.find),
      )
    }

    workspacesToUpdate.push(
      ...updatedTexts.map((data) => ({ id: data.id.toString(), [field]: data.text })),
    )

    for (const updatedWorkspace of workspacesToUpdate) {
      const updatedTextData = updatedTexts.find((data) => data.id.equals(updatedWorkspace.id))

      if (updatedTextData) {
        updatedWorkspace[field] = updatedTextData.text
      }
    }

    return await this.workspaceService.editMany(workspacesToUpdate, user, session)
  }
}
