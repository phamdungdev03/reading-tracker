<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import BookCard from '@/components/BookCard.vue'
import BookDetailsDialog from '@/components/BookDetailsDialog.vue'
import UiButton from '@/components/UiButton.vue'
import { useLibrary } from '@/composables/useLibrary'
import { api } from '@/services/api'
import type { Book } from '@/types/book'

const { membership, acceptMembership, getRevision } = useLibrary()
const query = ref('')
const queryError = ref('')
const submitted = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const displayState = ref<'idle' | 'results' | 'loading' | 'error'>('idle')
const error = ref('')
const selected = ref<Book | null>(null)
const visibleBooks = ref<Book[]>([])
const pages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
let pending: AbortController | undefined
async function fetchPage(target: number): Promise<void> {
  pending?.abort()
  const request = new AbortController()
  pending = request
  page.value = target
  displayState.value = 'loading'
  error.value = ''
  const revision = getRevision()
  try {
    const result = await api.search(submitted.value, target, request.signal)
    if (request.signal.aborted) return
    acceptMembership(result.books, revision)
    visibleBooks.value = result.books
    pageSize.value = result.pagination.limit
    total.value = result.pagination.total
    displayState.value = 'results'
  } catch (cause) {
    if (request.signal.aborted) return
    error.value = cause instanceof Error ? cause.message : 'Không tìm được sách.'
    displayState.value = 'error'
  }
}
function search(): void {
  const value = query.value.trim()
  queryError.value = value.length < 3
    ? 'Vui lòng nhập ít nhất 3 ký tự để tìm kiếm.'
    : value.length > 200 ? 'Từ khóa không được vượt quá 200 ký tự.' : ''
  if (queryError.value) return
  submitted.value = value
  void fetchPage(1)
}
onBeforeUnmount(() => pending?.abort())
</script>

