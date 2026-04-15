import { AppError } from '@errors/AppError.js'

export class ValidationError extends AppError {
  constructor(message: string = 'Неверные входные данные.') {
    super(message, 400)
  }
}
