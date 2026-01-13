import { IBoard } from '@entities/IBoard.ts'
import { Types } from 'mongoose'

export type IBoardPopulated = IBoard<{
  id: Types.ObjectId
  name: string
}>
