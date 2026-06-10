<script setup lang="ts">
import { ref } from 'vue'
import { useProfile } from './composables/useProfile'
import ProfileCard from './components/ProfileCard.vue'
import ProfileForm from './components/ProfileForm.vue'
import type { Profile } from './types/profile'

const { profile, save } = useProfile()
const isEditing = ref(false)

async function onSave(updated: Profile) {
  await save(updated)
  isEditing.value = false
}
</script>

<template>
  <main class="min-h-screen bg-gray-50 px-4 py-12">
    <ProfileCard v-if="!isEditing" :profile="profile" @edit="isEditing = true" />
    <ProfileForm v-else :profile="profile" @save="onSave" @cancel="isEditing = false" />
  </main>
</template>
