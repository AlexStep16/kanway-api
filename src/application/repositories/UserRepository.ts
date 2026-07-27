import { IUserRaw } from '@entities/IUserRaw.js'
import { UserModel } from '@models/UserModel.js' // Mongoose Model
import { BaseRepository } from '@repositories/BaseRepository.js'
import { IUserCriteria } from '../interfaces/criterias/IUserCriteria.js'
import { ClientSession, FilterQuery, Types } from 'mongoose'
import { IUser } from '@/domain/entities/IUser.js'

export default class UserRepository extends BaseRepository<
  IUserRaw,
  IUser,
  IUserCriteria,
  Partial<IUser>
> {
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

    if (criteria.vkUserId) {
      filter.vk_user_id = criteria.vkUserId
    }

    if (criteria.yandexUserId) {
      filter.yandex_user_id = criteria.yandexUserId
    }

    return filter
  }

  public async findByEmail(email: string): Promise<IUserRaw | null> {
    const user = await UserModel.findByEmailWithPassword(email.toLowerCase())

    return user
  }

  public async getPasswordHashById(id: Types.ObjectId): Promise<string | null> {
    const user = await this.model.findById(id, { password_hash: 1 }).lean()
    return user ? (user.password_hash ?? null) : null
  }

  public async findDueActiveSubscriptions(
    currentDate: Date,
    session: ClientSession | null = null,
  ): Promise<Pick<IUser, 'id'>[]> {
    return await this.findByFilter<Pick<IUser, 'id'>>(
      {
        is_subscription_active: true,
        subscription_until: {
          $lte: currentDate,
          $ne: null,
        },
      },
      session,
      {
        projection: { _id: 1 },
        sort: { subscription_until: 1 },
      },
    )
  }
}
