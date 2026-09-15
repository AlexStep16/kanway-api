import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const YandexTrackerImportDTOSchema = z
  .object({
    // Omitted/empty boardIds means "import all boards available for this token"
    boardIds: z.array(z.number(), ErrorMessages.YANDEX_TRACKER_BOARD_ID_INVALID).optional(),
    token: z
      .string({
        error: (iss) =>
          iss.input === undefined
            ? ErrorMessages.YANDEX_TRACKER_TOKEN_REQUIRED
            : ErrorMessages.YANDEX_TRACKER_TOKEN_INVALID,
      })
      .min(1, ErrorMessages.YANDEX_TRACKER_TOKEN_INVALID),
    orgId: z
      .string({
        error: (iss) =>
          iss.input === undefined
            ? ErrorMessages.YANDEX_TRACKER_ORG_ID_REQUIRED
            : ErrorMessages.YANDEX_TRACKER_ORG_ID_INVALID,
      })
      .min(1, ErrorMessages.YANDEX_TRACKER_ORG_ID_INVALID),
    workspaceId: z
      .string({
        error: (iss) =>
          iss.input === undefined
            ? ErrorMessages.WORKSPACE_ID_REQUIRED
            : ErrorMessages.WORKSPACE_ID_INVALID,
      })
      .regex(objectIdRegex, ErrorMessages.WORKSPACE_ID_INVALID),
  })
  .strict()

export type YandexTrackerImportDTO = z.infer<typeof YandexTrackerImportDTOSchema>
