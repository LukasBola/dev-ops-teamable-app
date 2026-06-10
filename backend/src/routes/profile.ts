import { Router } from 'express'
import { ProfileInputSchema } from '../schemas/profile.js'
import { readProfile, writeProfile, deleteProfile } from '../services/profileStore.js'
import { HttpError } from '../middleware/errorHandler.js'

export const profileRouter = Router()

profileRouter.get('/', async (_req, res) => {
  res.json(await readProfile())
})

profileRouter.put('/', async (req, res) => {
  const parsed = ProfileInputSchema.safeParse(req.body)
  if (!parsed.success) {
    // Only treat it as an email error when the ONLY invalid field is email
    // and all other required fields are present.
    const failingPaths = [...new Set(parsed.error.issues.map((issue) => issue.path[0]))]
    const onlyEmailFails = failingPaths.length === 1 && failingPaths[0] === 'email'
    throw new HttpError(400, onlyEmailFails ? 'Niepoprawny adres email' : 'Niepoprawne dane profilu')
  }
  res.json(await writeProfile(parsed.data))
})

profileRouter.delete('/', async (_req, res) => {
  await deleteProfile()
  res.status(204).end()
})
