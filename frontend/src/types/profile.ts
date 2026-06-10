export interface Profile {
  firstName: string
  lastName: string
  email: string
  aboutMe: string
  avatarUrl: string
}

export const DEFAULT_PROFILE: Profile = {
  firstName: 'Jan',
  lastName: 'Kowalski',
  email: 'jan.kowalski@example.com',
  aboutMe: 'Cześć! Tu uczę się DevOps na projekcie Teamable.',
  avatarUrl: '',
}
