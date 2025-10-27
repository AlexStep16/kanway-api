import { IError } from '@interfaces/IError.ts'

export default class ErrorResponse {
  public success: boolean
  public error: IError
  public result: null

  constructor(description: string, code: number, message?: string) {
    this.success = false
    this.result = null
    this.error = {
      description: description,
      code: code,
      message: message,
    }
  }
}