<template>
  <section>
    <div class="grid items-center gap-8 pt-8 pb-7 sm:pt-12 sm:pb-9 md:grid-cols-[1fr_240px] lg:grid-cols-[1fr_320px]">
      <div><p class="mb-4 text-[10px] font-bold tracking-[0.18em] text-muted uppercase sm:text-[11px]">MỘT KHÔNG GIAN CHO NHỮNG TRANG SÁCH</p><h1 class="font-editorial text-[39px] leading-[1.16] tracking-tight sm:text-[50px] lg:text-[57px]">Tìm một cuốn sách.<br /><em class="text-accent">Mở một thế giới.</em></h1><p class="mt-5 max-w-[490px] text-sm leading-7 text-muted sm:text-[15px]">Khám phá những câu chuyện mới, lưu vào tủ sách và theo dõi hành trình đọc theo cách của bạn.</p></div>
      <div class="relative hidden h-[190px] items-center justify-center md:flex" aria-hidden="true"><div class="absolute size-[185px] rounded-full bg-[#e7ebdf]"></div><div class="relative flex h-[133px] w-[88px] -rotate-15 items-center justify-center rounded-r-md border-l-[7px] border-[#823d29] bg-accent text-center font-editorial text-[23px] leading-snug text-[#fff3dc] italic shadow-lg">one<br />more<br />page.</div><div class="relative -ml-2 flex h-[133px] w-[88px] -translate-y-2 rotate-12 items-center justify-center rounded-r-md border-l-[7px] border-[#234333] bg-primary text-center font-editorial text-[23px] leading-snug text-[#ede9cd] italic shadow-lg">a little<br />every<br />day.</div><span class="absolute right-0 -bottom-2 -rotate-5 font-editorial text-sm text-muted italic">thêm một trang, thêm một điều mới</span></div>
    </div>
    <form @submit.prevent="search">
      <label for="search-query" class="mb-2 block text-sm font-medium">Tên sách hoặc tác giả</label>
      <div class="flex items-center gap-3 rounded-[13px] border border-[#cbd4c7] bg-white p-2.5 sm:pl-5"><svg class="hidden size-5 shrink-0 text-muted sm:block" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="6.5" stroke="currentColor" stroke-width="1.8" /><path d="m15 15 6 6" stroke="currentColor" stroke-width="1.8" /></svg><input id="search-query" v-model="query" :aria-invalid="!!queryError" :aria-describedby="queryError ? 'search-query-error' : undefined" @input="queryError = ''" type="search" maxlength="200" placeholder="Bạn muốn đọc gì hôm nay?" class="min-h-11 min-w-0 flex-1 rounded-sm bg-transparent px-2 text-sm focus-visible:outline-2 focus-visible:outline-accent sm:text-base" /><UiButton type="submit" variant="primary" class="shrink-0 sm:px-6">Tìm sách</UiButton></div>
      <p v-if="queryError" id="search-query-error" role="alert" class="mt-2 text-sm text-accent">{{ queryError }}</p>
    </form>
    <p class="mt-3 mb-8 text-xs leading-5 text-muted">Thử “Nhà giả kim”, “Atomic Habits” hoặc tên tác giả yêu thích.</p>
    <div class="mb-5 flex items-center justify-between gap-3"><h2 class="font-editorial text-2xl sm:text-[26px]">{{ submitted ? 'Kết quả tìm kiếm' : 'Bạn muốn khám phá cuốn sách nào?' }}</h2><span v-if="displayState === 'results'" class="shrink-0 text-xs text-muted">{{ total }} sách</span></div>
    <p v-if="error && displayState !== 'error'" role="alert" class="mb-4 text-sm text-accent">{{ error }}</p>
    <div v-if="displayState === 'idle'" class="rounded-2xl border border-dashed border-line p-10 text-center text-muted">Nhập tên sách hoặc tác giả để bắt đầu tìm kiếm.</div>
    <div v-else-if="displayState === 'loading'" role="status"><p class="sr-only">Đang tìm sách…</p><div class="grid grid-cols-1 gap-5 min-[360px]:grid-cols-2 lg:grid-cols-4"><div v-for="item in 4" :key="item" class="h-[360px] animate-pulse rounded-xl bg-soft motion-reduce:animate-none"></div></div></div>
    <div v-else-if="displayState === 'error'" role="alert" class="rounded-2xl border border-dashed border-line bg-white/50 px-6 py-12 text-center"><h3 class="font-editorial text-2xl">Chưa thể hoàn tất tìm kiếm</h3><p class="my-4 text-sm text-muted">{{ error }}</p><UiButton variant="primary" @click="fetchPage(page)">Thử lại</UiButton></div>
    <div v-else-if="!visibleBooks.length" class="rounded-2xl border border-dashed border-line bg-white/50 px-6 py-12 text-center"><h3 class="font-editorial text-2xl">Chưa tìm thấy cuốn sách phù hợp</h3><p class="my-4 text-sm text-muted">Thử một tên sách hoặc tác giả khác nhé.</p></div>
    <template v-else>
      <div class="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 sm:gap-[22px] lg:grid-cols-4"><BookCard v-for="book in visibleBooks" :key="book.id" :book="book" :in-shelf="membership[book.id] ?? book.inShelf" @select="selected = $event" /></div>
      <nav class="mt-7 flex flex-wrap items-center justify-between gap-3 text-xs" aria-label="Phân trang kết quả"><span>Hiển thị {{ (page - 1) * pageSize + 1 }}–{{ Math.min((page - 1) * pageSize + visibleBooks.length, total) }} trong {{ total }} sách</span><div class="flex items-center gap-2"><UiButton :disabled="page <= 1" aria-label="Trang trước" @click="fetchPage(page - 1)">←</UiButton><span class="grid size-10 place-items-center rounded-lg bg-primary text-white" aria-current="page">{{ page }}</span><UiButton :disabled="page >= pages" aria-label="Trang sau" @click="fetchPage(page + 1)">→</UiButton></div></nav>
    </template>
    <BookDetailsDialog v-if="selected" :key="selected.id" :book="selected" @close="selected = null" />
  </section>
</template>
