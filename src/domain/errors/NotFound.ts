import { AppError } from '@errors/AppError.ts'

export class NotFoundError extends AppError {
  constructor(message = 'Сущность не найдена.') {
    super(message, 404)
  }
}
