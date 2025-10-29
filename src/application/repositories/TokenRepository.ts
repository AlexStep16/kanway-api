import { IToken } from '@entities/IToken.ts'
import TokenModel from '@models/TokenModel.ts'
import { TokenTypesEnum } from '@/domain/enums/TokenTypesEnum.ts'
import { Types } from 'mongoose'
import { BaseRepository } from '@repositories/BaseRepository.ts'

export default class TokenRepository extends BaseRepository<IToken, typeof TokenModel> {
  constructor() {
    super(TokenModel)
  }

  public async findConfirmationTokenByUserId(userId: Types.ObjectId): Promise<IToken | null> {
    return await this.model
      .findOne({
        user_id: userId,
        type: TokenTypesEnum.EMAIL_CONFIRMATION,
      })
      .lean()
  }
}
