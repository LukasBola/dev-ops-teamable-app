import { describe, it, expect, afterEach } from 'vitest'
import { createRequire } from 'node:module'
import mongoose from 'mongoose'
import { createCredentialUser } from '../auth/users.js'

const require = createRequire(import.meta.url)
const migration = require('../../migrations/20261122120000-auth-indexes.cjs')

const db = () => mongoose.connection.db!

async function indexes(collection: string) {
  const list = await db()
    .collection(collection)
    .indexes()
    .catch(() => [])
  return list
    .filter((i) => i.name !== '_id_')
    .map((i) => ({ name: i.name, key: i.key, unique: i.unique === true }))
}

// Usunięcie kolekcji kasuje też indeksy, a instancja Better Auth nie zakłada ich drugi raz
// (pamięta, że już próbowała). Przywracamy je migracją, żeby nie wpłynąć na inne pliki testów.
afterEach(async () => {
  await migration.up(db())
})

describe('migration: auth-indexes', () => {
  it('up zakłada indeksy unikalne (user.email, session.token) i zwykłe (userId)', async () => {
    await db()
      .collection('user')
      .drop()
      .catch(() => {})
    await db()
      .collection('session')
      .drop()
      .catch(() => {})
    await db()
      .collection('account')
      .drop()
      .catch(() => {})

    await migration.up(db())

    expect(await indexes('user')).toEqual([
      { name: 'user_email_uidx', key: { email: 1 }, unique: true },
    ])
    expect(await indexes('session')).toEqual(
      expect.arrayContaining([
        { name: 'session_token_uidx', key: { token: 1 }, unique: true },
        { name: 'session_userId_idx', key: { userId: 1 }, unique: false },
      ]),
    )
    expect(await indexes('account')).toEqual([
      { name: 'account_userId_idx', key: { userId: 1 }, unique: false },
    ])
  })

  it('up jest idempotentne i zgodne z indeksami, które zakłada Better Auth', async () => {
    // Better Auth zakłada swoje indeksy przy pierwszej operacji - migracja nie może się z nimi gryźć.
    await createCredentialUser({ email: 'zgodny@example.com', password: 'tajne-haslo-123' })
    await expect(migration.up(db())).resolves.not.toThrow()
    await expect(migration.up(db())).resolves.not.toThrow()
    expect(await indexes('user')).toEqual([
      { name: 'user_email_uidx', key: { email: 1 }, unique: true },
    ])
  })

  it('po up baza odrzuca duplikat e-maila także z pominięciem kodu aplikacji', async () => {
    await db()
      .collection('user')
      .drop()
      .catch(() => {})
    await migration.up(db())

    const user = { name: 'x', email: 'dup@example.com', emailVerified: false }
    await db()
      .collection('user')
      .insertOne({ ...user })
    await expect(
      db()
        .collection('user')
        .insertOne({ ...user }),
    ).rejects.toMatchObject({
      code: 11000,
    })
  })

  it('równoległe tworzenie tego samego konta kończy się jednym użytkownikiem i jednym kontem', async () => {
    // Wyścig: oba wywołania przechodzą sprawdzenie "czy istnieje", zanim którekolwiek zapisze.
    const results = await Promise.allSettled([
      createCredentialUser({ email: 'wyscig@example.com', password: 'tajne-haslo-123' }),
      createCredentialUser({ email: 'wyscig@example.com', password: 'tajne-haslo-123' }),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(await db().collection('user').countDocuments({ email: 'wyscig@example.com' })).toBe(1)
    expect(await db().collection('account').countDocuments({})).toBe(1)
  })

  it('up przerywa się głośno, gdy w bazie są już zduplikowane e-maile', async () => {
    await db()
      .collection('user')
      .drop()
      .catch(() => {})
    const user = { name: 'x', email: 'stary-dup@example.com', emailVerified: false }
    await db()
      .collection('user')
      .insertMany([{ ...user }, { ...user }])

    await expect(migration.up(db())).rejects.toThrow(/stary-dup@example\.com/)
    expect(await indexes('user')).toEqual([])

    await db().collection('user').deleteMany({}) // posprzątaj, żeby afterEach mógł przywrócić indeks
  })

  it('down usuwa indeksy i jest bezpieczne, gdy ich nie ma', async () => {
    await migration.up(db())
    await migration.down(db())
    await migration.down(db())
    expect(await indexes('user')).toEqual([])
    expect(await indexes('account')).toEqual([])
    expect(await indexes('session')).toEqual([])
  })
})
