import { WorkspaceService } from '@application/services/WorkspaceService.ts'
import { IWorkspace } from '@entities/IWorkspace.ts'
import { WorkspaceDTO } from '@/application/dtos/WorkspaceDTO.ts'
import { BaseController } from './BaseController.ts'
import { WorkspaceCriteria } from '@interfaces/criterias/WorkspaceCriteria.ts'

export default class WorkspaceController extends BaseController<
  IWorkspace,
  WorkspaceDTO,
  WorkspaceCriteria,
  WorkspaceService
> {
  constructor(serviceInstance: WorkspaceService) {
    super(serviceInstance)
  }
}
