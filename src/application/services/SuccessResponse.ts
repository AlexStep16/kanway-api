export default class SuccessResponse {
  public success: boolean
  public error: null
  public result: any

  constructor(result: any) {
    this.success = true
    this.error = null
    this.result = result
  }
}
