import { WorkspaceService } from '@application/services/WorkspaceService.js'
import { IWorkspace } from '@entities/IWorkspace.js'
import { WorkspaceDTO } from '@application/dtos/WorkspaceDTO.js'
import { BaseController } from '@controllers/BaseController.js'
import { IWorkspaceCriteria } from '@interfaces/criterias/IWorkspaceCriteria.js'
import { WorkspaceEditDTO } from '@dtos/WorkspaceEditDTO.js'
import SuccessResponse from '@/application/services/SuccessResponse.js'

export default class WorkspaceController extends BaseController<
  IWorkspace,
  WorkspaceService,
  IWorkspaceCriteria,
  WorkspaceDTO,
  WorkspaceEditDTO
> {
  public welcome = async (req: any, res: any, next: any) => {
    try {
      const result = await this.service.welcome(req.body, req.user!)

      res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }
}
