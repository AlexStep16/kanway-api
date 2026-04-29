import jwt, { JwtPayload } from 'jsonwebtoken'
import { TokenGenerationError } from '@errors/TokenGenerationError.js'
import { ErrorMessages } from '@/enums/ErrorMessages.js'

const KEY = process.env.JWT_KEY || 'FF123ABC-456D-789E-F012-3456789ABCDF'

export class TokenService {
  public generateToken(userId: string, expiresIn: number): string {
    try {
      const token = jwt.sign({ user_id: userId }, KEY, {
        expiresIn,
      })

      return token
    } catch {
      throw new TokenGenerationError(ErrorMessages.TOKEN_GENERATION_FAILED)
    }
  }

  public verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, KEY) as JwtPayload
    } catch {
      throw new TokenGenerationError(ErrorMessages.TOKEN_INVALID_OR_EXPIRED)
    }
  }
}
