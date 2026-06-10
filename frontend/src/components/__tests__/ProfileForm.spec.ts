import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ProfileForm from '../ProfileForm.vue'
import type { Profile } from '../../types/profile'

const profile: Profile = {
  firstName: 'Anna',
  lastName: 'Nowak',
  email: 'anna@example.com',
  aboutMe: 'Test',
  avatarUrl: '',
}

beforeEach(() => {
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn<() => string>(() => 'blob:preview'),
    revokeObjectURL: vi.fn<() => void>(),
  })
})

describe('ProfileForm', () => {
  it('emituje save z profilem i avatarFile=null, gdy nie wybrano zdjęcia (FR-4)', async () => {
    const wrapper = mount(ProfileForm, { props: { profile } })
    await wrapper.find('[data-test="firstName"]').setValue('Ola')
    await wrapper.find('form').trigger('submit')

    const emitted = wrapper.emitted('save')
    expect(emitted).toHaveLength(1)
    expect(emitted![0]![0]).toEqual({
      profile: { ...profile, firstName: 'Ola' },
      avatarFile: null,
    })
  })

  it('blokuje zapis przy niepustym niepoprawnym emailu (FR-6)', async () => {
    const wrapper = mount(ProfileForm, { props: { profile } })
    await wrapper.find('[data-test="email"]').setValue('zly-email')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.find('[data-test="email-error"]').text()).not.toBe('')
  })

  it('pozwala zapisać pusty email (FR-9)', async () => {
    const wrapper = mount(ProfileForm, { props: { profile } })
    await wrapper.find('[data-test="email"]').setValue('')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('save')).toHaveLength(1)
  })

  it('wybór pliku pokazuje lokalny podgląd bez wysyłki (FR-5, FR-11)', async () => {
    const wrapper = mount(ProfileForm, { props: { profile } })
    const file = new File(['img'], 'a.png', { type: 'image/png' })
    const input = wrapper.find('[data-test="avatar"]')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')

    const img = wrapper.find('img[alt="Podgląd zdjęcia"]')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('blob:preview')
  })

  it('po wyborze pliku emituje save z avatarFile', async () => {
    const wrapper = mount(ProfileForm, { props: { profile } })
    const file = new File(['img'], 'a.png', { type: 'image/png' })
    const input = wrapper.find('[data-test="avatar"]')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    await wrapper.find('form').trigger('submit')

    const payload = wrapper.emitted('save')![0]![0] as { avatarFile: File | null }
    expect(payload.avatarFile).toBe(file)
  })

  it('emituje cancel po kliknięciu Anuluj (FR-11)', async () => {
    const wrapper = mount(ProfileForm, { props: { profile } })
    await wrapper.find('[data-test="cancel-button"]').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('pokazuje błąd serwera przekazany propem (spec 4)', () => {
    const wrapper = mount(ProfileForm, {
      props: { profile, serverError: 'Niepoprawny adres email' },
    })
    expect(wrapper.find('[data-test="server-error"]').text()).toBe('Niepoprawny adres email')
  })
})
