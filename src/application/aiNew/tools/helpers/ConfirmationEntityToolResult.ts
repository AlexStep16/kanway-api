import { ToolResultTypesEnum } from '@/domain/enums/ToolResultTypesEnum.ts'
import { ToolResult } from './ToolResult.ts'

export class ConfirmationEntityToolResult extends ToolResult {
  constructor(meta: { toolCallId: string; logId: string }) {
    super(true, null, meta, ToolResultTypesEnum.CONFIRMATION)
  }
}
