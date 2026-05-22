import { ToolResultTypesEnum } from '@/domain/enums/ToolResultTypesEnum.js'
import { IToolResultMeta } from '../../interfaces/IToolResultMeta.js'

export class ToolResult {
  public success: boolean
  public content: any
  public meta: IToolResultMeta | null
  public type: ToolResultTypesEnum

  constructor(
    success: boolean,
    content: any = null,
    meta: IToolResultMeta | null = null,
    type: ToolResultTypesEnum = ToolResultTypesEnum.SUCCESS,
  ) {
    this.success = success
    this.content = content
    this.meta = meta
    this.type = type
  }
}
