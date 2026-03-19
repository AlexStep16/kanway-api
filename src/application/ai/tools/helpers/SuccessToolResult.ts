import { ToolResultTypesEnum } from '@/domain/enums/ToolResultTypesEnum.ts'
import { ToolResult } from './ToolResult.ts'

export class SuccessToolResult extends ToolResult {
  constructor(content: any = null, meta: any = null) {
    super(true, content, meta, ToolResultTypesEnum.SUCCESS)
  }
}
