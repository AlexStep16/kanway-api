import { ICloneEntitiesContent } from '../interfaces/Statuses/Content/ICloneEntitiesContent.js'
import { IDeleteArchiveEntitiesContent } from '../interfaces/Statuses/Content/IDeleteArchiveEntitiesContent.js'
import { IRecoverEntitiesContent } from '../interfaces/Statuses/Content/IRecoverEntitiesContent.js'
import { ISearchEntitiesContent } from '../interfaces/Statuses/Content/ISearchEntitiesContent.js'
import { IUpdateEntitiesContent } from '../interfaces/Statuses/Content/IUpdateEntitiesContent.js'

export type StatusToolContentMap = {
  search_tasks: ISearchEntitiesContent
  update_tasks: IUpdateEntitiesContent
  delete_archive_tasks: IDeleteArchiveEntitiesContent
  clone_tasks: ICloneEntitiesContent
  recover_tasks: IRecoverEntitiesContent
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
