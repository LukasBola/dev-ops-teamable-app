import { z } from 'zod'

export const ProfileInputSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.union([z.literal(''), z.email()]),
  aboutMe: z.string(),
})

export type ProfileInput = z.infer<typeof ProfileInputSchema>
