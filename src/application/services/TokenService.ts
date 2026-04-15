import { TokenTypesEnum } from '@/domain/enums/TokenTypesEnum.js'
import jwt from 'jsonwebtoken'
import TokenRepository from '@repositories/TokenRepository.js'
import { TokenGenerationError } from '@errors/TokenGenerationError.js'
import { Types } from 'mongoose'
import { IToken } from '@entities/IToken.js'
import { TokenDTO } from '../dtos/TokenDTO.js'
import { toMongoCaseKeys, toServerCaseKeys } from '@/utils/objectTransformers.js'

const KEY = process.env.JWT_KEY || 'FF123ABC-456D-789E-F012-3456789ABCDF'

export class TokenService {
  protected tokenRepository: TokenRepository

  constructor(tokenRepository: TokenRepository) {
    this.tokenRepository = tokenRepository
  }

  public async getToken(token: string, type: TokenTypesEnum): Promise<IToken | null> {
    const tokenModel = await this.tokenRepository.findByCriteria({ token, type }, null, {
      sort: { createdAt: -1 },
    })

    if (!tokenModel) {
      return null
    }

    return tokenModel[0]
  }

  public async edit(
    data: Partial<TokenDTO>,
    token: string,
    userId: Types.ObjectId,
  ): Promise<IToken> {
    const payload = toMongoCaseKeys<IToken>(data)

    const updateTokenResult = await this.tokenRepository.updateManyByCriteria(
      { token },
      payload,
      undefined,
      userId,
    )

    if (updateTokenResult.modifiedCount === 0) {
      throw new Error('Ошибка обновления токена')
    }

    const updatedToken = await this.tokenRepository.findByCriteria({ token, userId })

    return updatedToken.map(toServerCaseKeys<IToken>)[0]
  }

  public async generateAndSaveConfirmationToken(userId: Types.ObjectId): Promise<IToken> {
    try {
      const token = this.generateToken(userId, 60 * 60 * 24 * 3) // 3 days

      if (!token) throw new TokenGenerationError()

      const tokenModel = await this.tokenRepository.create({
        token,
        userId,
        type: TokenTypesEnum.EMAIL_CONFIRMATION,
      })

      return tokenModel
    } catch {
      throw new TokenGenerationError()
    }
  }

  public async generateAndSaveResetToken(userId: Types.ObjectId): Promise<IToken> {
    try {
      const token = this.generateToken(userId, 60 * 60 * 1) // 1 hour

      if (!token) throw new TokenGenerationError()

      const tokenModel = await this.tokenRepository.create({
        token,
        userId,
        type: TokenTypesEnum.RESET_PASSWORD,
      })

      return tokenModel
    } catch {
      throw new TokenGenerationError()
    }
  }

  public generateToken(userId: Types.ObjectId, expiresIn: number): string {
    try {
      const token = jwt.sign({ user_id: userId }, KEY, {
        expiresIn,
      })

      return token
    } catch {
      throw new TokenGenerationError()
    }
  }
}
