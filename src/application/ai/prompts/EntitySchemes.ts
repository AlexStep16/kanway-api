export const EntitySchemes = `
All entities share read-only metadata: 'rank: string', 'createdAt: string', 'updatedAt: string'.

\`\`\`typescript
type Workspace = {{ _id: ObjectId, name: string, is_favorite: boolean = false, color: string, /* metadata */ }}
type Board = {{ _id: ObjectId, name: string, workspace: ObjectId, is_favorite: boolean = false, /* metadata */ }}
type Category = {{ _id: ObjectId, name: string, board: ObjectId, workspace: ObjectId, /* metadata */ }}
type Task = {{ 
  _id: ObjectId, name: string, category: ObjectId, board: ObjectId, workspace: ObjectId, 
  description?: string, due_date?: string ('YYYY-MM-DD' format), due_hours?: number, due_minutes?: number, 
  priority?: "low" | "medium" | "high",
  color?: {{
    value: "red" | "blue" | "yellow" | "purple" | "orange" | "green" | "lime" | "pink" | "neutral" | "gray"
    tone: "light" | "medium" | "dark"
  }}, 
  is_completed: boolean = false, tags: string[], /* metadata */ 
}}
\`\`\`
`
