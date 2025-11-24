import { ITask } from '@entities/ITask.ts'

export type ITaskWithTempClientId = ITask & { tempClientId?: string }
