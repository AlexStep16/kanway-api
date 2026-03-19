export const categoryScheme = `
interface Category {
  _id: string; // Unique MongoDB ObjectId
  name: string; // Title of the category
  board: string; // Board ObjectId it belongs to
  workspace: string; // Workspace ObjectId it belongs to
  rank: string; // LexoRank string for ordering
  createdAt: ISODateString; // e.g., "2026-03-02T10:00:00Z"
  updatedAt: ISODateString; // e.g., "2026-03-02T12:00:00Z"
}
`
