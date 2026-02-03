import { Request, Response, NextFunction } from 'express'
import { ZodSchema, z } from 'zod'
import { ValidationError } from '@errors/ValidationError.ts'

export const validationMiddleware = (schema: ZodSchema) => {
  return async (req: Request, _: Response, next: NextFunction) => {
    try {
      const parsedData = await schema.parseAsync(req.body)

      req.body = parsedData

      next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map((e) => `${e.message}`).join('; ')

        next(new ValidationError(issues))
        return
      }

      next(error)
    }
  }
}
