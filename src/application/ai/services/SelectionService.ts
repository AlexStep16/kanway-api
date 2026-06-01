import { BaseService } from '@/application/services/BaseService.js'
import { ISelectionRaw } from '@/domain/entities/ISelectionRaw.js'
import { ISelectionCriteria } from '@/application/interfaces/criterias/ISelectionCriteria.js'
import { ISelection } from '@/domain/entities/ISelection.js'
import SelectionRepository from '@/application/repositories/SelectionRepository.js'
import { SelectionDTO } from '@/application/dtos/SelectionDTO.js'
import { ClientSession, Types } from 'mongoose'
import { SystemFields } from '@/infrastructure/types/SystemFields.js'

export class SelectionService extends BaseService<ISelectionRaw, ISelection, ISelectionCriteria> {
  protected repository: SelectionRepository

  constructor(selectionRepository: SelectionRepository) {
    super(selectionRepository)

    this.repository = selectionRepository
  }

  public async create(
    data: SelectionDTO,
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<ISelection> {
    const selection: Omit<ISelection, SystemFields> = {
      entityType: data.entityType,
      entityIds: data.entityIds,
      humanReadableFilters: data.humanReadableFilters,
      sample: data.sample,
      count: data.count,
      userId,
    }

    return await this.repository.create(selection, session)
  }
}
