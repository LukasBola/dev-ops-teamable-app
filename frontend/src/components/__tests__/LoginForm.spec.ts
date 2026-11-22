import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LoginForm from '../LoginForm.vue'

const mountForm = (props: { error?: string; pending?: boolean } = {}) =>
  mount(LoginForm, { props: { error: '', pending: false, ...props }, attachTo: document.body })

describe('LoginForm', () => {
  it('submit emituje { email, password } (Enter też działa, bo przycisk ma type="submit")', async () => {
    const wrapper = mountForm()
    await wrapper.get('[data-test="login-email"]').setValue('anna@example.com')
    await wrapper.get('[data-test="login-password"]').setValue('tajne-haslo-123')
    expect(wrapper.get('[data-test="login-button"]').attributes('type')).toBe('submit')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toEqual([
      [{ email: 'anna@example.com', password: 'tajne-haslo-123' }],
    ])
  })

  it('pola mają etykiety i podpowiedzi dla menedżera haseł (WCAG 3.3.8)', () => {
    const wrapper = mountForm()
    for (const [test, label, autocomplete] of [
      ['login-email', 'E-mail', 'username'],
      ['login-password', 'Hasło', 'current-password'],
    ]) {
      const input = wrapper.get(`[data-test="${test}"]`)
      expect(wrapper.get(`label[for="${input.attributes('id')}"]`).text()).toBe(label)
      expect(input.attributes('autocomplete')).toBe(autocomplete)
    }
  })

  it('błąd jest w role="alert" i oznacza pola jako niepoprawne', () => {
    const wrapper = mountForm({ error: 'Niepoprawny e-mail lub hasło' })
    const alert = wrapper.get('[data-test="login-error"]')
    expect(alert.attributes('role')).toBe('alert')
    expect(alert.text()).toContain('Niepoprawny e-mail lub hasło')
    expect(wrapper.get('[data-test="login-password"]').attributes('aria-invalid')).toBe('true')
  })

  it('bez błędu nie ma komunikatu', () => {
    expect(mountForm().find('[data-test="login-error"]').exists()).toBe(false)
  })

  it('po błędzie e-mail zostaje, hasło jest czyszczone i dostaje fokus', async () => {
    const wrapper = mountForm()
    await wrapper.get('[data-test="login-email"]').setValue('anna@example.com')
    await wrapper.get('[data-test="login-password"]').setValue('zle-haslo')
    await wrapper.setProps({ error: 'Niepoprawny e-mail lub hasło' })

    const email = wrapper.get<HTMLInputElement>('[data-test="login-email"]').element
    const password = wrapper.get<HTMLInputElement>('[data-test="login-password"]').element
    expect(email.value).toBe('anna@example.com')
    expect(password.value).toBe('')
    expect(document.activeElement).toBe(password)
    wrapper.unmount()
  })

  it('przycisk „Pokaż” przełącza widoczność hasła i stan aria-pressed', async () => {
    const wrapper = mountForm()
    const toggle = wrapper.get('[data-test="password-toggle"]')
    const password = wrapper.get('[data-test="login-password"]')
    expect(password.attributes('type')).toBe('password')
    expect(toggle.attributes('aria-pressed')).toBe('false')

    await toggle.trigger('click')
    expect(password.attributes('type')).toBe('text')
    expect(toggle.attributes('aria-pressed')).toBe('true')
    expect(toggle.text()).toBe('Ukryj')
  })

  it('w trakcie wysyłania przycisk jest zablokowany i mówi „Logowanie…”; poza nim zawsze aktywny', async () => {
    const wrapper = mountForm()
    expect(wrapper.get('[data-test="login-button"]').attributes('disabled')).toBeUndefined()
    await wrapper.setProps({ pending: true })
    const button = wrapper.get('[data-test="login-button"]')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.text()).toContain('Logowanie…')
  })

  it('mówi, kogo poprosić o konto (brak publicznej rejestracji, FR-17)', () => {
    expect(mountForm().text()).toContain('Poproś właściciela zespołu o dostęp')
  })

  it('puste pola blokuje walidacja przeglądarki: pola wymagane, formularz bez novalidate (FR-14)', () => {
    const wrapper = mountForm()
    expect(wrapper.get('form').attributes('novalidate')).toBeUndefined()
    expect(wrapper.get('[data-test="login-email"]').attributes('required')).toBeDefined()
    expect(wrapper.get('[data-test="login-password"]').attributes('required')).toBeDefined()
  })
})
