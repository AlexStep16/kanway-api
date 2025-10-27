import { IToken } from '@entities/IToken.ts'
import TokenModel from '@models/TokenModel.ts'
import { TokenTypes } from '@domain/enums/TokenTypes.ts'
import { Types } from 'mongoose'
import { ICreateService } from '@traits/ICreateService.ts'

export default class TokenRepository implements ICreateService<IToken, Partial<IToken>> {
  public async create(data: Partial<IToken>): Promise<IToken> {
    const token = new TokenModel(data)

    await token.save()

    return token.toObject()
  }

  public async findConfirmationTokenByUserId(userId: Types.ObjectId): Promise<IToken | null> {
    return await TokenModel.findOne({
      user_id: userId,
      type: TokenTypes.EMAIL_CONFIRMATION,
    }).lean()
  }
}
