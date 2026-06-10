import type { NextFunction, Request, Response } from 'express'
import { MulterError } from 'multer'

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

// Central mapping of exceptions to uniform error contract { error } (spec 3.1).
 
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message })
    return
  }
  if (err instanceof MulterError && err.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'Plik jest za duży (max 2 MB)' })
    return
  }
  console.error(err)
  res.status(500).json({ error: 'Wewnętrzny błąd serwera' })
}
