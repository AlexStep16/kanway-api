import { StatusLog } from '@/application/types/StatusLog.js'

export type ToolReviewResumePayload = {
  toolId: string
  isConfirmed: boolean
  isRejected: boolean
  statusLog?: StatusLog
}
