import { WorkspaceService } from '@application/services/WorkspaceService.js'
import { IWorkspace } from '@entities/IWorkspace.js'
import { WorkspaceDTO } from '@application/dtos/WorkspaceDTO.js'
import { BaseController } from '@controllers/BaseController.js'
import { IWorkspaceCriteria } from '@interfaces/criterias/IWorkspaceCriteria.js'
import { WorkspaceEditDTO } from '@dtos/WorkspaceEditDTO.js'

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
