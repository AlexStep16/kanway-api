import { ToolResultTypesEnum } from '@/domain/enums/ToolResultTypesEnum.ts'
import { ToolResult } from './ToolResult.ts'

export class FailedToolResult extends ToolResult {
  constructor(errorMsg: string) {
    super(false, errorMsg, null, ToolResultTypesEnum.FAILED)
  }
}
