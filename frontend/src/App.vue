<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useProfile } from './composables/useProfile'
import { useSession, signIn, signOut } from './services/authClient'
import { ApiError } from './services/profileService'
import LoginForm from './components/LoginForm.vue'
import ProfileCard from './components/ProfileCard.vue'
import ProfileForm from './components/ProfileForm.vue'
import type { Profile } from './types/profile'

const session = useSession()
const user = computed(() => session.value.data?.user ?? null)
const refetchSession = () => void session.value.refetch()

const { profile, loading, error, save, load, clear } = useProfile({
  onUnauthorized: refetchSession,
})

const isEditing = ref(false)
const saveError = ref('')
const loginError = ref('')
const loginPending = ref(false)
const status = ref('')
const badge = ref<HTMLElement | null>(null)
// Po zalogowaniu/wylogowaniu fokus idzie na nagłówek nowej strony identyfikatora.
let focusPending = false

// Każda zmiana użytkownika najpierw czyści dane poprzedniego (Review Focus 3), potem ładuje nowe.
watch(
  () => user.value?.id,
  (id) => {
    clear()
    isEditing.value = false
    saveError.value = ''
    if (id) {
      status.value = ''
      void load()
    }
  },
  { immediate: true },
)

function loginMessage(httpStatus: number | undefined): string {
  if (httpStatus === 429) return 'Za dużo prób logowania. Odczekaj chwilę i spróbuj ponownie.'
  if (httpStatus && httpStatus >= 500) return 'Logowanie chwilowo nie działa. Spróbuj za chwilę.'
  return 'Niepoprawny e-mail lub hasło'
}

async function onLogin(credentials: { email: string; password: string }) {
  loginError.value = ''
  loginPending.value = true
  try {
    const { error: authError } = await signIn.email(credentials)
    if (authError) loginError.value = loginMessage(authError.status)
    else focusPending = true
  } catch {
    loginError.value = 'Nie udało się połączyć z serwerem. Sprawdź połączenie i spróbuj ponownie.'
  } finally {
    loginPending.value = false
  }
}

async function onLogout() {
  status.value = ''
  try {
    await signOut()
  } catch {
    status.value = 'Nie udało się wylogować. Spróbuj ponownie.'
    return
  }
  clear()
  isEditing.value = false
  status.value = 'Wylogowano.'
  focusPending = true
}

async function onSave(payload: { profile: Profile; avatarFile: File | null }) {
  saveError.value = ''
  try {
    await save(payload.profile, payload.avatarFile)
    isEditing.value = false
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) refetchSession()
    // Formularz zostaje otwarty, wpisane dane nie giną (spec 4).
    saveError.value = e instanceof Error ? e.message : 'Zapis nie powiódł się.'
  }
}

function onCancel() {
  saveError.value = ''
  isEditing.value = false
}

async function focusBadgeHeading() {
  if (!focusPending) return
  await nextTick()
  const target = badge.value?.querySelector<HTMLElement>('[data-focus]')
  if (target) {
    target.focus({ preventScroll: true })
    focusPending = false
  }
}

