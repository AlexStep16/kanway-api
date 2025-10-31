import { ITokenRaw } from '@entities/ITokenRaw.ts'
import TokenModel from '@models/TokenModel.ts'
import { TokenTypesEnum } from '@/domain/enums/TokenTypesEnum.ts'
import { Types } from 'mongoose'
import { BaseRepository } from '@repositories/BaseRepository.ts'

export default class TokenRepository extends BaseRepository<ITokenRaw, typeof TokenModel> {
  constructor() {
    super(TokenModel)
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
