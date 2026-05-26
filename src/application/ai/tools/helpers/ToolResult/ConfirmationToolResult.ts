import { ToolResultTypesEnum } from '@/domain/enums/ToolResultTypesEnum.js'
import { ToolResult } from './ToolResult.js'
import { IToolResultMeta } from '../../../interfaces/IToolResultMeta.js'

export class ConfirmationToolResult extends ToolResult {
  constructor(meta: IToolResultMeta | null) {
    super(true, null, meta, ToolResultTypesEnum.CONFIRMATION)
  }
}
