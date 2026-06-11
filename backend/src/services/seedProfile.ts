import { ProfileModel, PROFILE_ID } from '../models/Profile.js'

export const DEMO_PROFILE = {
  firstName: 'Jan',
  lastName: 'Kowalski',
  email: 'jan@example.com',
  aboutMe: 'Przykładowy profil demo (seed).',
}

// Idempotent upsert of demo profile. Assumes active DB connection.
export async function seedDemoProfile(): Promise<void> {
  await ProfileModel.findByIdAndUpdate(
    PROFILE_ID,
    { $set: { ...DEMO_PROFILE } },
    { upsert: true, setDefaultsOnInsert: true },
  ).exec()
}
