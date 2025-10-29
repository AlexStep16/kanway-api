import { AppError } from '@errors/AppError.ts'

export class ValidationError extends AppError {
  constructor(message: string = 'Неверные входные данные.') {
    super(message, 400)
  }
}
