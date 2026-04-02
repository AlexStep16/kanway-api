import { IUser } from '@domain/entities/IUser.ts'
import { IOperationLog } from '@domain/entities/IOperationLog.ts'
import { ClientSession } from 'mongoose'
import { IResponseWithLog } from '../IResponseWithLog.ts'

export interface IRevertableService {
  revert(
    log: IOperationLog,
    user: IUser,
    session: ClientSession,
    isDryRun?: boolean,
  ): Promise<IResponseWithLog<any>>
}
