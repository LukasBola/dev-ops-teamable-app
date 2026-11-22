<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import type { Profile } from '../types/profile'
import { isValidEmail } from '../utils/validation'

const props = defineProps<{ profile: Profile; serverError?: string }>()
const emit = defineEmits<{
  save: [payload: { profile: Profile; avatarFile: File | null }]
  cancel: []
}>()

const form = reactive<Profile>({ ...props.profile })
const emailError = ref('')
const avatarFile = ref<File | null>(null)
const previewUrl = ref('')
const emailInput = ref<HTMLInputElement | null>(null)

// Local preview (object URL) takes priority; without a file choice we show the saved avatar.
const displayedAvatar = computed(() => previewUrl.value || form.avatarUrl)

function onAvatarChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  avatarFile.value = file
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = URL.createObjectURL(file)
}

function onSave() {
  // Empty email allowed (FR-9); validate only non-empty (FR-6).
  if (form.email !== '' && !isValidEmail(form.email)) {
    emailError.value = 'Podaj poprawny adres e-mail, np. anna@firma.pl.'
    emailInput.value?.focus()
    return
  }
  emailError.value = ''
  emit('save', { profile: { ...form }, avatarFile: avatarFile.value })
}

onBeforeUnmount(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<template>
  <section class="px-6 pt-12 pb-7 sm:px-8" aria-labelledby="edit-title">
    <h1
      id="edit-title"
      class="font-display text-[1.85rem] leading-[1.05] font-extrabold tracking-tight"
    >
      Edycja profilu
    </h1>

    <form class="mt-5 grid gap-4" novalidate @submit.prevent="onSave">
      <div class="flex items-center gap-4">
        <img
          v-if="displayedAvatar"
          :src="displayedAvatar"
          alt="Podgląd zdjęcia"
          width="80"
          height="80"
          class="size-20 flex-none rounded-full object-cover"
        />
        <div
          v-else
          class="grid size-20 flex-none place-items-center rounded-full bg-field text-ink-soft"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            class="size-8"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          >
            <circle cx="12" cy="9" r="4" />
            <path d="M4.5 20c1.4-3.6 4.2-5.5 7.5-5.5s6.1 1.9 7.5 5.5" stroke-linecap="round" />
          </svg>
        </div>
        <label class="grid gap-1 text-sm font-bold">
          Zdjęcie
          <input
            data-test="avatar"
            type="file"
            name="avatar"
            accept="image/*"
            class="block w-full text-sm font-normal text-ink-soft file:mr-3 file:min-h-10 file:cursor-pointer file:rounded-lg file:border-[1.5px] file:border-ink file:bg-transparent file:px-3 file:font-bold file:text-ink"
            @change="onAvatarChange"
          />
        </label>
      </div>

      <label class="grid gap-1.5 font-bold">
        Imię
        <input
          data-test="firstName"
          v-model="form.firstName"
          type="text"
          name="firstName"
          autocomplete="given-name"
          class="min-h-12 rounded-xl border-[1.5px] border-line bg-field px-3.5 py-3 font-normal hover:border-ink-soft"
        />
      </label>

      <label class="grid gap-1.5 font-bold">
        Nazwisko
        <input
          data-test="lastName"
          v-model="form.lastName"
          type="text"
          name="lastName"
          autocomplete="family-name"
          class="min-h-12 rounded-xl border-[1.5px] border-line bg-field px-3.5 py-3 font-normal hover:border-ink-soft"
        />
      </label>

      <label class="grid gap-1.5 font-bold">
        E-mail kontaktowy
        <input
          data-test="email"
          ref="emailInput"
          v-model="form.email"
          type="email"
          name="email"
          spellcheck="false"
          autocomplete="email"
          :aria-invalid="emailError ? 'true' : undefined"
          class="min-h-12 rounded-xl border-[1.5px] border-line bg-field px-3.5 py-3 font-normal hover:border-ink-soft aria-invalid:border-error"
        />
        <span data-test="email-error" class="text-sm text-error" aria-live="polite">{{
          emailError
        }}</span>
      </label>

      <label class="grid gap-1.5 font-bold">
        O mnie
        <textarea
          data-test="aboutMe"
          v-model="form.aboutMe"
          name="aboutMe"
          rows="3"
          class="rounded-xl border-[1.5px] border-line bg-field px-3.5 py-3 font-normal hover:border-ink-soft"
        ></textarea>
      </label>

      <p
        v-if="serverError"
        data-test="server-error"
        role="alert"
        class="rounded-xl bg-error-bg px-3.5 py-3 font-bold text-error"
      >
        {{ serverError }}
      </p>

      <div class="mt-1 flex flex-wrap justify-end gap-3">
        <button
          data-test="cancel-button"
          type="button"
          class="min-h-11 cursor-pointer rounded-xl px-4 font-bold text-ink-soft hover:bg-field hover:text-ink"
          @click="emit('cancel')"
        >
          Anuluj
        </button>
        <button
          data-test="save-button"
          type="submit"
          class="min-h-11 cursor-pointer rounded-xl bg-ink px-5 font-bold text-badge hover:brightness-110"
        >
          Zapisz
        </button>
      </div>
    </form>
  </section>
</template>
