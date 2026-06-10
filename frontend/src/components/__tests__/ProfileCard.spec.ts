import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ProfileCard from '../ProfileCard.vue'
import type { Profile } from '../../types/profile'

const profile: Profile = {
  firstName: 'Jan',
  lastName: 'Kowalski',
  email: 'jan@example.com',
  aboutMe: 'About me text',
  avatarUrl: '',
}

describe('ProfileCard', () => {
  it('wyświetla pola profilu (FR-1)', () => {
    const wrapper = mount(ProfileCard, { props: { profile } })
    expect(wrapper.text()).toContain('Jan')
    expect(wrapper.text()).toContain('Kowalski')
    expect(wrapper.text()).toContain('jan@example.com')
    expect(wrapper.text()).toContain('About me text')
  })

  it('ma przycisk edycji i emituje edit po kliknięciu (FR-2, FR-3)', async () => {
    const wrapper = mount(ProfileCard, { props: { profile } })
    const btn = wrapper.get('[data-test="edit-button"]')
    await btn.trigger('click')
    expect(wrapper.emitted('edit')).toHaveLength(1)
  })
})
