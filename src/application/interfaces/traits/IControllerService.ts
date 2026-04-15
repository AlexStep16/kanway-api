import { IUser } from '@/domain/entities/IUser.js'
import { ClientSession, FilterQuery, Types } from 'mongoose'
import { IResponseWithLog } from '../IResponseWithLog.js'

export interface IControllerService<
  TEntity,
  TCriteria,
  TCreateDTO,
  TEditDTO,
  TResult = Record<string, any>,
  TMoveDTO = Record<string, any>,
> {
  getCount(criteria: TCriteria, userId: Types.ObjectId, session?: ClientSession): Promise<number>
  getByCriteria(
    criteria: TCriteria,
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<TResult[]>
  getByFilter(filter: FilterQuery<TEntity>, session?: ClientSession): Promise<any>

  create(data: TCreateDTO, user: IUser, externalSession?: ClientSession): Promise<any>
  createMany(data: TCreateDTO[], user: IUser, externalSession?: ClientSession): Promise<any>

  edit(
    data: TEditDTO,
    criteria: TCriteria,
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<any>
  editMany(data: TEditDTO[], user: IUser, externalSession?: ClientSession): Promise<any>

  delete(
    criteria: TCriteria,
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<IResponseWithLog<null>>

  archive(criteria: TCriteria, user: IUser, externalSession?: ClientSession): Promise<any>
  recover(criteria: TCriteria, user: IUser, externalSession?: ClientSession): Promise<any>
  clone(criteria: TCriteria, user: IUser, externalSession?: ClientSession): Promise<any>
  move(data: TMoveDTO, user: IUser, externalSession?: ClientSession): Promise<any>
}
