export const taskScheme = `
interface Task {
  _id: string; // Unique MongoDB ObjectId
  name: string; // Title of the task
  description?: string; // Optional detailed text
  category: string; // Category/Column ObjectId it belongs to
  board: string; // Board ObjectId it belongs to
  workspace: string; // Workspace ObjectId it belongs to
  due_date?: string; // Optional due date in "YYYY-MM-DD" format
  due_hours?: number;
  due_minutes?: number;
  priority?: "low" | "medium" | "high"; // Optional priority level
  color?: {
    value: 'red' | 'blue' | 'yellow' | 'purple' | 'orange' | 'green' | 'lime' | 'pink' | 'neutral' | 'gray',
    tone: 'light' | 'medium' | 'dark'
  }
  is_completed: boolean; // MUST use boolean (true/false), NOT string "Done"
  rank: string; // LexoRank string for ordering
  tags: string[]; // Array of lowercase strings (e.g., ["bug", "urgent"])
  createdAt: ISODateString; // e.g., "2026-03-02T10:00:00Z"
  updatedAt: ISODateString; // e.g., "2026-03-02T12:00:00Z"
}
`
