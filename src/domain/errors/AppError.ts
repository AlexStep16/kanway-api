export class AppError extends Error {
  public statusCode: number = 500
  public isOperational: boolean = true

  constructor(message: string, statusCode: number) {
    super(message)
    this.statusCode = statusCode
  }
}