// Profil po zalogowaniu przychodzi po obrocie, więc fokus próbujemy też po wczytaniu danych.
watch(loading, (isLoading) => {
  if (!isLoading) void focusBadgeHeading()
})
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="flex min-h-16 items-center justify-between gap-3 px-4 py-3 sm:px-6">
      <p
        translate="no"
        class="flex items-center gap-2.5 font-display text-[1.35rem] font-extrabold tracking-tight"
      >
        <svg viewBox="0 0 26 26" class="size-[26px]" aria-hidden="true">
          <rect x="3" y="5" width="20" height="18" rx="5" fill="var(--ink)" />
          <rect x="9" y="2" width="8" height="6" rx="2" fill="var(--lanyard)" />
          <circle cx="13" cy="13" r="3" fill="var(--badge)" />
          <rect x="8" y="17.5" width="10" height="2.2" rx="1.1" fill="var(--badge)" />
        </svg>
        Teamable
      </p>
      <div v-if="user" class="flex items-center gap-3 text-sm text-ink-soft">
        <span class="hidden break-all sm:inline">{{ user.email }}</span>
        <button
          data-test="logout-button"
          type="button"
          class="min-h-10 cursor-pointer rounded-[10px] border-[1.5px] border-line bg-badge px-3.5 font-bold text-ink hover:border-ink-soft"
          @click="onLogout"
        >
          Wyloguj
        </button>
      </div>
    </header>

    <main class="relative flex flex-1 justify-center px-4 pb-12">
      <div class="lanyard" aria-hidden="true" />
      <div class="badge-wrap relative z-10 mt-16 w-full max-w-[400px]">
        <p
          data-test="status"
          role="status"
          class="mb-3.5 min-h-[1.4em] text-center text-sm text-ink-soft"
        >
          {{ status }}
        </p>

        <p v-if="session.isPending" data-test="loading" class="text-center text-ink-soft">
          Wczytywanie…
        </p>

        <Transition v-else name="flip" mode="out-in" @after-enter="focusBadgeHeading">
          <div :key="user ? 'profile' : 'login'" ref="badge" class="badge">
            <div class="clip" aria-hidden="true" />
            <div class="slot" aria-hidden="true" />

            <LoginForm v-if="!user" :error="loginError" :pending="loginPending" @submit="onLogin" />
            <p
              v-else-if="loading"
              data-test="loading"
              class="px-8 pt-14 pb-12 text-center text-ink-soft"
            >
              Wczytywanie profilu…
            </p>
            <p
              v-else-if="error"
              data-test="load-error"
              role="alert"
              class="px-8 pt-14 pb-12 text-center font-bold text-error"
            >
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
          </div>
        </Transition>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* Smycz: dwie taśmy od górnej krawędzi do klipsa identyfikatora. */
.lanyard {
  position: absolute;
  top: -80px;
  left: 50%;
  width: 120px;
  height: 168px;
  transform: translateX(-50%);
  pointer-events: none;
}
.lanyard::before,
.lanyard::after {
  content: '';
  position: absolute;
  top: 0;
  width: 22px;
  height: 100%;
  background: var(--lanyard)
    repeating-linear-gradient(180deg, transparent 0 18px, rgb(0 0 0 / 0.06) 18px 20px);
  transform-origin: bottom;
}
.lanyard::before {
  left: 18px;
  transform: skewX(14deg);
}
.lanyard::after {
  right: 18px;
  transform: skewX(-14deg);
}
/* Na wąskim ekranie smycz zaczyna się pod nagłówkiem, żeby nie zasłaniała nazwy i przycisku. */
@media (max-width: 639px) {
  .lanyard {
    top: -12px;
    height: 100px;
  }
}

.badge-wrap {
  perspective: 1400px;
}
.badge {
  position: relative;
  background: var(--badge);
  border: 1px solid var(--line);
  border-radius: 22px;
  box-shadow:
    0 1px 0 var(--line),
    0 24px 40px -18px var(--shadow);
  transform-origin: 50% -40px;
  animation: settle 900ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.clip {
  position: absolute;
  top: -26px;
  left: 50%;
  z-index: 2;
  width: 34px;
  height: 40px;
  transform: translateX(-50%);
  border-radius: 8px 8px 10px 10px;
  background: linear-gradient(var(--ink-soft), var(--ink));
}
.slot {
  position: absolute;
  top: 14px;
  left: 50%;
  z-index: 1;
  width: 64px;
  height: 12px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: var(--wall);
  box-shadow: inset 0 2px 3px var(--shadow);
}

/* Jedyny ruch w aplikacji: identyfikator wychyla się przy wejściu i obraca przy logowaniu/wylogowaniu. */
@keyframes settle {
  0% {
    rotate: -5deg;
  }
  45% {
    rotate: 2.5deg;
  }
  75% {
    rotate: -1deg;
  }
  100% {
    rotate: 0deg;
  }
}
.flip-leave-active {
  transition: transform 220ms ease-in;
}
.flip-enter-active {
  transition: transform 380ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.flip-leave-to {
  transform: rotateY(90deg);
}
.flip-enter-from {
  transform: rotateY(-90deg);
}

@media (prefers-reduced-motion: reduce) {
  .badge {
    animation: none;
  }
  .flip-enter-active,
  .flip-leave-active {
    transition: none;
  }
}
</style>
