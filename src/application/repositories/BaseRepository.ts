import { IReordable } from '@/domain/entities/IReordable.ts'
import {
  ClientSession,
  CreateOptions,
  FilterQuery,
  Model,
  ProjectionType,
  Types,
  UpdateWriteOpResult,
} from 'mongoose'
import { SingleUpdateDTO } from '../dtos/SingleUpdateDTO.ts'
import { SystemFields } from '@/infrastructure/types/SystemFields.ts'

export abstract class BaseRepository<TEntity, TModel extends Model<TEntity>> {
  protected model: TModel

  constructor(model: TModel) {
    this.model = model
  }

  public async findByIdAndUser(
    id: string,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<TEntity | null> {
    const doc = await this.model.findOne({ _id: id, user_id: userId }, null, { session }).lean()
    return doc as TEntity
  }

  public async findById(id: string, session?: ClientSession): Promise<TEntity | null> {
    const doc = await this.model.findById(id, null, { session }).lean()

    return doc as TEntity
  }

  public async create(
    data: Omit<TEntity, SystemFields>,
    session: ClientSession | null = null
  ): Promise<TEntity> {
    const [newDoc] = await this.model.create([data], { session })
    const newDocObj = newDoc.toObject() as TEntity
    delete (newDocObj as any).embeddings

    return newDocObj
  }

  public async createMany(
    data: Omit<TEntity, SystemFields>[],
    session: ClientSession | null = null
  ): Promise<TEntity[]> {
    const options: CreateOptions = { session }

    if (session) {
      options.ordered = true
    }

    const docs = await this.model.create(data, options)

    return docs.map((doc) => {
      const docObj = doc.toObject() as TEntity
      delete (docObj as any).embeddings

      return docObj
    })
  }

  private async _updateMany(
    filter: FilterQuery<TEntity>,
    data: Partial<TEntity>,
    session?: ClientSession,
    unset?: Record<string, true>
  ): Promise<UpdateWriteOpResult> {
    return this.model.updateMany(filter, { $set: data, $unset: unset }, { session })
  }

  public async updateByFilter(
    filter: FilterQuery<TEntity>,
    data: Partial<TEntity>,
    session?: ClientSession
  ): Promise<TEntity[]> {
    const docsToUpdate = await this.model
      .find(filter)
      .session(session || null)
      .select('_id')
      .lean()

    const idsToUpdate = docsToUpdate.map((doc) => doc._id)

    if (idsToUpdate.length === 0) return []

    const unset: Record<string, true> = {}

    Object.entries(data).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        unset[key] = true
        delete data[key as keyof typeof data]
      }
    })

    const updateResult = await this._updateMany(
      { _id: { $in: idsToUpdate } } as FilterQuery<TEntity>,
      data,
      session,
      unset
    )

    if (updateResult.modifiedCount === 0) return []

    const updatedEntities = (await this.model
      .find({ _id: { $in: idsToUpdate } })
      .session(session || null)
      .lean()) as TEntity[]

    return updatedEntities
  }

  public async updateById(
    id: string,
    userId: Types.ObjectId,
    data: Partial<TEntity>,
    session?: ClientSession
  ): Promise<TEntity | null> {
    const filter = { _id: id, user_id: userId } as FilterQuery<TEntity>

    const results = await this.updateByFilter(filter, data, session)

    return results[0] || null
  }

  public async bulkUpdate(
    updates: SingleUpdateDTO<Partial<TEntity>>[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<TEntity[]> {
    if (updates.length === 0) return []

    const bulkOperations = updates.map((item) => ({
      updateOne: {
        filter: { _id: item._id, user_id: userId },
        update: { $set: item },
        options: { runValidators: true },
      },
    }))

    const bulkUpdateResult = await this.model.bulkWrite(bulkOperations, { session })

    if (bulkUpdateResult.modifiedCount === 0) return []

    const updatedEntities = (await this.model
      .find({ _id: { $in: updates.map((u) => u._id) }, user_id: userId })
      .session(session || null)
      .lean()) as TEntity[]

    return updatedEntities
  }

  public async bulkUpdateOrders(
    updates: IReordable[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<void> {
    if (updates.length === 0) return

    const bulkOperations = updates.map((item) => ({
      updateOne: {
        filter: { _id: item._id, user_id: userId },
        update: { $set: { order: item.order } },
        options: { runValidators: false },
      },
    }))

    await this.model.bulkWrite(bulkOperations, { session })
  }

  public async deleteMany(filter: FilterQuery<TEntity>, session?: ClientSession): Promise<void> {
    await this.model.deleteMany(filter).session(session || null)
  }

  public async find(
    filter: FilterQuery<TEntity>,
    session: ClientSession | null = null,
    projection: ProjectionType<TEntity> | null = null,
    limit: number = 1000
  ): Promise<TEntity[]> {
    return this.model.find(filter, projection).session(session).limit(limit).lean() as Promise<
      TEntity[]
    >
  }

  public async getCount(
    filter: FilterQuery<TEntity>,
    session: ClientSession | null = null
  ): Promise<number> {
    return await this.model.countDocuments(filter).session(session)
  }
}
