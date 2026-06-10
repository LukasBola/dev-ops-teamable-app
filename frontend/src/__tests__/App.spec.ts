import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '../App.vue'
import type { Profile } from '../types/profile'

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

function okResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('App', () => {
  it('domyślnie pokazuje podgląd, nie formularz', () => {
    const wrapper = mount(App)
    expect(wrapper.find('[data-test="edit-button"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="save-button"]').exists()).toBe(false)
  })

  it('po kliknięciu Edytuj pokazuje formularz', async () => {
    const wrapper = mount(App)
    await wrapper.get('[data-test="edit-button"]').trigger('click')
    expect(wrapper.find('[data-test="save-button"]').exists()).toBe(true)
  })

  it('po zapisie wraca do podglądu z nowymi danymi', async () => {
    const savedProfile: Profile = {
      firstName: 'Zofia',
      lastName: '',
      email: 'zofia@example.com',
      aboutMe: '',
      avatarUrl: '',
    }
    fetchMock.mockResolvedValue(okResponse(savedProfile))
    const wrapper = mount(App)
    await wrapper.get('[data-test="edit-button"]').trigger('click')
    await wrapper.get('[data-test="firstName"]').setValue('Zofia')
    await wrapper.get('[data-test="email"]').setValue('zofia@example.com')
    await wrapper.get('form').trigger('submit')
    // flush promises from the async save
    await new Promise((r) => setTimeout(r, 0))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-test="save-button"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Zofia')
  })
})
