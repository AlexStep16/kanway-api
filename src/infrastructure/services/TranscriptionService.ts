import OpenAI, { toFile } from 'openai'
import fs from 'fs'
import { rm } from 'fs/promises'
import { AppError } from '@/domain/errors/AppError.js'
import { IDurationUsage } from '@/application/ai/interfaces/IDurationUsage.js'

export interface ITranscriptionResult {
  text: string
  usage?: IDurationUsage
}

export class TranscriptionService {
  private readonly openai = new OpenAI()

  public async transcribe(file: Express.Multer.File): Promise<ITranscriptionResult> {
    try {
      const response = await this.openai.audio.transcriptions.create({
        file: await toFile(fs.createReadStream(file.path), file.originalname, {
          type: file.mimetype,
        }),
        model: 'gpt-transcribe',
        language: 'ru',
      })

      return { text: response.text, usage: response.usage as IDurationUsage }
    } catch (error: any) {
      throw new AppError(`Ошибка распознавания речи: ${error.message || error}`, 502)
    } finally {
      await rm(file.path).catch(() => {})
    }
  }
}
