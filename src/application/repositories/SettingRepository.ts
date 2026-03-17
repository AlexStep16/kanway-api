import SettingModel from '@models/SettingModel.ts'
import { BaseRepository } from '@repositories/BaseRepository.ts'
import { ISettingRaw } from '@entities/ISettingRaw.ts'
import { ISettingCriteria } from '@criterias/ISettingCriteria.ts'
import { FilterQuery, Types } from 'mongoose'
import { ISetting } from '@entities/ISetting.ts'

export default class SettingRepository extends BaseRepository<
  ISettingRaw,
  ISetting,
  ISettingCriteria
> {
  constructor() {
    super(SettingModel)
  }

  public buildFilter(
    criteria: ISettingCriteria,
    userId?: Types.ObjectId,
  ): FilterQuery<ISettingRaw> {
    const filter: FilterQuery<ISettingRaw> = {}

    if (userId) {
      filter.user_id = userId
    }

    if (criteria.id) {
      filter._id = criteria.id
    } else if (criteria.ids) {
      filter._id = { $in: criteria.ids }
    }

    if (criteria.userId) {
      filter.user_id = new Types.ObjectId(criteria.userId)
    }

    return filter
  }
}
