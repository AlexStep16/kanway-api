import { TOOLS_TIPS_MAP } from '@/constants/TOOLS_TIPS_MAP.ts'
import { AgentRoles } from '@/enums/AgentRoles.ts'
import { BaseCallbackHandler } from '@langchain/core/callbacks/base'
import { Serialized } from '@langchain/core/load/serializable'
import type { Job } from 'bullmq'

export class BullMQCallbackHandler extends BaseCallbackHandler {
  name = 'BullMQCallbackHandler'
  private job: Job

  constructor(job: Job) {
    super()
    this.job = job
  }

  async handleToolStart(
    _t: Serialized,
    input: string,
    _: string,
    _a?: string | undefined,
    _b?: string[] | undefined,
    _c?: Record<string, unknown> | undefined,
    runName?: string | undefined,
  ) {
    const toolTip = TOOLS_TIPS_MAP.get(runName || '')

    await this.job.updateProgress({
      role: AgentRoles.TOOLS_EXECUTION,
      name: runName,
      input,
      title: toolTip,
    })
  }

  async handleCustomEvent(event: string, data: any) {
    if (event === AgentRoles.TOOLS_EXECUTION) {
      await this.job.updateProgress({ role: AgentRoles.TOOLS_EXECUTION })
    }

    if (event === AgentRoles.TOOLS_RETRIEVING) {
      await this.job.updateProgress({ role: AgentRoles.TOOLS_RETRIEVING })
    }

    if (event === AgentRoles.HISTORY_RETRIEVING) {
      await this.job.updateProgress({ role: AgentRoles.HISTORY_RETRIEVING })
    }

    if (event === AgentRoles.UNDO) {
      await this.job.updateProgress({ role: AgentRoles.UNDO, undo: data })
    }

    if (event === AgentRoles.INTEGRATION) {
      await this.job.updateProgress({
        role: AgentRoles.INTEGRATION,
        integration: data.integration,
      })
    }
  }
}
