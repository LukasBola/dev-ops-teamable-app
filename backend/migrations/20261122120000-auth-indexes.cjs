// Migration #2 (Etap 4.5): indeksy kolekcji Better Auth zakładane PRZED startem aplikacji.
// Adapter Better Auth też je zakłada, ale leniwie i przy błędzie tylko loguje - przy duplikatach
// e-maili unikalność po cichu by nie działała. Tu błąd przerywa migrację, a entrypoint (set -e)
// nie wpuszcza aplikacji. Nazwy i opcje = te z adaptera (better-auth 1.7.x), więc się nie gryzą.
const INDEXES = [
  { collection: 'user', key: { email: 1 }, name: 'user_email_uidx', unique: true },
  { collection: 'session', key: { token: 1 }, name: 'session_token_uidx', unique: true },
  { collection: 'session', key: { userId: 1 }, name: 'session_userId_idx', unique: false },
  { collection: 'account', key: { userId: 1 }, name: 'account_userId_idx', unique: false },
]

const DUPLICATE_KEY = 11000
const NAMESPACE_NOT_FOUND = 26
const INDEX_NOT_FOUND = 27

module.exports = {
  async up(db) {
    for (const { collection, key, name, unique } of INDEXES) {
      try {
        await db.collection(collection).createIndex(key, { name, unique })
      } catch (err) {
        if (err.code === DUPLICATE_KEY) {
          throw new Error(
            `Nie można założyć unikalnego indeksu ${name}: w kolekcji "${collection}" są duplikaty. ` +
              `Usuń je i uruchom migrację ponownie. Szczegóły: ${err.message}`,
          )
        }
        throw err
      }
    }
  },

  async down(db) {
    for (const { collection, name } of INDEXES) {
      try {
        await db.collection(collection).dropIndex(name)
      } catch (err) {
        if (err.code !== INDEX_NOT_FOUND && err.code !== NAMESPACE_NOT_FOUND) throw err
      }
    }
  },
}
