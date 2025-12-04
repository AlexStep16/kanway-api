export class SuccessToolResult {
  public success: boolean
  public errorMsg: string | null
  public result: any

  constructor(result: any) {
    this.success = true
    this.errorMsg = null
    this.result = result
  }
}
