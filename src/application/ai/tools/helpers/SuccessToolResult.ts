import { ToolResultTypesEnum } from '@/domain/enums/ToolResultTypesEnum.js'
import { ToolResult } from './ToolResult.js'

export class SuccessToolResult extends ToolResult {
  constructor(content: any = null, meta: any = null) {
    super(true, content, meta, ToolResultTypesEnum.SUCCESS)
  }
}
