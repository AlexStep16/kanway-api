import { ToolResultTypesEnum } from '@/domain/enums/ToolResultTypesEnum.js'
import { ToolResult } from './ToolResult.js'

export class ConfirmationEntityToolResult extends ToolResult {
  constructor(meta: { toolCallId: string; logId: string }) {
    super(true, null, meta, ToolResultTypesEnum.CONFIRMATION)
  }
}
