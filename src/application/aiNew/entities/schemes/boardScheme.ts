export const boardScheme = `
interface Board {
  _id: string; // Unique MongoDB ObjectId
  name: string; // Title of the board
  workspace: string; // Workspace ObjectId it belongs to
  order: number; // Position of the board in the workspace (0-based index)
  is_favorite: boolean; // Whether the board is marked as favorite
  createdAt: ISODateString; // e.g., "2026-03-02T10:00:00Z"
  updatedAt: ISODateString; // e.g., "2026-03-02T12:00:00Z"
}
`
