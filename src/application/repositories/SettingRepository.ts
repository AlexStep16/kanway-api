import SettingModel from '@models/SettingModel.ts'
import { BaseRepository } from '@repositories/BaseRepository.ts'
import { ISettingRaw } from '@entities/ISettingRaw.ts'
import { SettingCriteria } from '@criterias/SettingCriteria.ts'
import { FilterQuery, Types } from 'mongoose'

export default class SettingRepository extends BaseRepository<ISettingRaw, typeof SettingModel> {
  constructor() {
    super(SettingModel)
  }

  public buildFilter(criteria: SettingCriteria, userId: Types.ObjectId): FilterQuery<ISettingRaw> {
    const filter: FilterQuery<ISettingRaw> = { user_id: userId }

    if (criteria.id) {
      filter._id = criteria.id
    } else if (criteria.ids) {
      filter._id = { $in: criteria.ids }
    }

    return filter
  }

  public getByUserId(userId: Types.ObjectId): Promise<ISettingRaw | null> {
    return this.model.findOne({ user_id: userId }).lean()
  }
}
