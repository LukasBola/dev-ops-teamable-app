import mongoose from 'mongoose'

export const PROFILE_ID = 'profile'

export interface ProfileDoc {
  _id: string
  firstName: string
  lastName: string
  email: string
  aboutMe: string
  avatarUrl: string
}

const profileSchema = new mongoose.Schema<ProfileDoc>(
  {
    _id: { type: String, default: PROFILE_ID },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    email: { type: String, default: '' },
    aboutMe: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
  },
  { versionKey: false, autoIndex: false, collection: 'profiles' },
)

export const ProfileModel =
  (mongoose.models.Profile as mongoose.Model<ProfileDoc>) ??
  mongoose.model<ProfileDoc>('Profile', profileSchema)
