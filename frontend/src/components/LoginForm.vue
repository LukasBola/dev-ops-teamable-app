<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{ error: string; pending: boolean }>()
const emit = defineEmits<{ submit: [credentials: { email: string; password: string }] }>()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const passwordInput = ref<HTMLInputElement | null>(null)

// Po błędzie: e-mail zostaje, hasło znika i dostaje fokus (poprawka zwykle dotyczy hasła).
watch(
  () => props.error,
  (error) => {
    if (!error) return
    password.value = ''
    passwordInput.value?.focus()
  },
  { flush: 'post' },
)

function onSubmit() {
  emit('submit', { email: email.value, password: password.value })
}
</script>

<template>
  <section class="px-6 pt-12 pb-7 sm:px-8" aria-labelledby="login-title">
    <h1
      id="login-title"
      data-focus
      tabindex="-1"
      class="font-display text-[1.85rem] leading-[1.05] font-extrabold tracking-tight text-balance sm:text-[2.1rem]"
    >
      Zaloguj się do zespołu
    </h1>
    <p class="mt-1.5 mb-6 text-ink-soft">
      Twój identyfikator czeka. Wpisz e-mail i hasło od właściciela zespołu.
    </p>

    <form class="grid gap-4" novalidate @submit.prevent="onSubmit">
      <div
        v-if="error"
        id="login-error"
        data-test="login-error"
        role="alert"
        class="flex items-start gap-2.5 rounded-xl bg-error-bg px-3.5 py-3 font-bold text-error"
      >
        <svg viewBox="0 0 20 20" class="mt-0.5 size-5 flex-none" aria-hidden="true">
          <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" stroke-width="2" />
          <path
            d="M10 5.5v5.5M10 13.6v.9"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
          />
        </svg>
        <p>{{ error }}</p>
      </div>

      <div class="grid gap-1.5">
        <label for="login-email" class="font-bold">E-mail</label>
        <input
          id="login-email"
          v-model="email"
          data-test="login-email"
          type="email"
          name="email"
          autocomplete="username"
          inputmode="email"
          autocapitalize="none"
          spellcheck="false"
          required
          :aria-invalid="error ? 'true' : undefined"
          :aria-describedby="error ? 'login-error' : undefined"
          class="min-h-12 w-full rounded-xl border-[1.5px] border-line bg-field px-3.5 py-3 hover:border-ink-soft aria-invalid:border-error"
        />
      </div>

      <div class="grid gap-1.5">
        <label for="login-password" class="font-bold">Hasło</label>
        <div class="relative">
          <input
            id="login-password"
            ref="passwordInput"
            v-model="password"
            data-test="login-password"
            :type="showPassword ? 'text' : 'password'"
            name="password"
            autocomplete="current-password"
            required
            :aria-invalid="error ? 'true' : undefined"
            :aria-describedby="error ? 'login-error' : undefined"
            class="min-h-12 w-full rounded-xl border-[1.5px] border-line bg-field py-3 pr-22 pl-3.5 hover:border-ink-soft aria-invalid:border-error"
          />
          <button
            data-test="password-toggle"
            type="button"
            aria-controls="login-password"
            :aria-pressed="showPassword"
            :aria-label="showPassword ? 'Ukryj hasło' : 'Pokaż hasło'"
            class="absolute top-1/2 right-1.5 min-h-10 -translate-y-1/2 cursor-pointer rounded-lg px-2.5 text-sm font-bold text-ink-soft hover:text-ink"
            @click="showPassword = !showPassword"
          >
            {{ showPassword ? 'Ukryj' : 'Pokaż' }}
          </button>
        </div>
      </div>

      <button
        data-test="login-button"
        type="submit"
        :disabled="pending"
        class="mt-1 inline-flex min-h-13 cursor-pointer items-center justify-center gap-2.5 rounded-[14px] bg-ink text-[1.02rem] font-bold text-badge hover:brightness-110 disabled:cursor-progress disabled:opacity-85"
      >
        <span
          v-if="pending"
          class="spinner size-[18px] rounded-full border-[2.5px] border-current border-r-transparent"
          aria-hidden="true"
        />
        {{ pending ? 'Logowanie…' : 'Zaloguj' }}
      </button>
    </form>

    <p class="mt-5 text-center text-sm text-ink-soft">
      Nie masz konta? Poproś właściciela zespołu o dostęp.
    </p>
  </section>
</template>

<style scoped>
.spinner {
  animation: spin 700ms linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation-duration: 2s;
  }
}
</style>
