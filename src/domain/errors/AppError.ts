export class AppError extends Error {
  public statusCode: number = 500
  public isOperational: boolean = true

  constructor(message: string | object, statusCode: number) {
    super(typeof message === 'string' ? message : JSON.stringify(message))
    this.statusCode = statusCode
  }
}
