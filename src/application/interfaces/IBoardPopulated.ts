import { IBoard } from '@entities/IBoard.js'
import { Types } from 'mongoose'

export type IBoardPopulated = IBoard<{
  id: Types.ObjectId
  name: string
}>
