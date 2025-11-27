import { IUser } from '@domain/entities/IUser.ts'
import { IOperationLog } from '@domain/entities/IOperationLog.ts'
import { ClientSession } from 'mongoose'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.ts'
import { IUndoResponse } from '@interfaces/IUndoResponse.ts'

export interface IRevertableService<TEntity> {
  revert(
    log: IOperationLog,
    user: IUser,
    session: ClientSession
  ): Promise<IResponseWithLog<IUndoResponse<TEntity>>>
}
