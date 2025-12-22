import { EditBoardsDTO } from '@application/ai/tools/toolSchemes.ts'
import { ClientSession } from 'mongoose'
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
    boardIds: string[],
    changes: EditBoardsDTO['changes'],
    user: IUser,
    session?: ClientSession,
    threadId?: string
  ): Promise<IResponseWithLog<IWorkspace[]>> {
    const workspacesToUpdate: WorkspaceEditDTO[] = []

    const existingWorkspaces = await this.workspaceService.getAll(
      { ids: boardIds },
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

      workspacesToUpdate.push(updatedWorkspace)
    }

    if (typeof changes.name !== 'undefined') {
      let updatedNames: { id: string; name: string }[] = []

      if (changes.name.set) {
        updatedNames = await this.aiSemanticService.buildNamesForEntities(
          existingWorkspaces,
          String(changes.name.set),
          'set'
        )
      } else if (changes.name.append) {
        updatedNames = await this.aiSemanticService.buildNamesForEntities(
          existingWorkspaces,
          String(changes.name.append),
          'append'
        )
      } else if (changes.name.prepend) {
        updatedNames = await this.aiSemanticService.buildNamesForEntities(
          existingWorkspaces,
          String(changes.name.prepend),
          'prepend'
        )
      } else if (changes.name.replace_part) {
        updatedNames = await this.aiSemanticService.buildNamesForEntities(
          existingWorkspaces,
          String(changes.name.replace_part.replace_with),
          'replace',
          String(changes.name.replace_part.find)
        )
      }

      for (const updatedWorkspace of workspacesToUpdate) {
        const updatedNameData = updatedNames.find(
          (data) => data.id === updatedWorkspace.id.toString()
        )

        if (updatedNameData) {
          updatedWorkspace.name = updatedNameData.name
        }
      }
    }

    return await this.workspaceService.editMany(workspacesToUpdate, user, session)
  }
}
