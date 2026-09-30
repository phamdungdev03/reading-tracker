<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { useLibrary } from '@/composables/useLibrary'
const { stats, notice, loaded, error, loadShelf } = useLibrary()
onMounted(loadShelf)
</script>

<template>
  <div class="min-h-dvh bg-paper font-sans text-ink antialiased">
    <a href="#main" class="absolute -top-20 left-4 z-50 rounded-lg bg-white p-3 focus:top-2">Đến nội dung chính</a>

    <div class="mx-auto max-w-[1160px] px-[18px] sm:px-8">
      <header class="flex h-20 items-center justify-between gap-3 border-b border-line sm:h-[92px]">
        <RouterLink to="/" class="flex shrink-0 items-center gap-2 rounded focus-visible:outline-2 focus-visible:outline-accent sm:gap-3" aria-label="Gác sách — Khám phá">
          <svg class="size-7 sm:size-[34px]" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 7C12 3 6 4 3 5v22c5-2 9-1 13 2 4-3 8-4 13-2V5c-3-1-9-2-13 2Zm0 0v22" stroke="currentColor" stroke-width="1.6" /></svg>
          <div><span class="font-editorial text-2xl tracking-tight sm:text-[29px]">gác sách</span><span class="mt-0.5 block text-[7px] tracking-[0.18em] text-muted uppercase max-[360px]:hidden sm:text-[9px]">Mỗi ngày, một trang mới</span></div>
        </RouterLink>
        <nav class="flex h-full items-stretch gap-4 sm:gap-7" aria-label="Điều hướng chính">
          <RouterLink to="/" exact-active-class="!border-primary !text-primary font-semibold" class="flex items-center border-b-[3px] border-transparent px-1 text-xs text-muted focus-visible:outline-2 focus-visible:outline-accent sm:text-sm">Khám phá</RouterLink>
          <RouterLink to="/shelf" active-class="!border-primary !text-primary font-semibold" class="flex items-center gap-2 border-b-[3px] border-transparent px-1 text-xs text-muted focus-visible:outline-2 focus-visible:outline-accent sm:text-sm">Tủ sách <span class="hidden rounded bg-soft px-1.5 py-0.5 text-[11px] sm:inline">{{ loaded && !error ? stats.total : '—' }}</span></RouterLink>
        </nav>
      </header>
      <main id="main"><RouterView /></main>
      <footer class="mt-14 flex flex-col justify-center gap-2 border-t border-line py-6 text-xs text-muted sm:flex-row"><span>Gác sách · Không gian cho những trang sách.</span></footer>
    </div>
    <div class="pointer-events-none fixed inset-x-4 bottom-6 z-50 flex justify-center" role="status" aria-live="polite"><p v-if="notice" class="max-w-lg rounded-xl bg-ink px-5 py-3 text-center text-sm text-white shadow-lg">{{ notice }}</p></div>
  </div>
</template>
