import { TokenTypes } from '@domain/enums/TokenTypes.ts'
import jwt from 'jsonwebtoken'
import TokenRepository from '@repositories/TokenRepository.ts'
import { TokenGenerationError } from '@errors/TokenGenerationError.ts'
import { IToken } from '@entities/IToken.ts'
import { Types } from 'mongoose'

const KEY = process.env.JWT_KEY || 'FF123ABC-456D-789E-F012-3456789ABCDF'

export class TokenService {
  protected tokenRepository: TokenRepository

  constructor(tokenRepository: TokenRepository) {
    this.tokenRepository = tokenRepository
  }

  public async generateAndSaveConfirmationToken(user_id: Types.ObjectId): Promise<IToken> {
    try {
      const token = this.generateToken(user_id)

      if (!token) throw new TokenGenerationError()

      const tokenModel = await this.tokenRepository.create({
        token,
        user_id,
        type: TokenTypes.EMAIL_CONFIRMATION,
      })

      return tokenModel
    } catch (error) {
      throw new TokenGenerationError()
    }
  }

  public generateToken(user_id: Types.ObjectId): string {
    try {
      const token = jwt.sign({ user_id }, KEY, {
        expiresIn: 60 * 60 * 24 * 30,
      })

      return token
    } catch (error) {
      throw new TokenGenerationError()
    }
  }
}
