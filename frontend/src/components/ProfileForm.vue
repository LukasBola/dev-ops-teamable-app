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
    emailError.value = 'Podaj poprawny adres email.'
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
  <section class="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-100">
    <form class="flex flex-col gap-4" novalidate @submit.prevent="onSave">
      <div class="flex flex-col items-center gap-3">
        <img
          v-if="displayedAvatar"
          :src="displayedAvatar"
          alt="Podgląd zdjęcia"
          class="h-24 w-24 rounded-full object-cover"
        />
        <label class="text-sm text-indigo-600">
          Wczytaj zdjęcie
          <input
            data-test="avatar"
            type="file"
            accept="image/*"
            class="mt-1 block text-xs"
            @change="onAvatarChange"
          />
        </label>
      </div>

      <label class="flex flex-col gap-1 text-sm text-gray-700">
        Imię
        <input
          data-test="firstName"
          v-model="form.firstName"
          type="text"
          class="rounded-lg border border-gray-300 px-3 py-2"
        />
      </label>

      <label class="flex flex-col gap-1 text-sm text-gray-700">
        Nazwisko
        <input
          data-test="lastName"
          v-model="form.lastName"
          type="text"
          class="rounded-lg border border-gray-300 px-3 py-2"
        />
      </label>

      <label class="flex flex-col gap-1 text-sm text-gray-700">
        Email
        <input
          data-test="email"
          v-model="form.email"
          type="email"
          class="rounded-lg border border-gray-300 px-3 py-2"
        />
        <span data-test="email-error" class="text-xs text-red-600">{{ emailError }}</span>
      </label>

      <label class="flex flex-col gap-1 text-sm text-gray-700">
        About me
        <textarea
          data-test="aboutMe"
          v-model="form.aboutMe"
          rows="3"
          class="rounded-lg border border-gray-300 px-3 py-2"
        ></textarea>
      </label>

      <p v-if="serverError" data-test="server-error" class="text-sm text-red-600">
        {{ serverError }}
      </p>

      <div class="mt-2 flex justify-end gap-3">
        <button
          data-test="cancel-button"
          type="button"
          class="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          @click="emit('cancel')"
        >
          Anuluj
        </button>
        <button
          data-test="save-button"
          type="submit"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Zapisz
        </button>
      </div>
    </form>
  </section>
</template>
