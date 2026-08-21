import Task from '@/domain/models/TaskModel.js'

export const TASK_VECTOR_INDEX_NAME = 'default'

export async function ensureTaskVectorIndex() {
  try {
    const existingIndexes = await Task.listSearchIndexes()
    const indexExists = existingIndexes.some((idx) => idx.name === TASK_VECTOR_INDEX_NAME)

    if (indexExists) return

    await Task.createSearchIndex({
      name: TASK_VECTOR_INDEX_NAME,
      type: 'vectorSearch',
      definition: {
        fields: [
          {
            type: 'vector',
            path: 'embeddings',
            numDimensions: 1536,
            similarity: 'cosine',
          },
          {
            type: 'filter',
            path: 'board',
          },
          {
            type: 'filter',
            path: 'user_id',
          },
          {
            type: 'filter',
            path: 'is_deleted',
          },
        ],
      },
    })
  } catch (error: any) {
    if (error.codeName === 'IndexAlreadyExists' || error.message?.includes('already exists')) {
      return
    }
    console.error('[Vector Search] Failed to create vector index:', error)
  }
}
