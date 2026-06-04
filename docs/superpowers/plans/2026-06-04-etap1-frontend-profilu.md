# Etap 1 — Frontend profilu + CI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zbudować jednowidokową aplikację profilu użytkownika (Vue 3 + TS + Tailwind) realizującą FR-1…FR-7, z testami (Vitest + Vue Test Utils + Playwright) i pipeline'em CI w GitHub Actions.

**Architecture:** Monorepo z aplikacją w `frontend/`. Tryb edycji = podmiana widoków: `ProfileCard` (podgląd) ↔ `ProfileForm` (edycja). Stan przez composable `useProfile()` opakowujący `profileService` (localStorage z seedem). Czyste funkcje (`validation`) i serwis testowane jednostkowo; komponenty przez Vue Test Utils; ścieżki użytkownika przez Playwright. Husky/commitlint/lint-staged w roocie.

**Tech Stack:** Vue 3 (`<script setup lang="ts">`), TypeScript, Vite, Tailwind CSS v4 (`@tailwindcss/vite`), Vitest + @vue/test-utils (jsdom), Playwright, ESLint + Prettier, Husky + commitlint + lint-staged, GitHub Actions.

**Konwencje:**
- Commity w formacie **Conventional Commits** (wymuszane przez commitlint od Tasku 3).
- Każdy commit dodaje trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` (pomijam go w treści kroków dla zwięzłości — dodawaj zawsze).
- Komendy uruchamiane z katalogu `frontend/`, chyba że wskazano inaczej.
- Spec źródłowy: `docs/superpowers/specs/2026-06-04-etap1-frontend-profilu-design.md`.

---

## Struktura plików (docelowo)

```text
teamable/
  .github/workflows/ci.yml
  package.json                       # root: husky, commitlint, lint-staged
  commitlint.config.js
  .husky/{pre-commit,commit-msg}
  frontend/
    src/
      types/profile.ts               # interface Profile + DEFAULT_PROFILE
      utils/validation.ts            # isValidEmail
      utils/validation.spec.ts
      services/profileService.ts     # localStorage + seed
      services/profileService.spec.ts
      composables/useProfile.ts
      composables/useProfile.spec.ts
      components/ProfileCard.vue
      components/ProfileCard.spec.ts
      components/ProfileForm.vue
      components/ProfileForm.spec.ts
      App.vue
      App.spec.ts
      main.ts
      assets/main.css                # @import "tailwindcss"
    e2e/profile.spec.ts              # Playwright
    vite.config.ts
    vitest.config.ts (lub config w vite.config)
    playwright.config.ts
    package.json
  README.md
```

---

## Task 1: Scaffold aplikacji Vue (create-vue)

**Files:**
- Create: cały katalog `frontend/` (generowany przez scaffolder)

- [ ] **Step 1: Uruchom oficjalny scaffolder**

Z katalogu głównego repo (`teamable/`):

Run: `npm create vue@latest frontend`

Na pytania interaktywne odpowiedz dokładnie tak (reszta = domyślne/No):

```text
✔ Add TypeScript?                     → Yes
✔ Add JSX Support?                    → No
✔ Add Vue Router for SPA?             → No
✔ Add Pinia for state management?     → No
✔ Add Vitest for Unit Testing?        → Yes
✔ Add an End-to-End Testing Solution? → Playwright
✔ Add ESLint for code quality?        → Yes
✔ Add Prettier for code formatting?   → Yes
```

(Jeśli pojawi się pytanie o „experimental features” / Oxlint → No.)

- [ ] **Step 2: Zainstaluj zależności**

Run: `cd frontend && npm install`
Expected: instalacja bez błędów, powstaje `frontend/node_modules`.

- [ ] **Step 3: Zainstaluj przeglądarki Playwright**

Run (w `frontend/`): `npx playwright install --with-deps chromium`
Expected: pobranie Chromium.

- [ ] **Step 4: Sanity check — testy jednostkowe scaffolda**

Run (w `frontend/`): `npm run test:unit -- --run`
Expected: PASS (przykładowy test z create-vue przechodzi).

- [ ] **Step 5: Sanity check — build**

Run (w `frontend/`): `npm run build`
Expected: build kończy się sukcesem, powstaje `frontend/dist/`.

- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "chore: scaffold Vue 3 + TS app (Vitest, Playwright, ESLint, Prettier)"
```

