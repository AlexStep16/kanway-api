import { ToolResultTypesEnum } from '@/domain/enums/ToolResultTypesEnum.js'
import { ToolResult } from './ToolResult.js'

export class FailedToolResult extends ToolResult {
  constructor(errorMsg: string) {
    super(false, errorMsg, null, ToolResultTypesEnum.FAILED)
  }
}
