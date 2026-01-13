import { ClientSession, FilterQuery, PopulateOptions, Types } from 'mongoose'
import { BaseRepository } from '../repositories/BaseRepository.ts'
import { SystemFields } from '@infrastructure/types/SystemFields.ts'

export abstract class BaseService<
  TRawEntity,
  TEntity,
  TCriteria,
  TResult = TEntity,
  TCreatePayload = Omit<TEntity, SystemFields>
> {
  constructor(
    protected repository: BaseRepository<TRawEntity, TEntity, TCriteria, TCreatePayload>
  ) {}

  protected getPopulateOptions(): PopulateOptions | (string | PopulateOptions)[] | null {
    return null
  }

  public async getByCriteria(
    criteria: TCriteria,
    userId?: Types.ObjectId,
    session?: ClientSession
  ): Promise<TResult[]> {
    const populateOptions = this.getPopulateOptions()

    const items = await this.repository.findByCriteria<TResult>(
      criteria,
      session,
      {
        populate: populateOptions || undefined,
      },
      userId
    )

    return items
  }

  public async getByFilter(
    filter: FilterQuery<TEntity>,
    session?: ClientSession
  ): Promise<TResult[]> {
    const populateOptions = this.getPopulateOptions()

    const items = await this.repository.findByFilter<TResult>(filter, session, {
      populate: populateOptions || undefined,
    })

    return items
  }

  public getCount(
    criteria: TCriteria,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<number> {
    return this.repository.getCount(criteria, session, userId)
  }
}
