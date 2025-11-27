import { Types } from 'mongoose'

export interface ITask {
  id: Types.ObjectId
  name: string
  workspaceId: Types.ObjectId
  workspaceName: string
  boardId: Types.ObjectId
  boardName: string
  categoryId: Types.ObjectId
  categoryName: string
  isDeleted: boolean
  isDeletedExternal: boolean
  order: number
  isCompleted: boolean
  tags: Array<string>
  userId: Types.ObjectId
  deletedTime?: Date
  description?: string
  dueDate?: string
  dueHours?: number
  dueMinutes?: number
  color?: [
    '#ffa2a2',
    '#ff6467',
    '#e7000b',

    '#8ec5ff',
    '#3b82f6',
    '#155dfc',

    '#ffdf20',
    '#f0b100',
    '#d08700',

    '#dab2ff',
    '#ad46ff',
    '#9810fa',

    '#ffb86a',
    '#ff6900',
    '#f54a00',

    '#7bf1a8',
    '#00c951',
    '#00a63e',

    '#bbf451',
    '#7ccf00',
    '#5ea500',

    '#fda5d6',
    '#f6339a',
    '#e60076',

    '#d4d4d4',
    '#737373',
    '#525252',

    '#d1d5dc',
    '#6a7282',
    '#4a5565'
  ][number]
  colorName?: string
  createdAt: Date
  updatedAt: Date
}
