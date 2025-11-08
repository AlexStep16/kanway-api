import { Request, Response, NextFunction } from 'express'
import { ZodSchema, z } from 'zod'
import { ValidationError } from '@errors/ValidationError.ts'

export const validationMiddleware = (schema: ZodSchema) => {
  return (req: Request, _: Response, next: NextFunction) => {
    try {
      console.log(schema)
      console.log(req.body)
      const parsedData = schema.parse(req.body)

      req.body = parsedData

      next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map((e) => `${e.message}`).join('; ')

        throw new ValidationError(issues)
      }

      next(error)
    }
  }
}
