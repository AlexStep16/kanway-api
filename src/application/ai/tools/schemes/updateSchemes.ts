import z from 'zod'

export const StringUpdateSchema = z.union([
  z.string().nullable().describe('Directly overwrite the field with this value.'),
  z.object({
    op: z.enum(['append', 'prepend']).describe('Modify the existing string.'),
    value: z.string().describe('The string value to append or prepend.'),
  }),
])

export const DueDateUpdateSchema = z.union([
  z.iso.date().nullable().describe('Directly overwrite with a new absolute ISO 8601 DATE string.'),
  z.object({
    op: z.enum(['add_days']).describe('Shift the existing date relatively.'),
    value: z.number().int().describe('Number of days to shift.'),
  }),
])

export const DueHoursUpdateSchema = z.union([
  z.number().int().min(0).max(23).nullable().describe('Directly overwrite with a new hour (0-23).'),
  z.object({
    op: z.enum(['add_hours']).describe('Shift the existing hour relatively.'),
    value: z.number().int().describe('Number of hours to shift.'),
  }),
])

export const DueMinutesUpdateSchema = z.union([
  z
    .number()
    .int()
    .min(0)
    .max(59)
    .nullable()
    .describe('Directly overwrite with a new minute (0-59).'),
  z.object({
    op: z.enum(['add_minutes']).describe('Shift the existing minutes relatively.'),
    value: z.number().int().describe('Number of minutes to shift.'),
  }),
])

export const ArrayUpdateSchema = z.union([
  z.array(z.string()).describe('Directly overwrite the array with this new array of strings.'),
  z.object({
    op: z.enum(['add', 'remove']).describe('Add or remove items from the existing array.'),
    value: z.array(z.string()).describe('The array of strings to add or remove.'),
  }),
])
