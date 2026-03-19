import { ToolResultTypesEnum } from '@/domain/enums/ToolResultTypesEnum.ts'

export class ToolResult {
  public success: boolean
  public content: any
  public meta: any
  public type: ToolResultTypesEnum

  constructor(success: boolean, content: any = null, meta: any = null, type: number = 0) {
    this.success = success
    this.content = content
    this.meta = meta
    this.type = type
  }
}
