import { StatusLog } from '@/application/types/StatusLog.js'
import { StatusToolContentMap, StatusToolName } from '@/application/types/StatusTools.js'
import { CustomEvents } from '@/enums/CustomEvents.js'
import { StatusStatesEnum } from '@/enums/StatusStatesEnum.js'
import { StatusTypesEnum } from '@/enums/StatusTypesEnum.js'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { Types } from 'mongoose'

type ToolStatusLog = Extract<StatusLog, { type: StatusTypesEnum.TOOL }>
type ToolName = StatusToolName
type ToolContentByName<TName extends ToolName> = StatusToolContentMap[TName]

export type ToolStatusLogByName<TName extends ToolName> = Omit<ToolStatusLog, 'content'> & {
  content: {
    id: string
    name: TName
    content: ToolContentByName<TName>
  }
}

export class ToolStatusLogLifecycleService {
  private isToolStatusLog(log?: StatusLog): log is ToolStatusLog {
    return !!log && log.type === StatusTypesEnum.TOOL
  }

  public async getOrCreateInProgressLog<TName extends ToolName>(params: {
    existingLog?: StatusLog
    toolCallId: string
    toolName: TName
    toolContent: ToolContentByName<TName>
  }): Promise<ToolStatusLogByName<TName>> {
    const { existingLog, toolCallId, toolName, toolContent } = params

    if (this.isToolStatusLog(existingLog)) {
      if (existingLog.content.name !== toolName) {
        throw new Error(`Unexpected status log type for ${toolName}: ${existingLog.content.name}`)
      }

      existingLog.state = StatusStatesEnum.IN_PROGRESS
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, existingLog)

      return existingLog as ToolStatusLogByName<TName>
    }

    const log: ToolStatusLogByName<TName> = {
      id: new Types.ObjectId().toString(),
      type: StatusTypesEnum.TOOL,
      state: StatusStatesEnum.IN_PROGRESS,
      content: {
        id: toolCallId,
        name: toolName,
        content: toolContent,
      },
    }

    await dispatchCustomEvent(CustomEvents.STATUS_ADD_LOG, log)

    return log
  }

  private async transition<TName extends ToolName>(
    log: ToolStatusLogByName<TName>,
    state: StatusStatesEnum,
    mutateContent?: (content: ToolContentByName<TName>) => void,
  ) {
    log.state = state

    if (mutateContent) {
      mutateContent(log.content.content)
    }

    await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, log)
  }

  public async setCancelled<TName extends ToolName>(log: ToolStatusLogByName<TName>) {
    await this.transition(log, StatusStatesEnum.CANCELLED)
  }

  public async setAwaitingConfirmation<TName extends ToolName>(
    log: ToolStatusLogByName<TName>,
    mutateContent?: (content: ToolContentByName<TName>) => void,
  ) {
    await this.transition(log, StatusStatesEnum.AWAITING_CONFIRMATION, mutateContent)
  }

  public async setCompleted<TName extends ToolName>(
    log: ToolStatusLogByName<TName>,
    mutateContent?: (content: ToolContentByName<TName>) => void,
  ) {
    await this.transition(log, StatusStatesEnum.COMPLETED, mutateContent)
  }
}
