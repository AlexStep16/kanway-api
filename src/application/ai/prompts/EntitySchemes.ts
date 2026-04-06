export const EntitySchemes = `
/** 
 * Common Types 
 */
type ISODateString = string; // e.g., "2026-03-02T10:00:00Z"
type ObjectId = string;      // Unique MongoDB ObjectId hex string

/**
 * ENTITY: Task
 * Belongs to a Category (Column).
 */
type Task = {{
  _id: ObjectId;              // Read-only
  name: string;             // Required
  category: ObjectId;         // Required
  board: ObjectId;            // Required
  workspace: ObjectId;        // Required
  
  // Optional Fields
  description?: string;     // Default: ""
  due_date?: string;        // ISO 8601 Date String (e.g., "2024-12-01")
  due_hours?: number;       // 0-23
  due_minutes?: number;     // 0-59
  
  priority?: "low" | "medium" | "high"; // Enum
  
  color?: {{
    value: "red" | "blue" | "yellow" | "purple" | "orange" | "green" | "lime" | "pink" | "neutral" | "gray";
    tone: "light" | "medium" | "dark";
  }};

  is_completed: boolean;    // Default: false
  tags: string[];           // Array of strings (e.g., ["bug", "urgent"])

  // Metadata (Read-only - DO NOT ATTEMPT TO MANUALLY UPDATE)
  rank: string;             // Lexorank string (managed by system)
  createdAt: ISODateString;
  updatedAt: ISODateString;
}}

/**
 * ENTITY: Workspace
 * The top-level container for boards.
 */
type Workspace = {{
  _id: ObjectId;
  name: string;
  is_favorite: boolean;
  color: "#ff6467" | "#fdc700" | "#05df72" | "#3b82f6" | "#7c86ff" | "#cfbbff" | "#fb64b6" | "#99a1af";

  // Metadata (Read-only - DO NOT ATTEMPT TO MANUALLY UPDATE)
  rank: string;             // Lexorank string (managed by system)
  createdAt: ISODateString;
  updatedAt: ISODateString;
}}

/**
 * ENTITY: Board
 * Belongs to a Workspace. Contains Categories.
 */
type Board = {{
  _id: ObjectId;
  name: string;
  workspace: ObjectId; // Ref to Workspace
  is_favorite: boolean;
  
  // Metadata (Read-only - DO NOT ATTEMPT TO MANUALLY UPDATE)
  rank: string;             // Lexorank string (managed by system)
  createdAt: ISODateString;
  updatedAt: ISODateString;
}}

/**
 * ENTITY: Category
 * Belongs to a Board. Acts as a "Column" for Tasks.
 */
type Category = {{
  _id: ObjectId;
  name: string;
  board: ObjectId;     // Ref to Board
  workspace: ObjectId; // Ref to Workspace
  
  // Metadata (Read-only - DO NOT ATTEMPT TO MANUALLY UPDATE)
  rank: string;             // Lexorank string (managed by system)
  createdAt: ISODateString;
  updatedAt: ISODateString;
}}
`
