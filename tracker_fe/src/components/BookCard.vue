<script setup lang="ts">
import BookCover from './BookCover.vue'
import UiButton from './UiButton.vue'
import type { Book } from '@/types/book'
defineProps<{ book: Book; inShelf: boolean }>()
const emit = defineEmits<{ select: [book: Book] }>()
</script>

<template>
  <article class="flex min-w-0 flex-col overflow-hidden rounded-[13px] border border-line bg-white">
    <button class="flex h-[225px] w-full cursor-pointer items-center justify-center bg-[#eceee7] p-5 transition-colors hover:bg-[#e2e7da] focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-accent motion-reduce:transition-none" :aria-label="`Xem chi tiết ${book.title}`" @click="emit('select', book)"><BookCover :book="book" /></button>
    <div class="flex flex-1 flex-col p-4 sm:p-[18px]">
      <p class="mb-1.5 text-xs text-muted">{{ book.year ?? 'Chưa rõ năm xuất bản' }}</p>
      <h3><button class="cursor-pointer text-left font-editorial text-xl leading-snug hover:text-accent focus-visible:outline-2 focus-visible:outline-accent" @click="emit('select', book)">{{ book.title }}</button></h3>
      <p class="mt-2 mb-5 text-[13px] text-muted">{{ book.author }}</p>
      <span v-if="inShelf" class="mt-auto flex min-h-11 items-center justify-center rounded-md bg-soft px-2 text-xs font-semibold text-primary">✓ Đã thêm vào tủ</span>
      <UiButton v-else class="mt-auto w-full bg-paper" @click="emit('select', book)">+ Thêm vào tủ</UiButton>
    </div>
  </article>
</template>
