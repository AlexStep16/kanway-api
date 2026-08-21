import Workspace from '@/domain/models/WorkspaceModel.js'

export const WORKSPACE_VECTOR_INDEX_NAME = 'default'

export async function ensureWorkspaceVectorIndex() {
  try {
    const existingIndexes = await Workspace.listSearchIndexes()
    const indexExists = existingIndexes.some((idx) => idx.name === WORKSPACE_VECTOR_INDEX_NAME)

    if (indexExists) return

    await Workspace.createSearchIndex({
      name: WORKSPACE_VECTOR_INDEX_NAME,
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
