<script setup lang="ts">
import { computed } from 'vue'
import type { Profile } from '../types/profile'

const props = defineProps<{ profile: Profile }>()
defineEmits<{ edit: [] }>()

const fullName = computed(() => `${props.profile.firstName} ${props.profile.lastName}`.trim())
const initials = computed(
  () => `${props.profile.firstName.charAt(0)}${props.profile.lastName.charAt(0)}` || '?',
)
</script>

<template>
  <section aria-labelledby="person-name">
    <div class="relative h-26 rounded-t-[22px] bg-lanyard">
      <span class="absolute top-4 left-6 font-display text-sm font-bold text-lanyard-ink sm:left-8">
        Członek zespołu
      </span>
    </div>

    <div class="px-6 pb-7 sm:px-8">
      <img
        v-if="profile.avatarUrl"
        :src="profile.avatarUrl"
        alt="Zdjęcie profilowe"
        width="104"
        height="104"
        class="relative mx-auto -mt-13 size-26 rounded-full border-[5px] border-badge object-cover"
      />
      <div
        v-else
        class="relative mx-auto -mt-13 grid size-26 place-items-center rounded-full border-[5px] border-badge bg-field font-display text-4xl font-extrabold"
        aria-hidden="true"
      >
        {{ initials }}
      </div>

      <div class="mt-3.5 text-center">
        <h1
          id="person-name"
          data-focus
          tabindex="-1"
          class="font-display text-[2rem] leading-[1.02] font-extrabold tracking-tight break-words text-balance sm:text-[2.35rem]"
        >
          {{ fullName || 'Nowy członek zespołu' }}
        </h1>
        <a
          v-if="profile.email"
          :href="`mailto:${profile.email}`"
          class="mt-2 inline-block break-all text-ink-soft underline-offset-4 hover:underline"
        >
          {{ profile.email }}
        </a>
      </div>

      <div class="mt-5 border-t-[1.5px] border-dashed border-line pt-4">
        <template v-if="profile.aboutMe">
          <h2 class="font-bold">O mnie</h2>
          <p class="mt-1 max-w-[40ch] break-words whitespace-pre-line">{{ profile.aboutMe }}</p>
        </template>
        <p v-else-if="!fullName" data-test="empty-hint" class="text-ink-soft">
          Uzupełnij imię, nazwisko i kilka słów o sobie, żeby zespół wiedział, kim jesteś.
        </p>
      </div>

      <div class="mt-5 flex justify-center">
        <button
          data-test="edit-button"
          type="button"
          class="min-h-11 cursor-pointer rounded-xl border-[1.5px] border-ink px-5 font-bold hover:bg-field"
          @click="$emit('edit')"
        >
          Edytuj profil
        </button>
      </div>
    </div>
  </section>
</template>
