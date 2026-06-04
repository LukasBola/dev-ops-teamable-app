<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { Profile } from '../types/profile'
import { isValidEmail } from '../utils/validation'

const props = defineProps<{ profile: Profile }>()
const emit = defineEmits<{ save: [profile: Profile]; cancel: [] }>()

const form = reactive<Profile>({ ...props.profile })
const emailError = ref('')

function onAvatarChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    form.avatarUrl = reader.result as string
  }
  reader.readAsDataURL(file)
}

function onSave() {
  if (!isValidEmail(form.email)) {
    emailError.value = 'Podaj poprawny adres email.'
    return
  }
  emailError.value = ''
  emit('save', { ...form })
}
</script>

<template>
  <section class="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-100">
    <form class="flex flex-col gap-4" @submit.prevent="onSave">
      <div class="flex flex-col items-center gap-3">
        <img
          v-if="form.avatarUrl"
          :src="form.avatarUrl"
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
          type="text"
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
          @click.prevent="onSave"
        >
          Zapisz
        </button>
      </div>
    </form>
  </section>
</template>