---

## Task 2: Dodaj Tailwind CSS v4

**Files:**
- Modify: `frontend/vite.config.ts`
- Modify/Create: `frontend/src/assets/main.css`

- [ ] **Step 1: Zainstaluj Tailwind v4 + plugin Vite**

Run (w `frontend/`): `npm install tailwindcss @tailwindcss/vite`
Expected: pakiety dodane do `dependencies`.

- [ ] **Step 2: Dodaj plugin do Vite**

Zmodyfikuj `frontend/vite.config.ts` — dodaj import i plugin (zachowaj istniejący plugin `vue()`):

```typescript
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
```

- [ ] **Step 3: Zaimportuj Tailwind w głównym CSS**

Nadpisz zawartość `frontend/src/assets/main.css` na:

```css
@import "tailwindcss";
```

Upewnij się, że `frontend/src/main.ts` importuje ten plik (create-vue zwykle ma `import './assets/main.css'`). Jeśli importuje `base.css`/inne — zostaw tylko `import './assets/main.css'`.

- [ ] **Step 4: Zweryfikuj, że klasy Tailwind działają**

Tymczasowo w `frontend/src/App.vue` w template dodaj element `<h1 class="text-3xl font-bold underline">Tailwind OK</h1>`.

Run (w `frontend/`): `npm run dev`
Expected: na `http://localhost:5173` nagłówek jest duży, pogrubiony i podkreślony. Następnie zatrzymaj serwer (Ctrl-C) i usuń tymczasowy nagłówek.

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "build: add Tailwind CSS v4 via Vite plugin"
```

---

## Task 3: Root tooling — Husky + commitlint + lint-staged

**Files:**
- Create: `package.json` (root)
- Create: `commitlint.config.js` (root)
- Create: `.husky/pre-commit`, `.husky/commit-msg`

- [ ] **Step 1: Zainicjuj root package.json**

Run (w katalogu głównym `teamable/`): `npm init -y`

Następnie nadpisz `package.json` (root) na:

```json
{
  "name": "teamable",
  "private": true,
  "type": "module",
  "scripts": {
    "prepare": "husky"
  },
  "lint-staged": {
    "frontend/**/*.{ts,vue,js}": [
      "prettier --write",
      "eslint --fix"
    ],
    "frontend/**/*.{json,css,md}": [
      "prettier --write"
    ]
  }
}
```

- [ ] **Step 2: Zainstaluj narzędzia w roocie**

Run (w `teamable/`): `npm install -D husky @commitlint/cli @commitlint/config-conventional lint-staged`
Expected: pakiety w `devDependencies` root.

- [ ] **Step 3: Zainicjuj Husky**

Run (w `teamable/`): `npx husky init`
Expected: powstaje katalog `.husky/` oraz domyślny hook `.husky/pre-commit`.

- [ ] **Step 4: Skonfiguruj commitlint**

Utwórz `commitlint.config.js` (root):

```javascript
export default {
  extends: ['@commitlint/config-conventional'],
}
```

- [ ] **Step 5: Hook commit-msg**

Utwórz `.husky/commit-msg` z zawartością:

```sh
npx --no -- commitlint --edit "$1"
```

- [ ] **Step 6: Hook pre-commit**

Nadpisz `.husky/pre-commit` na:

```sh
npx lint-staged
```

- [ ] **Step 7: Weryfikacja — zły commit jest odrzucany**

```bash
git add package.json commitlint.config.js .husky/
git commit -m "zly commit bez typu"
```
Expected: commit **odrzucony** przez commitlint (błąd „type may not be empty”).

- [ ] **Step 8: Poprawny commit przechodzi**

```bash
git commit -m "build: add husky, commitlint and lint-staged at repo root"
```
Expected: commit przechodzi (lint-staged nie ma jeszcze plików w stage poza powyższymi — uruchomi się bez błędu).

---

## Task 4: Model danych profilu

**Files:**
- Create: `frontend/src/types/profile.ts`

- [ ] **Step 1: Utwórz typ i seed**

Utwórz `frontend/src/types/profile.ts`:

```typescript
export interface Profile {
  firstName: string
  lastName: string
  email: string
  aboutMe: string
  avatarUrl: string
}

