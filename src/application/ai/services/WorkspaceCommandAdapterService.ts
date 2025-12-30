import { EditWorkspacesDTO } from '@application/ai/tools/toolSchemes.ts'
import { ClientSession, Types } from 'mongoose'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.ts'
import { BaseService } from '@application/services/BaseService.ts'
import { AISemanticService } from '@application/services/AISemanticService.ts'
import { IUser } from '@domain/entities/IUser.ts'
import { WorkspaceEditDTO } from '@dtos/WorkspaceEditDTO.ts'
import { WorkspaceService } from '../../services/WorkspaceService.ts'
import { IWorkspace } from '@/domain/entities/IWorkspace.ts'

export class WorkspaceCommandAdapterService {
  protected workspaceService: WorkspaceService
  protected baseService: BaseService
  protected aiSemanticService: AISemanticService

  constructor(
    workspaceService: WorkspaceService,
    baseService: BaseService,
    aiSemanticService: AISemanticService
  ) {
    this.workspaceService = workspaceService
    this.baseService = baseService
    this.aiSemanticService = aiSemanticService
  }

  public async translateAndExecute(
    workspaceIds: string[],
    changes: EditWorkspacesDTO['changes'],
    user: IUser,
    session?: ClientSession,
    threadId?: string
  ): Promise<IResponseWithLog<IWorkspace[]>> {
    const workspacesToUpdate: WorkspaceEditDTO[] = []

    const existingWorkspaces = await this.workspaceService.getAll(
      { ids: workspaceIds },
      user.id,
      session
    )

    for (const workspace of existingWorkspaces) {
      const updatedWorkspace = {
        id: workspace.id.toString(),
        threadId: threadId,
      } as WorkspaceEditDTO

      if (typeof changes.order !== 'undefined') {
        if (typeof changes.order === 'string') updatedWorkspace.order = parseInt(changes.order, 10)
        else if (typeof changes.order === 'number') updatedWorkspace.order = changes.order
      }

      if (typeof changes.isFavorite !== 'undefined') {
        updatedWorkspace.isFavorite = Boolean(changes.isFavorite)
      }

      if (typeof changes.color !== 'undefined') {
        updatedWorkspace.color = this.workspaceService.getNearestColor(changes.color)
      }

      workspacesToUpdate.push(updatedWorkspace)
    }

    if (typeof changes.name !== 'undefined') {
      let updatedNames: { id: Types.ObjectId; name: string }[] = []

      if (changes.name.set) {
        updatedNames = await this.aiSemanticService.buildNamesForEntities(
          existingWorkspaces,
          String(changes.name.set),
          'set'
        )
      }
      if (changes.name.append) {
        updatedNames = await this.aiSemanticService.buildNamesForEntities(
          updatedNames.length > 0 ? updatedNames : existingWorkspaces,
          String(changes.name.append),
          'append'
        )
      }
      if (changes.name.prepend) {
        updatedNames = await this.aiSemanticService.buildNamesForEntities(
          updatedNames.length > 0 ? updatedNames : existingWorkspaces,
          String(changes.name.prepend),
          'prepend'
        )
      }
      if (changes.name.replace_part) {
        updatedNames = await this.aiSemanticService.buildNamesForEntities(
          updatedNames.length > 0 ? updatedNames : existingWorkspaces,
          String(changes.name.replace_part.replace_with),
          'replace',
          String(changes.name.replace_part.find)
        )
      }

      for (const updatedWorkspace of workspacesToUpdate) {
        const updatedNameData = updatedNames.find((data) => data.id.equals(updatedWorkspace.id))

        if (updatedNameData) {
          updatedWorkspace.name = updatedNameData.name
        }
      }
    }

    return await this.workspaceService.editMany(workspacesToUpdate, user, session)
  }
}
