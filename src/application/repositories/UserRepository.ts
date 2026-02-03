import { IUserRaw } from '@entities/IUserRaw.ts'
import { UserModel } from '@models/UserModel.ts' // Mongoose Model
import { BaseRepository } from '@repositories/BaseRepository.ts'
import { IUserCriteria } from '../interfaces/criterias/IUserCriteria.ts'
import { FilterQuery, Types } from 'mongoose'
import { IUser } from '@/domain/entities/IUser.ts'

export default class UserRepository extends BaseRepository<IUserRaw, IUser, IUserCriteria> {
  constructor() {
    super(UserModel)
  }

  public buildFilter(criteria: IUserCriteria): FilterQuery<IUserRaw> {
    const filter: FilterQuery<IUserRaw> = {}

    if (criteria.id) {
      filter._id = criteria.id
    } else if (criteria.ids) {
      filter._id = { $in: criteria.ids }
    }

    if (criteria.email) {
      filter.email = criteria.email.toLowerCase()
    }

    return filter
  }

  public async findByEmail(email: string): Promise<IUserRaw | null> {
    const user = await UserModel.findByEmailWithPassword(email.toLowerCase())

    return user
  }

  public async getPasswordHashById(id: Types.ObjectId): Promise<string | null> {
    const user = await this.model.findById(id, { password_hash: 1 }).lean()
    return user ? user.password_hash : null
  }
}
