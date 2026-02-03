import { ITokenRaw } from '@entities/ITokenRaw.ts'
import TokenModel from '@models/TokenModel.ts'
import { TokenTypesEnum } from '@/domain/enums/TokenTypesEnum.ts'
import { FilterQuery, Types } from 'mongoose'
import { BaseRepository } from '@repositories/BaseRepository.ts'
import { IToken } from '@entities/IToken.ts'
import { ITokenCreatePayload } from '../interfaces/ITokenCreatePayload.ts'
import { ITokenCriteria } from '../interfaces/criterias/ITokenCriteria.ts'

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
