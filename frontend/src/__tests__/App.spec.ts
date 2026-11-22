import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import type { Ref } from 'vue'
import App from '../App.vue'
import { ApiError, getProfile, saveProfile } from '../services/profileService'
import type { Profile } from '../types/profile'

type SessionState = {
  data: { user: { id: string; email: string } } | null
  isPending: boolean
  refetch: () => Promise<void>
}

const auth = vi.hoisted(() => ({
  signInEmail: vi.fn<(body: { email: string; password: string }) => Promise<unknown>>(),
  signOut: vi.fn<() => Promise<unknown>>(),
  refetch: vi.fn<() => Promise<void>>(),
}))

vi.mock('../services/authClient', async () => {
  const { ref } = await import('vue')
  const session = ref<SessionState>({ data: null, isPending: false, refetch: auth.refetch })
  return {
    session,
    useSession: () => session,
    signIn: { email: auth.signInEmail },
    signOut: auth.signOut,
  }
})

vi.mock('../services/profileService', async (importOriginal) => ({
  ApiError: (await importOriginal<typeof import('../services/profileService')>()).ApiError,
  getProfile: vi.fn<() => Promise<Profile>>(),
  saveProfile: vi.fn<(profile: Profile) => Promise<Profile>>(),
  uploadAvatar: vi.fn<(file: File) => Promise<{ avatarUrl: string }>>(),
}))

// Wspólny ref sesji: aplikacje z poprzednich testów muszą zniknąć, bo inaczej reagują na jego zmiany.
enableAutoUnmount(afterEach)

const { session } = (await import('../services/authClient')) as unknown as {
  session: Ref<SessionState>
}

const anna: Profile = {
  firstName: 'Anna',
  lastName: 'Nowak',
  email: 'anna@example.com',
  aboutMe: 'Z backendu',
  avatarUrl: '',
}
const USER_A = { id: 'user-a', email: 'anna@example.com' }
const USER_B = { id: 'user-b', email: 'bartek@example.com' }

function signedIn(user = USER_A) {
  session.value = { data: { user }, isPending: false, refetch: auth.refetch }
}

beforeEach(() => {
  vi.mocked(getProfile).mockReset()
  vi.mocked(saveProfile).mockReset()
  auth.signInEmail.mockReset()
  auth.signOut.mockReset().mockResolvedValue({ data: { success: true } })
  auth.refetch.mockReset().mockResolvedValue()
  session.value = { data: null, isPending: false, refetch: auth.refetch }
})

describe('App: sesja', () => {
  it('sesja w trakcie sprawdzania → „Wczytywanie”, bez zapytania o profil', () => {
    session.value = { data: null, isPending: true, refetch: auth.refetch }
    const wrapper = mount(App)
    expect(wrapper.find('[data-test="loading"]').exists()).toBe(true)
    expect(getProfile).not.toHaveBeenCalled()
  })

  it('brak sesji → formularz logowania i brak zapytania o profil (FR-15)', async () => {
    const wrapper = mount(App)
    await flushPromises()
    expect(wrapper.find('[data-test="login-email"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="logout-button"]').exists()).toBe(false)
    expect(getProfile).not.toHaveBeenCalled()
  })

  it('sesja → karta profilu, profil pobrany raz (FR-14)', async () => {
    vi.mocked(getProfile).mockResolvedValue(anna)
    signedIn()
    const wrapper = mount(App)
    await flushPromises()
    expect(wrapper.text()).toContain('Anna')
    expect(wrapper.find('[data-test="login-email"]').exists()).toBe(false)
    expect(getProfile).toHaveBeenCalledTimes(1)
  })
})

describe('App: logowanie', () => {
  async function submitLogin(wrapper: ReturnType<typeof mount>) {
    await wrapper.get('[data-test="login-email"]').setValue('anna@example.com')
    await wrapper.get('[data-test="login-password"]').setValue('tajne-haslo-123')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
  }

  it('woła signIn.email z danymi z formularza', async () => {
    auth.signInEmail.mockResolvedValue({ data: {}, error: null })
    const wrapper = mount(App)
    await submitLogin(wrapper)
    expect(auth.signInEmail).toHaveBeenCalledWith({
      email: 'anna@example.com',
      password: 'tajne-haslo-123',
    })
    expect(wrapper.find('[data-test="login-error"]').exists()).toBe(false)
  })

  it('złe dane → „Niepoprawny e-mail lub hasło”', async () => {
    auth.signInEmail.mockResolvedValue({ data: null, error: { status: 401, message: 'x' } })
    const wrapper = mount(App)
    await submitLogin(wrapper)
    expect(wrapper.get('[data-test="login-error"]').text()).toContain(
      'Niepoprawny e-mail lub hasło',
    )
  })

  it('za dużo prób (429) → komunikat, żeby odczekać', async () => {
    auth.signInEmail.mockResolvedValue({ data: null, error: { status: 429, message: 'x' } })
    const wrapper = mount(App)
    await submitLogin(wrapper)
    expect(wrapper.get('[data-test="login-error"]').text()).toContain('Za dużo prób logowania')
  })

  it('wyjątek sieci → komunikat o braku połączenia', async () => {
    auth.signInEmail.mockRejectedValue(new TypeError('Failed to fetch'))
    const wrapper = mount(App)
    await submitLogin(wrapper)
    expect(wrapper.get('[data-test="login-error"]').text()).toContain('Nie udało się połączyć')
  })
})