export const DEFAULT_PROFILE: Profile = {
  firstName: 'Jan',
  lastName: 'Kowalski',
  email: 'jan.kowalski@example.com',
  aboutMe: 'Cześć! Tu uczę się DevOps na projekcie Teamable.',
  avatarUrl: '',
}
```

- [ ] **Step 2: Typecheck**

Run (w `frontend/`): `npm run type-check`
Expected: PASS (brak błędów typów).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/profile.ts
git commit -m "feat: add Profile type and default seed"
```

---

## Task 5: Walidacja email (FR-6, TDD)

**Files:**
- Create: `frontend/src/utils/validation.ts`
- Test: `frontend/src/utils/validation.spec.ts`

- [ ] **Step 1: Napisz failujący test**

Utwórz `frontend/src/utils/validation.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { isValidEmail } from './validation'

describe('isValidEmail', () => {
  it('akceptuje poprawny email', () => {
    expect(isValidEmail('jan@example.com')).toBe(true)
  })

  it('odrzuca email bez @', () => {
    expect(isValidEmail('janexample.com')).toBe(false)
  })

  it('odrzuca email bez domeny', () => {
    expect(isValidEmail('jan@')).toBe(false)
  })

  it('odrzuca pusty string', () => {
    expect(isValidEmail('')).toBe(false)
  })

  it('odrzuca email ze spacją', () => {
    expect(isValidEmail('jan kowalski@example.com')).toBe(false)
  })
})
```

- [ ] **Step 2: Uruchom test — ma failować**

Run (w `frontend/`): `npm run test:unit -- --run src/utils/validation.spec.ts`
Expected: FAIL ("Failed to resolve import './validation'" lub "isValidEmail is not a function").

- [ ] **Step 3: Implementacja**

Utwórz `frontend/src/utils/validation.ts`:

```typescript
export function isValidEmail(email: string): boolean {
  // Prosty, wystarczający wzorzec: niepuste, brak spacji, dokładnie jedno @,
  // niepusta nazwa i domena z kropką.
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return pattern.test(email)
}
```

- [ ] **Step 4: Uruchom test — ma przejść**

Run (w `frontend/`): `npm run test:unit -- --run src/utils/validation.spec.ts`
Expected: PASS (5 testów zielonych).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/validation.ts frontend/src/utils/validation.spec.ts
git commit -m "feat: add email validation util (FR-6)"
```

---

## Task 6: profileService — localStorage + seed (FR-7, TDD)

**Files:**
- Create: `frontend/src/services/profileService.ts`
- Test: `frontend/src/services/profileService.spec.ts`

> Testy działają w środowisku jsdom (konfiguracja z create-vue), które udostępnia `localStorage`. Czyścimy je przed każdym testem.

- [ ] **Step 1: Napisz failujący test**

Utwórz `frontend/src/services/profileService.spec.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { getProfile, saveProfile, STORAGE_KEY } from './profileService'
import { DEFAULT_PROFILE, type Profile } from '../types/profile'

