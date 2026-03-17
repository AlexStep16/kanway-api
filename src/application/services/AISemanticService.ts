import { Types } from 'mongoose'

export class AISemanticService {
  public buildTextForEntities(
    entities: { id: Types.ObjectId; text: string | null }[],
    text: string,
    mode: 'set' | 'append' | 'prepend' | 'replace',
    text_to_replace?: string,
  ): { id: Types.ObjectId; text: string }[] {
    if (!entities || entities.length === 0 || !text.trim()) {
      return []
    }

    // --- Формирование новых текстов ---
    const newTextsData = entities.map((entity) => {
      if (entity.text === null) {
        return {
          id: entity.id,
          text: '',
        }
      }

      let newText = entity.text

      if (mode === 'append') {
        newText += text
      } else if (mode === 'prepend') {
        newText = text + newText
      } else if (mode === 'set') {
        newText = text
      } else if (mode === 'replace') {
        newText = text_to_replace ? newText.replace(text_to_replace, text) : text
      }

      return {
        id: entity.id,
        text: newText.trim(),
      }
    })

    // --- Формирование операций bulkWrite ---
    const updatedTexts = newTextsData.map((data) => {
      return {
        id: data.id,
        text: data.text,
      }
    })

    return updatedTexts
  }
}
