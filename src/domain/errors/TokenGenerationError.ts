import { AppError } from '@errors/AppError.ts'

export class TokenGenerationError extends AppError {
  constructor(message: string = 'Ошибка при создании токена сессии.') {
    super(message, 500)
  }
}