describe('profileService', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('zwraca domyślny profil (seed), gdy localStorage jest pusty', () => {
    expect(getProfile()).toEqual(DEFAULT_PROFILE)
  })

  it('zapisuje i odczytuje profil', () => {
    const updated: Profile = {
      firstName: 'Anna',
      lastName: 'Nowak',
      email: 'anna@example.com',
      aboutMe: 'Test',
      avatarUrl: 'data:image/png;base64,abc',
    }
    saveProfile(updated)
    expect(getProfile()).toEqual(updated)
  })

  it('zwraca seed, gdy zapis w localStorage jest uszkodzony', () => {
    localStorage.setItem(STORAGE_KEY, 'to-nie-jest-json')
    expect(getProfile()).toEqual(DEFAULT_PROFILE)
  })
})
```

- [ ] **Step 2: Uruchom test — ma failować**

Run (w `frontend/`): `npm run test:unit -- --run src/services/profileService.spec.ts`
Expected: FAIL ("Failed to resolve import './profileService'").

- [ ] **Step 3: Implementacja**

Utwórz `frontend/src/services/profileService.ts`:

```typescript
import { DEFAULT_PROFILE, type Profile } from '../types/profile'

export const STORAGE_KEY = 'teamable.profile'

export function getProfile(): Profile {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return { ...DEFAULT_PROFILE }
  try {
    return JSON.parse(raw) as Profile
  } catch {
    // Uszkodzony wpis — wracamy do bezpiecznego seeda.
    return { ...DEFAULT_PROFILE }
  }
}

export function saveProfile(profile: Profile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
}
```

- [ ] **Step 4: Uruchom test — ma przejść**

Run (w `frontend/`): `npm run test:unit -- --run src/services/profileService.spec.ts`
Expected: PASS (3 testy zielone).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/profileService.ts frontend/src/services/profileService.spec.ts
git commit -m "feat: add profileService with localStorage and seed (FR-7)"
```

---

## Task 7: Composable useProfile (TDD)

**Files:**
- Create: `frontend/src/composables/useProfile.ts`
- Test: `frontend/src/composables/useProfile.spec.ts`

- [ ] **Step 1: Napisz failujący test**

Utwórz `frontend/src/composables/useProfile.spec.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useProfile } from './useProfile'
import { getProfile } from '../services/profileService'
import type { Profile } from '../types/profile'

describe('useProfile', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('inicjuje stan profilem z serwisu', () => {
    const { profile } = useProfile()
    expect(profile.value.firstName).toBe('Jan')
  })

  it('save aktualizuje stan i utrwala dane', () => {
    const { profile, save } = useProfile()
    const updated: Profile = {
      firstName: 'Ola',
      lastName: 'Test',
      email: 'ola@example.com',
      aboutMe: 'x',
      avatarUrl: '',
    }
    save(updated)
    expect(profile.value).toEqual(updated)
    // utrwalone w localStorage (świeży odczyt z serwisu):
    expect(getProfile()).toEqual(updated)
  })
})
```

- [ ] **Step 2: Uruchom test — ma failować**

Run (w `frontend/`): `npm run test:unit -- --run src/composables/useProfile.spec.ts`
Expected: FAIL ("Failed to resolve import './useProfile'").

- [ ] **Step 3: Implementacja**

Utwórz `frontend/src/composables/useProfile.ts`:

```typescript
import { ref } from 'vue'
import { getProfile, saveProfile } from '../services/profileService'
import type { Profile } from '../types/profile'

export function useProfile() {
  const profile = ref<Profile>(getProfile())

  function save(updated: Profile): void {
    saveProfile(updated)
    profile.value = { ...updated }
  }

  return { profile, save }
}
```

- [ ] **Step 4: Uruchom test — ma przejść**

Run (w `frontend/`): `npm run test:unit -- --run src/composables/useProfile.spec.ts`
Expected: PASS (2 testy zielone).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/composables/useProfile.ts frontend/src/composables/useProfile.spec.ts
git commit -m "feat: add useProfile composable"
```

---

## Task 8: Komponent ProfileCard — podgląd (FR-1, FR-2, FR-3, TDD)

**Files:**
- Create: `frontend/src/components/ProfileCard.vue`
- Test: `frontend/src/components/ProfileCard.spec.ts`

- [ ] **Step 1: Napisz failujący test**

Utwórz `frontend/src/components/ProfileCard.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ProfileCard from './ProfileCard.vue'
import type { Profile } from '../types/profile'

