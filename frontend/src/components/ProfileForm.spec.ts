import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ProfileForm from './ProfileForm.vue'
import type { Profile } from '../types/profile'

const profile: Profile = {
  firstName: 'Jan',
  lastName: 'Kowalski',
  email: 'jan@example.com',
  aboutMe: 'About',
  avatarUrl: '',
}

describe('ProfileForm', () => {
  it('zapisuje zmienione pola i emituje save (FR-4)', async () => {
    const wrapper = mount(ProfileForm, { props: { profile } })
    await wrapper.get('[data-test="firstName"]').setValue('Anna')
    await wrapper.get('[data-test="save-button"]').trigger('click')

    const saved = wrapper.emitted('save')
    expect(saved).toHaveLength(1)
    expect((saved![0][0] as Profile).firstName).toBe('Anna')
  })

  it('blokuje zapis i pokazuje błąd przy niepoprawnym emailu (FR-6)', async () => {
    const wrapper = mount(ProfileForm, { props: { profile } })
    await wrapper.get('[data-test="email"]').setValue('zly-email')
    await wrapper.get('[data-test="save-button"]').trigger('click')

    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.get('[data-test="email-error"]').text()).not.toBe('')
  })

  it('emituje cancel po kliknięciu Anuluj', async () => {
    const wrapper = mount(ProfileForm, { props: { profile } })
    await wrapper.get('[data-test="cancel-button"]').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
