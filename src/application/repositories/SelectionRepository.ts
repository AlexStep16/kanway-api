import { BaseRepository } from '@repositories/BaseRepository.js'
import Selection from '@models/Selection.js'
import { FilterQuery, Types } from 'mongoose'
import { ISelectionRaw } from '@/domain/entities/ISelectionRaw.js'
import { ISelection } from '@/domain/entities/ISelection.js'
import { ISelectionCriteria } from '../interfaces/criterias/ISelectionCriteria.js'

export default class SelectionRepository extends BaseRepository<
  ISelectionRaw,
  ISelection,
  ISelectionCriteria
> {
  constructor() {
    super(Selection)
  }

  public buildFilter(
    criteria: ISelectionCriteria,
    userId?: Types.ObjectId,
  ): FilterQuery<ISelectionRaw> {
    const filter: FilterQuery<ISelectionRaw> = {}

    if (userId) {
      filter.user_id = userId
    }

    if (criteria.id) {
      filter._id = criteria.id
    } else if (criteria.ids) {
      filter._id = { $in: criteria.ids }
    }

    if (criteria.entityType) {
      filter.entity_type = criteria.entityType
    } else if (criteria.entityTypes) {
      filter.entity_type = { $in: criteria.entityTypes }
    }

    return filter
  }
}
