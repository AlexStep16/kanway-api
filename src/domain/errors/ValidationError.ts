import { AppError } from '@errors/AppError.ts'

export class ValidationError extends AppError {
  constructor(message = 'Неверные входные данные.', details?: any) {
    super(message, 400)
  }
}
