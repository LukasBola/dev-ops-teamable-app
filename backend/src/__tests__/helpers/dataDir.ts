import { beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** Tymczasowy PROFILE_DATA_DIR na każdy test; zwraca funkcję z bieżącą ścieżką. */
export function useTempDataDir(prefix: string): () => string {
  let dir = ''
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix))
    process.env.PROFILE_DATA_DIR = dir
  })
  afterEach(async () => {
    delete process.env.PROFILE_DATA_DIR
    await fs.rm(dir, { recursive: true, force: true })
  })
  return () => dir
}

export const exists = (p: string) =>
  fs.access(p).then(
    () => true,
    () => false,
  )
