import { NotFoundError } from './NotFound.js'

export class UserNotFoundError extends NotFoundError {
  constructor(message = 'Пользователь не найден.') {
    super(message)
  }
}
