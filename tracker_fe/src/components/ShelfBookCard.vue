<script setup lang="ts">
import { computed } from 'vue'
import { statusLabels, type ShelfBook } from '@/types/book'
import BookCover from './BookCover.vue'
import UiButton from './UiButton.vue'
const props = defineProps<{ book: ShelfBook }>()
const emit = defineEmits<{ edit: [book: ShelfBook]; remove: [book: ShelfBook] }>()
const percent = computed(() => Math.floor(props.book.entry.currentPage * 100 / props.book.entry.totalPages))
const dateLabel = computed(() => {
  if (!props.book.entry.startedAt) return 'Chưa ghi nhận ngày bắt đầu'
  return `Bắt đầu: ${new Date(props.book.entry.startedAt).toLocaleDateString('vi-VN')}`
})
</script>

<template>
  <article class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 rounded-[14px] border border-line bg-white p-5 sm:gap-6 sm:p-6 lg:grid-cols-[82px_minmax(0,1fr)_150px]">
    <BookCover :book="book" small class="max-[360px]:hidden" />
    <div class="min-w-0 max-[360px]:col-span-2">
      <span class="inline-block rounded-md bg-soft px-2.5 py-1 text-xs font-semibold text-primary">{{ statusLabels[book.entry.status] }}</span>
      <h2 class="mt-2 font-editorial text-2xl leading-tight">{{ book.title }}</h2>
      <p class="mt-1 mb-4 text-[13px] text-muted">{{ book.author }}</p>
      <div class="mb-2 flex justify-between gap-3 text-xs"><span>{{ book.entry.currentPage }} / {{ book.entry.totalPages }} trang</span><strong>{{ percent }}%</strong></div>
      <svg class="h-1.5 w-full rounded-full" viewBox="0 0 100 6" preserveAspectRatio="none" role="progressbar" :aria-label="`Tiến độ ${book.title}`" :aria-valuenow="book.entry.currentPage" :aria-valuemin="0" :aria-valuemax="book.entry.totalPages"><rect width="100" height="6" rx="3" class="fill-soft" /><rect :width="percent" height="6" rx="3" class="fill-[#7b9470]" /></svg>
      <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted"><span>{{ dateLabel }}</span><span>{{ book.entry.rating ? `${'★'.repeat(book.entry.rating)} · ${book.entry.rating}/5` : 'Chưa đánh giá' }}</span><span v-if="book.entry.finishedAt">Hoàn thành: {{ new Date(book.entry.finishedAt).toLocaleDateString('vi-VN') }}</span></div>
    </div>
    <div class="col-span-2 grid grid-cols-2 gap-2 lg:col-span-1 lg:grid-cols-1"><UiButton variant="primary" @click="emit('edit', book)">Cập nhật tiến độ</UiButton><UiButton variant="ghost" @click="emit('remove', book)">Xóa khỏi tủ</UiButton></div>
  </article>
</template>
