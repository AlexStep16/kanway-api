import { IReordable } from '@/domain/entities/IReordable.ts'
import { ClientSession, FilterQuery, Model, Types, UpdateWriteOpResult } from 'mongoose'

export abstract class BaseRepository<TEntity, TModel extends Model<TEntity>> {
  protected model: TModel

  constructor(model: TModel) {
    this.model = model
  }

  public async findByIdAndUser(id: string, userId: Types.ObjectId): Promise<TEntity | null> {
    const doc = await this.model.findOne({ _id: id, user_id: userId }).lean()
    return doc as TEntity
  }

  public async findById(id: string): Promise<TEntity | null> {
    const doc = await this.model.findById(id).lean()
    return doc as TEntity
  }

  public async create(
    data: Partial<TEntity>,
    session: ClientSession | null = null
  ): Promise<TEntity> {
    const [newDoc] = await this.model.create([data], { session })

    return newDoc.toObject() as TEntity
  }

  public async createMany(
    data: Partial<TEntity>[],
    session: ClientSession | null = null
  ): Promise<TEntity[]> {
    const docs = await this.model.create(data, { session })

    return docs.map((doc) => doc.toObject() as TEntity)
  }

  private async _updateMany(
    filter: FilterQuery<TEntity>,
    data: Partial<TEntity>,
    session?: ClientSession
  ): Promise<UpdateWriteOpResult> {
    return this.model.updateMany(filter, { $set: data }, { session })
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

    const updateResult = await this._updateMany(
      { _id: { $in: idsToUpdate } } as FilterQuery<TEntity>,
      data,
      session
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

  public async bulkUpdateOrders(updates: IReordable[], session?: ClientSession): Promise<void> {
    if (updates.length === 0) return

    const bulkOperations = updates.map((item) => ({
      updateOne: {
        filter: { _id: item._id },
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
    session: ClientSession | null = null
  ): Promise<TEntity[]> {
    return this.model.find(filter).session(session).lean() as Promise<TEntity[]>
  }

  public async getCount(
    filter: FilterQuery<TEntity>,
    session: ClientSession | null = null
  ): Promise<number> {
    return await this.model.countDocuments(filter).session(session)
  }
}
