export interface Profile {
  firstName: string
  lastName: string
  email: string
  aboutMe: string
  avatarUrl: string
}

export const EMPTY_PROFILE: Profile = {
  firstName: '',
  lastName: '',
  email: '',
  aboutMe: '',
  avatarUrl: '',
}
