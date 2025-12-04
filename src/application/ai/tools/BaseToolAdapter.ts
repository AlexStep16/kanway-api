import { BaseService } from '@application/services/BaseService.ts'

export abstract class BaseToolAdapter {
  protected baseService: BaseService // Общие сервисы
  // ...

  constructor(baseService: BaseService) {
    this.baseService = baseService
  }

  /* Вспомогательный метод для поиска схожести, который может использовать LLM
  protected async similaritySearch(query: string, type: EntityType) {
    ...
  }*/
}
