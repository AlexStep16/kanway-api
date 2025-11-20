import { IUserRaw } from '@entities/IUserRaw.ts'
import { UserModel } from '@models/UserModel.ts' // Mongoose Model
import { BaseRepository } from '@repositories/BaseRepository.ts'
import { UserCriteria } from '../interfaces/criterias/UserCriteria.ts'
import { FilterQuery, Types } from 'mongoose'

export default class UserRepository extends BaseRepository<IUserRaw, typeof UserModel> {
  constructor() {
    super(UserModel)
  }

  public buildFilter(criteria: UserCriteria): FilterQuery<IUserRaw> {
    const filter: FilterQuery<IUserRaw> = {}

    if (criteria.id) {
      filter._id = criteria.id
    } else if (criteria.ids) {
      filter._id = { $in: criteria.ids }
    }

    return filter
  }

  public async findByEmail(email: string): Promise<IUserRaw | null> {
    const user = await UserModel.findByEmailWithPassword(email)

    return user
  }

  public async getPasswordHashById(id: Types.ObjectId): Promise<string | null> {
    const user = await this.model.findById(id, { password_hash: 1 }).lean()
    return user ? user.password_hash : null
  }
}
