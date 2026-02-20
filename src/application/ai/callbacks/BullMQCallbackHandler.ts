import { CustomEvents } from '@/enums/CustomEvents.ts'
import { BaseCallbackHandler } from '@langchain/core/callbacks/base'
import type { Job } from 'bullmq'

export class BullMQCallbackHandler extends BaseCallbackHandler {
  name = 'BullMQCallbackHandler'
  private job: Job

  constructor(job: Job) {
    super()
    this.job = job
  }

  async handleCustomEvent(event: string, data: any) {
    if (event === CustomEvents.TOOLS_RETRIEVING) {
      await this.job.updateProgress({ role: CustomEvents.TOOLS_RETRIEVING })
    }

    if (event === CustomEvents.HISTORY_RETRIEVING) {
      await this.job.updateProgress({ role: CustomEvents.HISTORY_RETRIEVING })
    }

    if (event === CustomEvents.UNDO) {
      await this.job.updateProgress({ role: CustomEvents.UNDO, undo: data })
    }

    if (event === CustomEvents.INTEGRATION) {
      await this.job.updateProgress({
        role: CustomEvents.INTEGRATION,
        integration: data.integration,
      })
    }
  }
}
