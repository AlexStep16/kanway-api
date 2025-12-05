import { Types } from 'mongoose'

export class AISemanticService {
  public async buildNamesForEntities(
    entities: { id: Types.ObjectId; name: string }[],
    text: string,
    mode: 'set' | 'append' | 'prepend' | 'replace',
    text_to_replace?: string
  ): Promise<{ id: string; name: string }[]> {
    if (!entities || entities.length === 0 || !text.trim()) {
      return []
    }

    // --- Формирование новых имён ---
    const newNamesData = entities.map((entity) => {
      let newName = entity.name

      if (mode === 'append') {
        newName += text
      } else if (mode === 'prepend') {
        newName = text + newName
      } else if (mode === 'set') {
        newName = text
      } else if (mode === 'replace') {
        newName = text_to_replace ? newName.replace(text_to_replace, text) : text
      }

      return {
        id: entity.id.toString(),
        name: newName.trim(),
      }
    })

    // --- Формирование операций bulkWrite ---
    const updatedNames = newNamesData.map((data) => {
      return {
        id: data.id,
        name: data.name,
      }
    })

    return updatedNames
  }

  /**
   * Обновляет описания задач с использованием заданного текста и режима.
   */
  public async buildDescriptionsForEntities(
    entities: { id: Types.ObjectId; description?: string }[],
    text: string,
    mode: 'set' | 'append' | 'prepend' | 'replace',
    text_to_replace?: string
  ): Promise<{ id: string; description: string }[]> {
    if (!entities || entities.length === 0 || !text.trim()) {
      return []
    }

    // --- Формирование новых описаний ---
    const newDescriptionsData = entities
      .filter((entity) => entity.description)
      .map((entity) => {
        let newDescription = entity.description || ''

        if (mode === 'append') {
          newDescription += text
        } else if (mode === 'prepend') {
          newDescription = text + newDescription
        } else if (mode === 'set') {
          newDescription = text
        } else if (mode === 'replace') {
          newDescription = text_to_replace ? newDescription.replace(text_to_replace, text) : text
        }

        return {
          id: entity.id.toString(),
          description: newDescription.trim(),
        }
      })

    // --- Формирование операций bulkWrite ---
    const updatedDescriptions = newDescriptionsData.map((data) => {
      return {
        id: data.id,
        description: data.description,
      }
    })

    return updatedDescriptions
  }
}
