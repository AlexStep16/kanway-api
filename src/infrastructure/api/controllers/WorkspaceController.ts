import { WorkspaceService } from '@application/services/WorkspaceService.ts'
import { IWorkspace } from '@entities/IWorkspace.ts'
import { WorkspaceDTO } from '@application/dtos/WorkspaceDTO.ts'
import { BaseController } from '@controllers/BaseController.ts'
import { WorkspaceCriteria } from '@interfaces/criterias/WorkspaceCriteria.ts'
import { WorkspaceEditDTO } from '@dtos/WorkspaceEditDTO.ts'
import { ClonedWorkspacesResult } from '@dtos/ClonedWorkspacesResult.ts'
import { IWorkspaceArchiveResponse } from '@application/interfaces/IWorkspaceArchiveResponse.ts'

export default class WorkspaceController extends BaseController<
  IWorkspace,
  WorkspaceDTO,
  WorkspaceCriteria,
  WorkspaceService,
  WorkspaceEditDTO,
  ClonedWorkspacesResult,
  IWorkspaceArchiveResponse
> {
  constructor(serviceInstance: WorkspaceService) {
    super(serviceInstance)
  }
}
