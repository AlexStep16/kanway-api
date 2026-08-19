import { langgraphQueue } from '@/infrastructure/queues/index.js'
import * as Sentry from '@sentry/node'

export function createAbortWatcher(jobId: string | undefined, controller: AbortController) {
  let isCancelled = false

  const abort = () => {
    isCancelled = true

    if (!controller.signal.aborted) {
      controller.abort()
    }
  }

  const interval = setInterval(async () => {
    try {
      if (!jobId) {
        return
      }

      const freshJob = await langgraphQueue.getJob(jobId)

      if (freshJob?.data?.__abortSignal) {
        abort()
      }
    } catch (err) {
      Sentry.captureException(err, { extra: { jobId } })
    }
  }, 100)

  return {
    abort,
    stop() {
      clearInterval(interval)
    },
    isCancelled() {
      return isCancelled || controller.signal.aborted
    },
  }
}
