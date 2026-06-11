import path from 'node:path'
import { Router } from 'express'
import multer from 'multer'
import { ProfileInputSchema } from '../schemas/profile.js'
import {
  readProfile,
  writeProfile,
  deleteProfile,
  saveAvatar,
  findAvatarPath,
} from '../services/profileStore.js'
import { HttpError } from '../middleware/errorHandler.js'

// Explicit allowlist (not image/*): excludes image/svg+xml which can contain scripts.
const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES[file.mimetype]) cb(null, true)
    else cb(new HttpError(400, 'Dozwolone tylko pliki graficzne'))
  },
})

export const profileRouter = Router()

profileRouter.get('/', async (_req, res) => {
  res.json(await readProfile())
})

profileRouter.put('/', async (req, res) => {
  const parsed = ProfileInputSchema.safeParse(req.body)
  if (!parsed.success) {
    const failingPaths = [...new Set(parsed.error.issues.map((i) => i.path[0]))]
    const emailIssue = failingPaths.length === 1 && failingPaths[0] === 'email'
    throw new HttpError(400, emailIssue ? 'Niepoprawny adres email' : 'Niepoprawne dane profilu')
  }
  res.json(await writeProfile(parsed.data))
})

profileRouter.delete('/', async (_req, res) => {
  await deleteProfile()
  res.status(204).end()
})

profileRouter.post('/avatar', upload.single('avatar'), async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Brak pliku')
  const ext = ALLOWED_TYPES[req.file.mimetype]
  if (!ext) throw new HttpError(400, 'Dozwolone tylko pliki graficzne')
  const avatarUrl = await saveAvatar(req.file.buffer, ext)
  res.json({ avatarUrl })
})

profileRouter.get('/avatar', async (_req, res, next) => {
  const avatarPath = await findAvatarPath()
  if (!avatarPath) throw new HttpError(404, 'Brak zdjęcia')
  // Pass dir as `root` + bare filename so sendFile's dotfiles:'ignore' check only
  // sees `avatar.png` — not a parent dir like `.claude/worktrees` that would 404.
  // sendFile sets Content-Type based on file extension.
  res.sendFile(path.basename(avatarPath), { root: path.dirname(avatarPath) }, (err) => {
    if (err) next(err)
  })
})
