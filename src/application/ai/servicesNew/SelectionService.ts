import { Redis } from 'ioredis'
import { ISelection } from '../interfaces/ISelection.js'

export class SelectionService {
  protected redis: Redis = new Redis()
  protected redisKeyPrefix = 'selection:'

  public async addSelection(
    entityType: 'task' | 'category' | 'board' | 'workspace',
    entityIds: string[],
    humanReadableFilter: string,
    sample: any[],
    userId: string,
  ) {
    const id = crypto.randomUUID()
    const selection: ISelection = {
      id,
      entityType,
      entityIds,
      humanReadableFilter,
      sample,
      count: entityIds.length,
      userId,
    }
    await this.redis.set(this.redisKeyPrefix + id, JSON.stringify(selection), 'EX', 60 * 60) // Expire in 1 hour

    return selection
  }

  public async getSelection(id: string) {
    const data = await this.redis.get(this.redisKeyPrefix + id)
    if (!data) return null
    return JSON.parse(data) as ISelection
  }
}
