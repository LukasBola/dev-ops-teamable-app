export interface Profile {
  firstName: string
  lastName: string
  email: string
  aboutMe: string
  avatarUrl: string
}

// Stage 2: first start = empty profile (FR-9). Real state comes from backend.
export const DEFAULT_PROFILE: Profile = {
  firstName: '',
  lastName: '',
  email: '',
  aboutMe: '',
  avatarUrl: '',
}
