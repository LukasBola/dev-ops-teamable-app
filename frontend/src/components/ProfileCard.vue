<script setup lang="ts">
import type { Profile } from '../types/profile'

defineProps<{ profile: Profile }>()
defineEmits<{ edit: [] }>()
</script>

<template>
  <section class="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-100">
    <div class="flex flex-col items-center text-center">
      <img
        v-if="profile.avatarUrl"
        :src="profile.avatarUrl"
        alt="Zdjęcie profilowe"
        class="h-28 w-28 rounded-full object-cover"
      />
      <div
        v-else
        class="flex h-28 w-28 items-center justify-center rounded-full bg-gray-100 text-3xl text-gray-400"
        aria-hidden="true"
      >
        {{ profile.firstName.charAt(0) }}{{ profile.lastName.charAt(0) }}
      </div>

      <h1 class="mt-4 text-xl font-semibold text-gray-900">
        {{ profile.firstName }} {{ profile.lastName }}
      </h1>
      <a :href="`mailto:${profile.email}`" class="mt-1 text-sm text-indigo-600">
        {{ profile.email }}
      </a>

      <p class="mt-4 text-sm leading-relaxed text-gray-600">{{ profile.aboutMe }}</p>

      <button
        data-test="edit-button"
        type="button"
        class="mt-6 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        @click="$emit('edit')"
      >
        Edytuj profil
      </button>
    </div>
  </section>
</template>
