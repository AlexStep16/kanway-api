import { AppError } from '@errors/AppError.js'

export class NotFoundError extends AppError {
  constructor(message = 'Сущность не найдена.') {
    super(message, 404)
  }
}
