import { ToolResultTypesEnum } from '@/domain/enums/ToolResultTypesEnum.js'
import { ToolResult } from './ToolResult.js'
import { IToolResultMeta } from '@/application/ai/interfaces/IToolResultMeta.js'

export class SuccessToolResult extends ToolResult {
  constructor(content: string = '', meta: IToolResultMeta | null = null) {
    super(true, content, meta, ToolResultTypesEnum.SUCCESS)
  }
}
