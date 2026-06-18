import { ICloneEntitiesContent } from '../interfaces/statuses/content/ICloneEntitiesContent.js'
import { ICreateEntitiesContent } from '../interfaces/statuses/content/ICreateEntitiesContent.js'
import { IDeleteArchiveEntitiesContent } from '../interfaces/statuses/content/IDeleteArchiveEntitiesContent.js'
import { IMoveEntitiesContent } from '../interfaces/statuses/content/IMoveEntitiesContent.js'
import { IRecoverEntitiesContent } from '../interfaces/statuses/content/IRecoverEntitiesContent.js'
import { IReorderEntitiesContent } from '../interfaces/statuses/content/IReorderEntitiesContent.js'
import { ISearchEntitiesContent } from '../interfaces/statuses/content/ISearchEntitiesContent.js'
import { ITextValue } from '../interfaces/statuses/content/ITextValue.js'
import { IUpdateEntitiesContent } from '../interfaces/statuses/content/IUpdateEntitiesContent.js'

export type StatusToolContentMap = {
  search_tasks: ISearchEntitiesContent
  create_tasks: ICreateEntitiesContent
  update_tasks: IUpdateEntitiesContent
  delete_archive_tasks: IDeleteArchiveEntitiesContent
  clone_tasks: ICloneEntitiesContent
  recover_tasks: IRecoverEntitiesContent
  move_tasks: IMoveEntitiesContent
  reorder_tasks: IReorderEntitiesContent

  search_columns: ISearchEntitiesContent
  create_columns: ICreateEntitiesContent
  update_columns: IUpdateEntitiesContent
  delete_archive_columns: IDeleteArchiveEntitiesContent
  clone_columns: ICloneEntitiesContent
  recover_columns: IRecoverEntitiesContent
  move_columns: IMoveEntitiesContent
  reorder_columns: IReorderEntitiesContent

  search_boards: ISearchEntitiesContent
  create_boards: ICreateEntitiesContent
  update_boards: IUpdateEntitiesContent
  delete_archive_boards: IDeleteArchiveEntitiesContent
  clone_boards: ICloneEntitiesContent
  recover_boards: IRecoverEntitiesContent
  move_boards: IMoveEntitiesContent
  reorder_boards: IReorderEntitiesContent

  search_workspaces: ISearchEntitiesContent
  create_workspaces: ICreateEntitiesContent
  update_workspaces: IUpdateEntitiesContent
  delete_archive_workspaces: IDeleteArchiveEntitiesContent
  clone_workspaces: ICloneEntitiesContent
  recover_workspaces: IRecoverEntitiesContent
  move_workspaces: IMoveEntitiesContent
  reorder_workspaces: IReorderEntitiesContent

  undo_operations: ITextValue[]
}

export type StatusToolName = keyof StatusToolContentMap

export type StatusToolByName<TName extends StatusToolName = StatusToolName> = {
  id: string
  name: TName
  content: StatusToolContentMap[TName]
}

export type StatusTools = {
  [TName in StatusToolName]: StatusToolByName<TName>
}[StatusToolName]
