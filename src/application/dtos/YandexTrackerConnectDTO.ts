import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

export const YandexTrackerConnectDTOSchema = z
  .object({
    code: z
      .string({
        error: () => ErrorMessages.YANDEX_TRACKER_CODE_REQUIRED,
      })
      .min(1, ErrorMessages.YANDEX_TRACKER_CODE_REQUIRED),
    codeVerifier: z
      .string({
        error: () => ErrorMessages.YANDEX_TRACKER_CODE_VERIFIER_REQUIRED,
      })
      .min(1, ErrorMessages.YANDEX_TRACKER_CODE_VERIFIER_REQUIRED),
  })
  .strict()

export type YandexTrackerConnectDTO = z.infer<typeof YandexTrackerConnectDTOSchema>
