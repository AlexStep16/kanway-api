export class FailedToolResult {
  public success: boolean
  public errorMsg: string | null
  public result: any

  constructor(errorMsg: string) {
    this.success = false
    this.errorMsg = errorMsg
    this.result = null
  }
}
