import Board from '@/domain/models/BoardModel.js'

export const BOARD_VECTOR_INDEX_NAME = 'default'

export async function ensureBoardVectorIndex() {
  try {
    const existingIndexes = await Board.listSearchIndexes()
    const indexExists = existingIndexes.some((idx) => idx.name === BOARD_VECTOR_INDEX_NAME)

    if (indexExists) return

    await Board.createSearchIndex({
      name: BOARD_VECTOR_INDEX_NAME,
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
            path: 'workspace',
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
