import { ClientSession, FilterQuery, PopulateOptions, ProjectionType, Types } from 'mongoose'
import { BaseRepository, Options } from '../repositories/BaseRepository.js'
import { SystemFields } from '@infrastructure/types/SystemFields.js'

export abstract class BaseService<
  TRawEntity,
  TEntity,
  TCriteria,
  TResult = TEntity,
  TCreatePayload = Omit<TEntity, SystemFields>,
> {
  constructor(
    protected repository: BaseRepository<TRawEntity, TEntity, TCriteria, TCreatePayload>,
  ) {}

  protected getPopulateOptions(): PopulateOptions | (string | PopulateOptions)[] | null {
    return null
  }

  public async getByCriteria(
    criteria: TCriteria,
    userId?: Types.ObjectId,
    session?: ClientSession,
    projection?: ProjectionType<TRawEntity>,
    options?: { limit?: number; skip?: number; sort?: Record<string, any> },
  ): Promise<TResult[]> {
    const populateOptions = this.getPopulateOptions()

    const items = await this.repository.findByCriteria<TResult>(
      criteria,
      session,
      {
        populate: populateOptions || undefined,
        projection,
        ...options,
      },
      userId,
    )

    return items
  }

  public async getByFilter(
    filter: FilterQuery<TEntity>,
    session?: ClientSession,
    options?: Options<TRawEntity>,
  ): Promise<TResult[]> {
    const populateOptions = this.getPopulateOptions()

    const items = await this.repository.findByFilter<TResult>(filter, session, {
      populate: populateOptions || undefined,
      ...options,
    })

    return items
  }

  public getCount(
    criteria: TCriteria,
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<number> {
    return this.repository.getCount(criteria, session, userId)
  }
}