const profile: Profile = {
  firstName: 'Jan',
  lastName: 'Kowalski',
  email: 'jan@example.com',
  aboutMe: 'About me text',
  avatarUrl: '',
}

describe('ProfileCard', () => {
  it('wyświetla pola profilu (FR-1)', () => {
    const wrapper = mount(ProfileCard, { props: { profile } })
    expect(wrapper.text()).toContain('Jan')
    expect(wrapper.text()).toContain('Kowalski')
    expect(wrapper.text()).toContain('jan@example.com')
    expect(wrapper.text()).toContain('About me text')
  })

  it('ma przycisk edycji i emituje edit po kliknięciu (FR-2, FR-3)', async () => {
    const wrapper = mount(ProfileCard, { props: { profile } })
    const btn = wrapper.get('[data-test="edit-button"]')
    await btn.trigger('click')
    expect(wrapper.emitted('edit')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Uruchom test — ma failować**

Run (w `frontend/`): `npm run test:unit -- --run src/components/ProfileCard.spec.ts`
Expected: FAIL ("Failed to resolve import './ProfileCard.vue'").

- [ ] **Step 3: Implementacja**

Utwórz `frontend/src/components/ProfileCard.vue`:

```vue
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
```

- [ ] **Step 4: Uruchom test — ma przejść**

Run (w `frontend/`): `npm run test:unit -- --run src/components/ProfileCard.spec.ts`
Expected: PASS (2 testy zielone).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ProfileCard.vue frontend/src/components/ProfileCard.spec.ts
git commit -m "feat: add ProfileCard view component (FR-1, FR-2, FR-3)"
```

---

## Task 9: Komponent ProfileForm — edycja (FR-4, FR-5, FR-6, TDD)

**Files:**
- Create: `frontend/src/components/ProfileForm.vue`
- Test: `frontend/src/components/ProfileForm.spec.ts`

- [ ] **Step 1: Napisz failujący test**

Utwórz `frontend/src/components/ProfileForm.spec.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ProfileForm from './ProfileForm.vue'
import type { Profile } from '../types/profile'

const profile: Profile = {
  firstName: 'Jan',
  lastName: 'Kowalski',
  email: 'jan@example.com',
  aboutMe: 'About',
  avatarUrl: '',
}

describe('ProfileForm', () => {
  it('zapisuje zmienione pola i emituje save (FR-4)', async () => {
    const wrapper = mount(ProfileForm, { props: { profile } })
    await wrapper.get('[data-test="firstName"]').setValue('Anna')
    await wrapper.get('[data-test="save-button"]').trigger('click')

    const saved = wrapper.emitted('save')
    expect(saved).toHaveLength(1)
    expect((saved![0][0] as Profile).firstName).toBe('Anna')
  })

  it('blokuje zapis i pokazuje błąd przy niepoprawnym emailu (FR-6)', async () => {
    const wrapper = mount(ProfileForm, { props: { profile } })
    await wrapper.get('[data-test="email"]').setValue('zly-email')
    await wrapper.get('[data-test="save-button"]').trigger('click')

    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.get('[data-test="email-error"]').text()).not.toBe('')
  })

  it('emituje cancel po kliknięciu Anuluj', async () => {
    const wrapper = mount(ProfileForm, { props: { profile } })
    await wrapper.get('[data-test="cancel-button"]').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Uruchom test — ma failować**

Run (w `frontend/`): `npm run test:unit -- --run src/components/ProfileForm.spec.ts`
Expected: FAIL ("Failed to resolve import './ProfileForm.vue'").

- [ ] **Step 3: Implementacja**

Utwórz `frontend/src/components/ProfileForm.vue`:

```vue
<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { Profile } from '../types/profile'
import { isValidEmail } from '../utils/validation'

const props = defineProps<{ profile: Profile }>()
const emit = defineEmits<{ save: [profile: Profile]; cancel: [] }>()

// Lokalna kopia do edycji — nie mutujemy propsa.
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
        >
          Zapisz
        </button>
      </div>
    </form>
  </section>
</template>
```

- [ ] **Step 4: Uruchom test — ma przejść**

Run (w `frontend/`): `npm run test:unit -- --run src/components/ProfileForm.spec.ts`
Expected: PASS (3 testy zielone).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ProfileForm.vue frontend/src/components/ProfileForm.spec.ts
git commit -m "feat: add ProfileForm edit component (FR-4, FR-5, FR-6)"
```

---

## Task 10: App.vue — spięcie podglądu i edycji (TDD)

**Files:**
- Modify: `frontend/src/App.vue`
- Test: `frontend/src/App.spec.ts`

- [ ] **Step 1: Napisz failujący test**

Utwórz `frontend/src/App.spec.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import App from './App.vue'

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('domyślnie pokazuje podgląd, nie formularz', () => {
    const wrapper = mount(App)
    expect(wrapper.find('[data-test="edit-button"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="save-button"]').exists()).toBe(false)
  })

  it('po kliknięciu Edytuj pokazuje formularz', async () => {
    const wrapper = mount(App)
    await wrapper.get('[data-test="edit-button"]').trigger('click')
    expect(wrapper.find('[data-test="save-button"]').exists()).toBe(true)
  })

  it('po zapisie wraca do podglądu z nowymi danymi', async () => {
    const wrapper = mount(App)
    await wrapper.get('[data-test="edit-button"]').trigger('click')
    await wrapper.get('[data-test="firstName"]').setValue('Zofia')
    await wrapper.get('[data-test="save-button"]').trigger('click')

    expect(wrapper.find('[data-test="save-button"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Zofia')
  })
})
```

- [ ] **Step 2: Uruchom test — ma failować**

Run (w `frontend/`): `npm run test:unit -- --run src/App.spec.ts`
Expected: FAIL (App jeszcze renderuje domyślną treść scaffolda, brak `edit-button`).

- [ ] **Step 3: Implementacja**

Nadpisz `frontend/src/App.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useProfile } from './composables/useProfile'
import ProfileCard from './components/ProfileCard.vue'
import ProfileForm from './components/ProfileForm.vue'
import type { Profile } from './types/profile'

const { profile, save } = useProfile()
const isEditing = ref(false)

function onSave(updated: Profile) {
  save(updated)
  isEditing.value = false
}
</script>

<template>
  <main class="min-h-screen bg-gray-50 px-4 py-12">
    <ProfileCard v-if="!isEditing" :profile="profile" @edit="isEditing = true" />
    <ProfileForm v-else :profile="profile" @save="onSave" @cancel="isEditing = false" />
  </main>
</template>
```

- [ ] **Step 4: Uruchom test — ma przejść**

Run (w `frontend/`): `npm run test:unit -- --run src/App.spec.ts`
Expected: PASS (3 testy zielone).

- [ ] **Step 5: Pełny zestaw testów + typecheck + lint**

Run (w `frontend/`): `npm run test:unit -- --run`
Expected: PASS (wszystkie testy; usuń ewentualny pozostały przykładowy test scaffolda, jeśli koliduje).

Run (w `frontend/`): `npm run type-check`
Expected: PASS.

Run (w `frontend/`): `npm run lint`
Expected: brak błędów (lub auto-fix zastosowany).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.vue frontend/src/App.spec.ts
git commit -m "feat: wire ProfileCard and ProfileForm in App"
```

---

## Task 11: Testy E2E (Playwright) — FR-3, FR-4, FR-5, FR-7

**Files:**
- Create: `frontend/e2e/profile.spec.ts`
- Modify (jeśli trzeba): `frontend/playwright.config.ts` (webServer)
- Test fixture: `frontend/e2e/fixtures/avatar.png`

> create-vue generuje `e2e/` z przykładem i `playwright.config.ts` skonfigurowanym do uruchamiania `npm run preview` (build + preview) lub `npm run dev`. Zweryfikuj `webServer.command` i `baseURL` w configu.

- [ ] **Step 1: Zweryfikuj/ustaw webServer w playwright.config.ts**

Otwórz `frontend/playwright.config.ts` i upewnij się, że sekcja `webServer` buduje i serwuje aplikację, np.:

```typescript
webServer: {
  command: 'npm run build && npm run preview',
  url: 'http://localhost:4173',
  reuseExistingServer: !process.env.CI,
},
use: {
  baseURL: 'http://localhost:4173',
},
```

(Jeśli create-vue ustawił inny port — zostaw jego wartości, byle `url` i `baseURL` były spójne.)

- [ ] **Step 2: Dodaj prosty fixture obrazka**

Run (w `frontend/`): `mkdir -p e2e/fixtures`

Utwórz mały plik PNG (1x1) komendą:

```bash
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82' > e2e/fixtures/avatar.png
```

- [ ] **Step 3: Usuń przykładowy test i napisz właściwy**

Usuń przykładowy plik (np. `frontend/e2e/vue.spec.ts`), a następnie utwórz `frontend/e2e/profile.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('edycja i zapis profilu utrwala dane po reloadzie (FR-3, FR-4, FR-7)', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('edit-button').click()
  await page.getByTestId('firstName').fill('Grażyna')
  await page.getByTestId('email').fill('grazyna@example.com')
  await page.getByTestId('save-button').click()

  // wróciliśmy do podglądu z nową wartością
  await expect(page.getByTestId('edit-button')).toBeVisible()
  await expect(page.getByText('Grażyna')).toBeVisible()

  // trwałość po odświeżeniu
  await page.reload()
  await expect(page.getByText('Grażyna')).toBeVisible()
})

test('niepoprawny email blokuje zapis (FR-6)', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('edit-button').click()
  await page.getByTestId('email').fill('zly-email')
  await page.getByTestId('save-button').click()

  // nadal w formularzu, widać błąd
  await expect(page.getByTestId('save-button')).toBeVisible()
  await expect(page.getByTestId('email-error')).not.toBeEmpty()
})

test('wczytanie zdjęcia pokazuje podgląd (FR-5)', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('edit-button').click()
  await page.getByTestId('avatar').setInputFiles(path.join(__dirname, 'fixtures/avatar.png'))

  await expect(page.getByAltText('Podgląd zdjęcia')).toBeVisible()
})
```

- [ ] **Step 4: Uruchom E2E**

Run (w `frontend/`): `npm run test:e2e`
Expected: PASS (3 testy E2E zielone).

- [ ] **Step 5: Commit**

```bash
git add frontend/e2e/ frontend/playwright.config.ts
git commit -m "test: add Playwright E2E for profile flow (FR-3,4,5,7)"
```

---

## Task 12: CI — GitHub Actions

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Dodaj skrypt coverage (jeśli brak)**

Sprawdź `frontend/package.json`. Jeśli nie ma skryptu pokrycia, dodaj do `scripts`:

```json
"test:unit:coverage": "vitest run --coverage"
```

Zainstaluj provider pokrycia (w `frontend/`): `npm install -D @vitest/coverage-v8`

- [ ] **Step 2: Utwórz workflow CI**

Utwórz `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Format check
        run: npx prettier --check src

      - name: Type check
        run: npm run type-check

      - name: Unit tests + coverage
        run: npm run test:unit:coverage

      - name: Build
        run: npm run build

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: E2E tests
        run: npm run test:e2e

      - name: Upload build artifact
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: dist
          path: frontend/dist
          if-no-files-found: ignore

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: frontend/playwright-report
          if-no-files-found: ignore
```

> `npm ci` wymaga `frontend/package-lock.json` w repo — upewnij się, że jest zacommitowany (powstaje przy `npm install` w Tasku 1).

- [ ] **Step 3: Walidacja lokalna kroków CI**

Uruchom lokalnie te same komendy, by potwierdzić, że przejdą w CI (w `frontend/`):

```bash
npm run lint
npx prettier --check src
npm run type-check
npm run test:unit:coverage
npm run build
npm run test:e2e
```
Expected: każda komenda kończy się sukcesem.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml frontend/package.json frontend/package-lock.json
git commit -m "ci: add GitHub Actions pipeline (lint, types, tests, build, e2e)"
```

---

## Task 13: README

**Files:**
- Create: `README.md` (root)

- [ ] **Step 1: Napisz README**

Utwórz `README.md` (root):

```markdown
# Teamable

Projekt edukacyjny do nauki DevOps. Etap 1: frontend profilu użytkownika
(Vue 3 + TypeScript + Tailwind) z testami i CI. Szczegóły: `requirements.md`
oraz `docs/superpowers/`.

## Struktura

- `frontend/` — aplikacja Vue 3 (Vite).
- `.github/workflows/ci.yml` — pipeline CI (GitHub Actions).
- `docs/superpowers/` — spec i plan implementacji.

## Uruchomienie lokalne

```bash
cd frontend
npm install
npm run dev        # serwer deweloperski
```

## Testy

```bash
cd frontend
npm run test:unit -- --run   # testy jednostkowe/komponentowe
npm run test:e2e             # testy E2E (Playwright)
npm run type-check           # sprawdzenie typów
npm run lint                 # ESLint
```

## Konwencje

- Conventional Commits (wymuszane przez commitlint + Husky).
- Gałęzie: GitHub Flow (krótkie gałęzie + PR do `main`).
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add project README"
```

---

## Self-Review (wykonane przez autora planu)

**Spec coverage:**
- FR-1 (wyświetlanie pól) → Task 8. ✅
- FR-2 (przycisk edycji) → Task 8. ✅
- FR-3 (tryb edycji) → Task 8 (emit) + Task 10 (przełączanie) + Task 11 (E2E). ✅
- FR-4 (edycja + zapis) → Task 9 + Task 10 + Task 11. ✅
- FR-5 (upload zdjęcia) → Task 9 + Task 11. ✅
- FR-6 (walidacja email) → Task 5 + Task 9 + Task 11. ✅
- FR-7 (trwałość localStorage) → Task 6 + Task 11. ✅
- Architektura (ProfileCard/ProfileForm/useProfile/profileService) → Tasks 6–10. ✅
- Stos (Vue3+TS+Tailwind+Vitest+Playwright+ESLint+Prettier) → Tasks 1–2. ✅
- DevOps (Husky/commitlint/lint-staged) → Task 3; CI → Task 12. ✅
- Monorepo z `frontend/` → Task 1 (scaffold do `frontend/`). ✅
- README → Task 13. ✅

**Korekta względem spec:** spec wymieniał `tailwind.config.js`; Tailwind v4 go nie wymaga (konfiguracja przez `@tailwindcss/vite` + `@import "tailwindcss"`). Plan używa wersji v4 — bez `tailwind.config.js`.

**Placeholder scan:** brak TBD/TODO; każdy krok zawiera realny kod/komendę. ✅

**Type consistency:** `Profile` (firstName, lastName, email, aboutMe, avatarUrl) spójny w types/service/composable/komponentach/testach; `getProfile`/`saveProfile`/`STORAGE_KEY`/`DEFAULT_PROFILE`/`isValidEmail`/`useProfile`/`save` nazwane spójnie we wszystkich taskach. data-test atrybuty (`edit-button`, `save-button`, `cancel-button`, `firstName`, `lastName`, `email`, `email-error`, `aboutMe`, `avatar`) spójne między komponentami a testami unit/E2E. ✅