describe('App: wylogowanie i zmiana użytkownika', () => {
  it('Wyloguj → signOut, formularz logowania, komunikat i brak danych profilu (FR-16)', async () => {
    vi.mocked(getProfile).mockResolvedValue(anna)
    signedIn()
    auth.signOut.mockImplementation(async () => {
      session.value = { data: null, isPending: false, refetch: auth.refetch }
      return { data: { success: true } }
    })
    const wrapper = mount(App)
    await flushPromises()

    await wrapper.get('[data-test="logout-button"]').trigger('click')
    await flushPromises()

    expect(auth.signOut).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-test="login-email"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="status"]').text()).toBe('Wylogowano.')
    expect(wrapper.text()).not.toContain('Anna')
  })

  it('zmiana użytkownika A → B: dane A znikają, zanim przyjdzie profil B (Review Focus 3)', async () => {
    vi.mocked(getProfile).mockResolvedValueOnce(anna)
    signedIn(USER_A)
    const wrapper = mount(App)
    await flushPromises()
    expect(wrapper.text()).toContain('Anna')

    vi.mocked(getProfile).mockReturnValueOnce(new Promise(() => {})) // B jeszcze się ładuje
    signedIn(USER_B)
    await flushPromises()

    expect(wrapper.text()).not.toContain('Anna')
    expect(wrapper.find('[data-test="loading"]').exists()).toBe(true)
  })

  it('profil odpowiada 401 (sesja wygasła) → odświeżenie sesji', async () => {
    vi.mocked(getProfile).mockRejectedValue(new ApiError(401, 'Wymagane logowanie'))
    signedIn()
    mount(App)
    await flushPromises()
    expect(auth.refetch).toHaveBeenCalled()
  })

  it('zapis odpowiada 401 → odświeżenie sesji', async () => {
    vi.mocked(getProfile).mockResolvedValue(anna)
    vi.mocked(saveProfile).mockRejectedValue(new ApiError(401, 'Wymagane logowanie'))
    signedIn()
    const wrapper = mount(App)
    await flushPromises()
    await wrapper.get('[data-test="edit-button"]').trigger('click')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(auth.refetch).toHaveBeenCalled()
  })
})

describe('App: profil (zalogowany)', () => {
  beforeEach(() => signedIn())

  it('pokazuje błąd, gdy backend nieosiągalny (spec 4)', async () => {
    vi.mocked(getProfile).mockRejectedValue(new ApiError(0, 'Backend jest nieosiągalny'))
    const wrapper = mount(App)
    await flushPromises()
    expect(wrapper.get('[data-test="load-error"]').text()).toBe('Backend jest nieosiągalny')
  })

  it('przełącza w tryb edycji i wraca po zapisie (FR-3, FR-4)', async () => {
    vi.mocked(getProfile).mockResolvedValue(anna)
    vi.mocked(saveProfile).mockResolvedValue({ ...anna, firstName: 'Ola' })
    const wrapper = mount(App)
    await flushPromises()
    await wrapper.get('[data-test="edit-button"]').trigger('click')
    await wrapper.get('[data-test="firstName"]').setValue('Ola')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('[data-test="save-button"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Ola')
  })

  it('przy błędzie zapisu zostaje w edycji i pokazuje komunikat (spec 4)', async () => {
    vi.mocked(getProfile).mockResolvedValue(anna)
    vi.mocked(saveProfile).mockRejectedValue(new ApiError(400, 'Niepoprawny adres email'))
    const wrapper = mount(App)
    await flushPromises()
    await wrapper.get('[data-test="edit-button"]').trigger('click')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('[data-test="save-button"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="server-error"]').text()).toBe('Niepoprawny adres email')
  })

  it('Anuluj wraca do karty bez zapisu (FR-11)', async () => {
    vi.mocked(getProfile).mockResolvedValue(anna)
    const wrapper = mount(App)
    await flushPromises()
    await wrapper.get('[data-test="edit-button"]').trigger('click')
    await wrapper.get('[data-test="cancel-button"]').trigger('click')
    expect(wrapper.find('[data-test="save-button"]').exists()).toBe(false)
    expect(saveProfile).not.toHaveBeenCalled()
  })
})
