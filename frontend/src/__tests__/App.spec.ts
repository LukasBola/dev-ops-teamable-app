import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from '../App.vue'
import { getProfile, saveProfile } from '../services/profileService'
import type { Profile } from '../types/profile'

vi.mock('../services/profileService', () => ({
  getProfile: vi.fn<() => Promise<Profile>>(),
  saveProfile: vi.fn<(profile: Profile) => Promise<Profile>>(),
  uploadAvatar: vi.fn<(file: File) => Promise<{ avatarUrl: string }>>(),
}))

const remote: Profile = {
  firstName: 'Anna',
  lastName: 'Nowak',
  email: 'anna@example.com',
  aboutMe: 'Z backendu',
  avatarUrl: '',
}

beforeEach(() => {
  vi.mocked(getProfile).mockReset()
  vi.mocked(saveProfile).mockReset()
})

describe('App', () => {
  it('pokazuje loading, potem kartę profilu (FR-1)', async () => {
    vi.mocked(getProfile).mockResolvedValue(remote)
    const wrapper = mount(App)
    expect(wrapper.find('[data-test="loading"]').exists()).toBe(true)
    await flushPromises()
    expect(wrapper.find('[data-test="loading"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Anna')
  })

  it('pokazuje błąd, gdy backend nieosiągalny (spec 4)', async () => {
    vi.mocked(getProfile).mockRejectedValue(new Error('Backend jest nieosiągalny'))
    const wrapper = mount(App)
    await flushPromises()
    expect(wrapper.find('[data-test="load-error"]').text()).toBe('Backend jest nieosiągalny')
  })

  it('przełącza w tryb edycji i wraca po zapisie (FR-3, FR-4)', async () => {
    vi.mocked(getProfile).mockResolvedValue(remote)
    const updated = { ...remote, firstName: 'Ola' }
    vi.mocked(saveProfile).mockResolvedValue(updated)

    const wrapper = mount(App)
    await flushPromises()
    await wrapper.find('[data-test="edit-button"]').trigger('click')
    expect(wrapper.find('form').exists()).toBe(true)

    await wrapper.find('[data-test="firstName"]').setValue('Ola')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('Ola')
  })

  it('przy błędzie zapisu zostaje w edycji i pokazuje komunikat (spec 4)', async () => {
    vi.mocked(getProfile).mockResolvedValue(remote)
    vi.mocked(saveProfile).mockRejectedValue(new Error('Niepoprawny adres email'))

    const wrapper = mount(App)
    await flushPromises()
    await wrapper.find('[data-test="edit-button"]').trigger('click')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.find('[data-test="server-error"]').text()).toBe('Niepoprawny adres email')
  })

  it('Anuluj wraca do karty bez zapisu (FR-11)', async () => {
    vi.mocked(getProfile).mockResolvedValue(remote)
    const wrapper = mount(App)
    await flushPromises()
    await wrapper.find('[data-test="edit-button"]').trigger('click')
    await wrapper.find('[data-test="cancel-button"]').trigger('click')

    expect(wrapper.find('form').exists()).toBe(false)
    expect(saveProfile).not.toHaveBeenCalled()
  })
})
