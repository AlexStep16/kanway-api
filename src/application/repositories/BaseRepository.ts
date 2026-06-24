import {
  ClientSession,
  CreateOptions,
  DeleteResult,
  FilterQuery,
  Model,
  MongooseBulkWriteResult,
  PopulateOptions,
  ProjectionType,
  Types,
  UpdateWriteOpResult,
} from 'mongoose'
import { SingleUpdateDTO } from '../dtos/SingleUpdateDTO.js'
import { SystemFields } from '@/infrastructure/types/SystemFields.js'
import { toMongoCaseKeys, toServerCaseKeys } from '@/utils/objectTransformers.js'
import { SafeUpdateData } from '@/infrastructure/types/SafeUpdateData.js'

export type Options<TRawEntity> = {
  projection?: ProjectionType<TRawEntity> | null
  limit?: number
  populate?: PopulateOptions | (string | PopulateOptions)[]
  sort?: Record<string, 1 | -1>
  isMongoCase?: boolean
  skip?: number
}

export abstract class BaseRepository<
  TRawEntity,
  TEntity,
  TCriteria = Record<string, any>,
  TCreatePayload = Omit<TEntity, SystemFields>,
> {
  protected model: Model<TRawEntity>

  constructor(model: Model<TRawEntity>) {
    this.model = model
  }

  public buildFilter(criteria: TCriteria, userId?: Types.ObjectId): FilterQuery<TRawEntity> {
    const transformedCriteria = toMongoCaseKeys<TRawEntity>(criteria)
    const filter: FilterQuery<TRawEntity> = transformedCriteria as any

    if (userId) {
      ;(filter as any).user_id = userId
    }

    return filter
  }

  public async create(
    data: TCreatePayload,
    session: ClientSession | null = null,
  ): Promise<TEntity> {
    const mongoData = toMongoCaseKeys<Partial<TRawEntity>>(data)
    const [newDoc] = await this.model.create([mongoData], { session })
    const newDocObj = newDoc.toObject() as TRawEntity
    delete (newDocObj as any).embeddings

    return toServerCaseKeys<TEntity>(newDocObj)
  }

  public async createMany(
    data: TCreatePayload[],
    session: ClientSession | null = null,
  ): Promise<TEntity[]> {
    const mongoData = data.map(toMongoCaseKeys<Partial<TRawEntity>>)

    const options: CreateOptions = { session }

    if (session) {
      options.ordered = true
    }

    const docs = await this.model.create(mongoData, options)

    return docs.map((doc) => {
      const docObj = doc.toObject() as TRawEntity
      delete (docObj as any).embeddings

      return toServerCaseKeys<TEntity>(docObj)
    })
  }

  private async _updateMany(
    filter: FilterQuery<TRawEntity>,
    data: Partial<TRawEntity>,
    session?: ClientSession,
    unset?: Record<string, true>,
  ): Promise<UpdateWriteOpResult> {
    return this.model.updateMany(filter, { $set: data, $unset: unset }, { session })
  }

  public async updateMany(
    filter: FilterQuery<TRawEntity>,
    data: SafeUpdateData<TEntity>,
    session?: ClientSession,
  ): Promise<UpdateWriteOpResult> {
    const mongoData = toMongoCaseKeys<Partial<TRawEntity>>(data)

    const unset: Record<string, true> = {}

    Object.entries(mongoData).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        unset[key] = true
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete mongoData[key as keyof typeof mongoData]
      }
    })

    const updateResult = await this._updateMany(filter, mongoData, session, unset)

    return updateResult
  }

  public async updateManyByCriteria(
    criteria: TCriteria,
    data: SafeUpdateData<TEntity>,
    session?: ClientSession,
    userId?: Types.ObjectId,
  ): Promise<UpdateWriteOpResult> {
    const filter = this.buildFilter(criteria, userId)

    return this.updateMany(filter, data, session)
  }

  public async updateManyByFilter(
    filter: FilterQuery<TRawEntity>,
    data: SafeUpdateData<TEntity>,
    session?: ClientSession,
  ): Promise<UpdateWriteOpResult> {
    return this.updateMany(filter, data, session)
  }

  public async updateManyByFilterPipeline(
    filter: FilterQuery<TRawEntity>,
    pipeline: Record<string, any>[],
    session?: ClientSession,
  ): Promise<UpdateWriteOpResult> {
    return this.model.updateMany(filter, pipeline as any, { session })
  }

  public async bulkUpdate(
    updates: SingleUpdateDTO<SafeUpdateData<TEntity>>[],
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<MongooseBulkWriteResult | null> {
    if (updates.length === 0) return null

    const bulkOperations = updates.map((updateDto) => {
      const { id, ...dataToUpdate } = updateDto

      const mongoData = toMongoCaseKeys<any>(dataToUpdate)

      const setOp: Record<string, any> = {}
      const unsetOp: Record<string, true> = {}

      Object.entries(mongoData).forEach(([key, value]) => {
        if (value === null) {
          unsetOp[key] = true
        } else if (value !== undefined) {
          setOp[key] = value
        }
      })

      const updateDoc: any = {}
      if (Object.keys(setOp).length > 0) updateDoc.$set = setOp
      if (Object.keys(unsetOp).length > 0) updateDoc.$unset = unsetOp

      return {
        updateOne: {
          filter: { _id: new Types.ObjectId(id.toString()), user_id: userId },
          update: updateDoc,
        },
      }
    })

    const validOps = bulkOperations.filter(
      (op) => op.updateOne.update.$set || op.updateOne.update.$unset,
    )

    if (validOps.length === 0) return null

    return this.model.bulkWrite(validOps, { session })
  }

  public async deleteMany(
    criteria: TCriteria,
    userId?: Types.ObjectId,
    session?: ClientSession,
  ): Promise<DeleteResult> {
    const filter = this.buildFilter(criteria, userId)

    return await this.model.deleteMany(filter).session(session || null)
  }

  public async find<TFindResult = TEntity>(
    filter: FilterQuery<TRawEntity>,
    session: ClientSession | null = null,
    options: Options<TRawEntity> = {},
  ): Promise<TFindResult[]> {
    const {
      projection = null,
      limit = 1000,
      skip = 0,
      populate,
      sort = { created_at: -1 },
    } = options

    let query = this.model
      .find(filter, projection)
      .session(session)
      .limit(limit)
      .skip(skip)
      .sort(sort)

    if (populate) {
      query = query.populate(populate) as any
    }

    const result = await query.lean()

    return options.isMongoCase
      ? (result as TFindResult[])
      : result.map(toServerCaseKeys<TFindResult>)
  }

  public async findByCriteria<TFindResult = TEntity>(
    criteria: TCriteria,
    session: ClientSession | null = null,
    options: Options<TRawEntity> = {},
    userId?: Types.ObjectId,
  ): Promise<TFindResult[]> {
    const filter = this.buildFilter(criteria, userId)

    return this.find<TFindResult>(filter, session, options)
  }

  public async findByFilter<TFindResult = TEntity>(
    filter: FilterQuery<TRawEntity>,
    session: ClientSession | null = null,
    options: Options<TRawEntity> = {},
  ): Promise<TFindResult[]> {
    return this.find<TFindResult>(filter, session, options)
  }

  public async getCount(
    criteria: TCriteria,
    session: ClientSession | null = null,
    userId?: Types.ObjectId,
  ): Promise<number> {
    const filter = this.buildFilter(criteria, userId)

    return await this.model.countDocuments(filter).session(session)
  }

  public async getCountByFilter(
    filter: FilterQuery<TRawEntity>,
    session: ClientSession | null = null,
  ): Promise<number> {
    return await this.model.countDocuments(filter).session(session)
  }

  public async getCountGroupedByParents(
    parentIds: Types.ObjectId[],
    parentField: keyof TRawEntity,
    userId: Types.ObjectId,
    session: ClientSession | null = null,
  ): Promise<{ parentId: string; count: number }[]> {
    if (!parentIds.length) return []

    const pipeline = [
      {
        $match: {
          [parentField]: { $in: parentIds },
          user_id: userId,
          is_deleted: false,
        },
      },
      {
        $group: {
          _id: `$${String(parentField)}`,
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          parentId: { $toString: '$_id' },
          count: 1,
        },
      },
    ]

    return await this.model.aggregate(pipeline).session(session).exec()
  }

  public async getLastRanksByParents(
    parentIds: Types.ObjectId[],
    parentField: keyof TRawEntity,
    userId: Types.ObjectId,
    session: ClientSession | null = null,
  ): Promise<{ parentId: string; rank: string }[]> {
    if (!parentIds.length) return []

    const pipeline = [
      {
        $match: {
          [parentField]: { $in: parentIds },
          user_id: userId,
        },
      },
      {
        $sort: { rank: -1 as const },
      },
      {
        $group: {
          _id: `$${String(parentField)}`,
          rank: { $first: '$rank' },
        },
      },
      {
        $project: {
          _id: 0,
          parentId: { $toString: '$_id' },
          rank: 1,
        },
      },
    ]

    return await this.model.aggregate(pipeline).session(session).exec()
  }

  public async decrementFieldByCriteria(
    criteria: TCriteria,
    fieldName: keyof TRawEntity,
    decrementBy = 1,
    session?: ClientSession,
    userId?: Types.ObjectId,
  ): Promise<UpdateWriteOpResult> {
    const filter = this.buildFilter(criteria, userId)

    const atomicFilter = {
      ...filter,
      [fieldName]: { $gte: decrementBy },
    }

    return await this.model.updateOne(
      atomicFilter,
      { $inc: { [fieldName]: -decrementBy } } as any,
      { session },
    )
  }
}
