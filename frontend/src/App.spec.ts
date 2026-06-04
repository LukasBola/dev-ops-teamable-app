import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import App from './App.vue'

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
  })

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
    const wrapper = mount(App)
    await wrapper.get('[data-test="edit-button"]').trigger('click')
    await wrapper.get('[data-test="firstName"]').setValue('Zofia')
    await wrapper.get('[data-test="save-button"]').trigger('click')

    expect(wrapper.find('[data-test="save-button"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Zofia')
  })
})
