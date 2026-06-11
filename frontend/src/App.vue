<script setup lang="ts">
import { ref } from 'vue'
import { useProfile } from './composables/useProfile'
import ProfileCard from './components/ProfileCard.vue'
import ProfileForm from './components/ProfileForm.vue'
import type { Profile } from './types/profile'

const { profile, loading, error, save } = useProfile()
const isEditing = ref(false)
const saveError = ref('')

async function onSave(payload: { profile: Profile; avatarFile: File | null }) {
  saveError.value = ''
  try {
    await save(payload.profile, payload.avatarFile)
    isEditing.value = false
  } catch (e) {
    // Form stays open — user doesn't lose entered data (spec 4).
    saveError.value = e instanceof Error ? e.message : 'Zapis nie powiódł się.'
  }
}

function onCancel() {
  saveError.value = ''
  isEditing.value = false
}
</script>

<template>
  <main class="min-h-screen bg-gray-50 px-4 py-12">
    <p v-if="loading" data-test="loading" class="text-center text-gray-500">Wczytywanie profilu…</p>
    <p v-else-if="error" data-test="load-error" class="text-center text-red-600">
      {{ error }}
    </p>
    <ProfileCard v-else-if="!isEditing" :profile="profile" @edit="isEditing = true" />
    <ProfileForm
      v-else
      :profile="profile"
      :server-error="saveError"
      @save="onSave"
      @cancel="onCancel"
    />
  </main>
</template>
