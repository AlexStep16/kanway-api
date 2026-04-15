import { IUser } from '@domain/entities/IUser.js'
import { IOperationLog } from '@domain/entities/IOperationLog.js'
import { ClientSession } from 'mongoose'
import { IResponseWithLog } from '../IResponseWithLog.js'

export interface IRevertableService {
  revert(
    log: IOperationLog,
    user: IUser,
    session: ClientSession,
    isDryRun?: boolean,
  ): Promise<IResponseWithLog<any>>
}
