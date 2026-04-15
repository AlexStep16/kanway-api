import { ITokenRaw } from '@entities/ITokenRaw.js'
import TokenModel from '@models/TokenModel.js'
import { TokenTypesEnum } from '@/domain/enums/TokenTypesEnum.js'
import { FilterQuery, Types } from 'mongoose'
import { BaseRepository } from '@repositories/BaseRepository.js'
import { IToken } from '@entities/IToken.js'
import { ITokenCreatePayload } from '../interfaces/ITokenCreatePayload.js'
import { ITokenCriteria } from '../interfaces/criterias/ITokenCriteria.js'

export default class TokenRepository extends BaseRepository<
  ITokenRaw,
  IToken,
  Record<string, any>,
  ITokenCreatePayload
> {
  constructor() {
    super(TokenModel)
  }

  public buildFilter(criteria: ITokenCriteria): FilterQuery<ITokenRaw> {
    const filter: FilterQuery<ITokenRaw> = {}

    if (criteria.token) {
      filter.token = criteria.token
    } else if (criteria.tokens) {
      filter.token = { $in: criteria.tokens }
    }

    if (criteria.type) {
      filter.type = criteria.type
    } else if (criteria.types) {
      filter.type = { $in: criteria.types }
    }

    return filter
  }

  public async findConfirmationTokenByUserId(userId: Types.ObjectId): Promise<ITokenRaw | null> {
    return await this.model
      .findOne({
        user_id: userId,
        type: TokenTypesEnum.EMAIL_CONFIRMATION,
      })
      .lean()
  }
}
