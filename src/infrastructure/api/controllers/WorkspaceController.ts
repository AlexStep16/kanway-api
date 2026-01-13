import { WorkspaceService } from '@application/services/WorkspaceService.ts'
import { IWorkspace } from '@entities/IWorkspace.ts'
import { WorkspaceDTO } from '@application/dtos/WorkspaceDTO.ts'
import { BaseController } from '@controllers/BaseController.ts'
import { IWorkspaceCriteria } from '@interfaces/criterias/IWorkspaceCriteria.ts'
import { WorkspaceEditDTO } from '@dtos/WorkspaceEditDTO.ts'

export default class WorkspaceController extends BaseController<
  IWorkspace,
  WorkspaceService,
  IWorkspaceCriteria,
  WorkspaceDTO,
  WorkspaceEditDTO
> {
  constructor(serviceInstance: WorkspaceService) {
    super(serviceInstance)
  }
}
