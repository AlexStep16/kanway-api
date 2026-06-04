import { ICloneEntitiesContent } from '../interfaces/statuses/content/ICloneEntitiesContent.js'
import { IDeleteArchiveEntitiesContent } from '../interfaces/statuses/content/IDeleteArchiveEntitiesContent.js'
import { IMoveEntitiesContent } from '../interfaces/statuses/content/IMoveEntitiesContent.js'
import { IRecoverEntitiesContent } from '../interfaces/statuses/content/IRecoverEntitiesContent.js'
import { ISearchEntitiesContent } from '../interfaces/statuses/content/ISearchEntitiesContent.js'
import { ITextValue } from '../interfaces/statuses/content/ITextValue.js'
import { IUpdateEntitiesContent } from '../interfaces/statuses/content/IUpdateEntitiesContent.js'

export type StatusToolContentMap = {
  search_tasks: ISearchEntitiesContent
  update_tasks: IUpdateEntitiesContent
  delete_archive_tasks: IDeleteArchiveEntitiesContent
  clone_tasks: ICloneEntitiesContent
  recover_tasks: IRecoverEntitiesContent
  move_tasks: IMoveEntitiesContent

  search_categories: ISearchEntitiesContent
  update_categories: IUpdateEntitiesContent
  delete_archive_categories: IDeleteArchiveEntitiesContent
  clone_categories: ICloneEntitiesContent
  recover_categories: IRecoverEntitiesContent
  move_categories: IMoveEntitiesContent

  search_boards: ISearchEntitiesContent
  update_boards: IUpdateEntitiesContent
  delete_archive_boards: IDeleteArchiveEntitiesContent
  clone_boards: ICloneEntitiesContent
  recover_boards: IRecoverEntitiesContent
  move_boards: IMoveEntitiesContent

  search_workspaces: ISearchEntitiesContent
  update_workspaces: IUpdateEntitiesContent
  delete_archive_workspaces: IDeleteArchiveEntitiesContent
  clone_workspaces: ICloneEntitiesContent
  recover_workspaces: IRecoverEntitiesContent
  move_workspaces: IMoveEntitiesContent

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
