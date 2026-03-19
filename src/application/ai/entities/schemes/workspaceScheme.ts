import { BASE_COLORS } from '@/constants/BASE_COLORS.ts'

export const workspaceScheme = `
interface Workspace {
  _id: string; // Unique MongoDB ObjectId
  name: string; // Title of the workspace
  rank: string; // LexoRank string for ordering
  color: ${BASE_COLORS.join(' | ')}
  is_favorite: boolean; // Whether the workspace is marked as favorite
  createdAt: ISODateString; // e.g., "2026-03-02T10:00:00Z"
  updatedAt: ISODateString; // e.g., "2026-03-02T12:00:00Z"
}
`
