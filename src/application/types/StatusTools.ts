import { ISearchEntitiesContent } from '../interfaces/Statuses/Content/ISearchEntitiesContent.js'

interface IToolBase {
  id: string
}

interface ISearchTasksTool extends IToolBase {
  name: 'search_tasks'
  content: ISearchEntitiesContent
}

export type StatusTools = ISearchTasksTool
