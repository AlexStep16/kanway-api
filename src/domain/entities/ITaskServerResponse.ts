import { ITask } from '@entities/ITask.ts'

export interface ITaskServerResponse extends ITask {
  tempClientId?: string
}
