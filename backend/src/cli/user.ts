import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'
import { ZodError } from 'zod'
import { createCredentialUser, deleteUser, setPassword } from '../auth/users.js'
import { adoptLegacyProfile } from '../services/legacyProfile.js'
import { connectDb, disconnectDb } from '../db/connection.js'

const USAGE =
  'Użycie: user <create|delete|set-password> --email <e-mail> [--password <hasło, 8-128 znaków>]'
const COMMANDS = ['create', 'delete', 'set-password']

/** Zwraca kod wyjścia: 0 - OK, 1 - błąd operacji, 2 - złe użycie. */
export async function runUserCli(argv: string[]): Promise<number> {
  let parsed
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: { email: { type: 'string' }, password: { type: 'string' } },
    })
  } catch (err) {
    console.error(`${(err as Error).message}\n${USAGE}`)
    return 2
  }
  const [command] = parsed.positionals
  const { email, password } = parsed.values
  if (!COMMANDS.includes(command) || !email || (command !== 'delete' && !password)) {
    console.error(USAGE)
    return 2
  }

  try {
    if (command === 'create') {
      const user = await createCredentialUser({ email, password: password! })
      console.log(`Utworzono konto ${user.email}`)
      if (await adoptLegacyProfile(user.id))
        console.log('Przejęto istniejący profil (sprzed kont).')
    } else if (command === 'set-password') {
      await setPassword(email, password!)
      console.log(`Zmieniono hasło ${email}; wszystkie sesje unieważnione.`)
    } else {
      await deleteUser(email)
      console.log(`Usunięto konto ${email} wraz z profilem i avatarem.`)
    }
    return 0
  } catch (err) {
    console.error(
      err instanceof ZodError
        ? 'Niepoprawny e-mail lub hasło (8-128 znaków).'
        : (err as Error).message,
    )
    return 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await connectDb()
    process.exitCode = await runUserCli(process.argv.slice(2))
  } catch (err) {
    console.error(err)
    process.exitCode = 1
  } finally {
    await disconnectDb()
  }
}
