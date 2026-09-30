<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppDialog from '@/components/AppDialog.vue'
import EditBookDialog from '@/components/EditBookDialog.vue'
import ShelfBookCard from '@/components/ShelfBookCard.vue'
import UiButton from '@/components/UiButton.vue'
import { useLibrary } from '@/composables/useLibrary'
import { statusLabels, type ReadingStatus, type ShelfBook } from '@/types/book'

const router = useRouter()
const { shelfBooks, stats, removeBook, loading, error, loadShelf } = useLibrary()
const tab = ref<ReadingStatus>('reading')
const editing = ref<ShelfBook | null>(null)
const deleting = ref<ShelfBook | null>(null)
const visibleBooks = computed(() => shelfBooks.value.filter((book) => book.entry.status === tab.value))
const deletingPending = ref(false)
const deleteError = ref('')
function afterSave(book: ShelfBook): void { tab.value = book.entry.status }
function askDelete(book: ShelfBook): void { deleteError.value = ''; deleting.value = book }
async function confirmDelete(): Promise<void> {
  if (!deleting.value || deletingPending.value) return
  deletingPending.value = true
  deleteError.value = ''
  try { await removeBook(deleting.value); deleting.value = null }
  catch (cause) { deleteError.value = cause instanceof Error ? cause.message : 'Không thể xóa sách.' }
  finally { deletingPending.value = false }
}
onMounted(loadShelf)
</script>

<template>
  <section>
    <div class="flex flex-col items-start justify-between gap-6 pt-8 pb-7 sm:flex-row sm:items-center sm:pt-12">
      <div><p class="mb-4 text-[11px] font-bold tracking-[0.18em] text-muted uppercase">NHỮNG CÂU CHUYỆN BẠN ĐÃ CHỌN</p><h1 class="font-editorial text-[39px] leading-tight tracking-tight sm:text-[46px]">Tủ sách <em class="text-accent">của tôi.</em></h1><p class="mt-3 text-sm text-muted">Một chút thời gian, một vài trang sách, mỗi ngày.</p></div>
      <UiButton variant="primary" @click="router.push('/')">+ Tìm thêm sách</UiButton>
    </div>
    <div class="mb-8 grid grid-cols-3 gap-2 max-[350px]:grid-cols-1 sm:gap-4" aria-label="Thống kê toàn tủ">
      <div class="flex items-center justify-between rounded-xl border border-primary bg-primary px-3 py-5 text-white sm:px-6"><div><p class="text-[11px] text-[#e0e9dc] sm:text-sm">Tổng số sách</p><strong class="mt-2 block font-editorial text-3xl font-normal sm:text-[37px]">{{ String(stats.total).padStart(2, '0') }}</strong></div><svg class="hidden size-8 opacity-65 sm:block" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M5 5h6v23H5zM14 5h5v23h-5zM22 6l5-1 4 22-5 1z" stroke="currentColor" stroke-width="1.5" /></svg></div>
      <div class="flex items-center justify-between rounded-xl border border-line bg-white px-3 py-5 sm:px-6"><div><p class="text-[11px] text-muted sm:text-sm">Đang đọc</p><strong class="mt-2 block font-editorial text-3xl font-normal sm:text-[37px]">{{ String(stats.reading).padStart(2, '0') }}</strong></div><svg class="hidden size-8 opacity-65 sm:block" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 8C11 4 7 5 3 6v20c5-2 9-1 13 2 4-3 8-4 13-2V6c-4-1-8-2-13 2Zm0 0v20" stroke="currentColor" stroke-width="1.5" /></svg></div>
      <div class="flex items-center justify-between rounded-xl border border-line bg-white px-3 py-5 sm:px-6"><div><p class="text-[11px] text-muted sm:text-sm">Đã đọc xong</p><strong class="mt-2 block font-editorial text-3xl font-normal sm:text-[37px]">{{ String(stats.completed).padStart(2, '0') }}</strong></div><svg class="hidden size-8 opacity-65 sm:block" viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="16" cy="16" r="12" stroke="currentColor" stroke-width="1.5" /><path d="m10 16 4 4 8-8" stroke="currentColor" stroke-width="1.5" /></svg></div>
    </div>
    <div class="mb-6 flex gap-1 border-b border-line" role="group" aria-label="Lọc theo trạng thái"><button v-for="(label, value) in statusLabels" :key="value" :aria-pressed="tab === value" :class="tab === value ? 'border-primary font-semibold text-primary' : 'border-transparent text-muted'" class="-mb-px min-h-12 cursor-pointer border-b-[3px] px-3 py-3 text-[13px] focus-visible:outline-2 focus-visible:outline-accent sm:px-5 sm:text-sm" @click="tab = value">{{ label }} <span class="ml-1 text-xs">{{ stats[value] }}</span></button></div>
    <div v-if="loading" role="status" class="rounded-xl bg-soft p-10 text-center">Đang tải tủ sách…</div>
    <div v-else-if="error" role="alert" class="rounded-xl border border-line p-8 text-center"><p class="mb-4 text-accent">{{ error }}</p><UiButton @click="loadShelf">Thử lại</UiButton></div>
    <div v-else-if="visibleBooks.length" class="space-y-4"><ShelfBookCard v-for="book in visibleBooks" :key="book.id" :book="book" @edit="editing = $event" @remove="askDelete" /></div>
    <div v-else class="rounded-2xl border border-dashed border-line bg-white/50 px-6 py-12 text-center"><h2 class="font-editorial text-2xl">Một ngăn sách đang chờ bạn</h2><p class="my-4 text-sm text-muted">Chưa có sách trong mục “{{ statusLabels[tab] }}”.</p><UiButton variant="primary" @click="router.push('/')">Khám phá sách</UiButton></div>
    <p class="mt-4 text-xs leading-5 text-muted">Chọn “Cập nhật tiến độ” để sửa số trang, trạng thái, đánh giá và ghi chú.</p>
    <EditBookDialog v-if="editing" :key="editing.id" :book="editing" @saved="afterSave" @close="editing = null" />
    <AppDialog v-if="deleting" :busy="deletingPending" labelled-by="delete-book-title" eyebrow="QUẢN LÝ TỦ SÁCH" @close="deleting = null"><h2 id="delete-book-title" class="font-editorial text-3xl">Xóa khỏi tủ sách?</h2><p class="mt-4 text-sm leading-7 text-muted">“{{ deleting.title }}” cùng tiến độ, đánh giá và ghi chú sẽ bị xóa khỏi tủ sách của bạn.</p><p v-if="deleteError" role="alert" class="mt-4 text-sm text-accent">{{ deleteError }}</p><div class="mt-6 flex justify-end gap-3"><UiButton :disabled="deletingPending" @click="deleting = null">Giữ lại</UiButton><UiButton variant="danger" :disabled="deletingPending" @click="confirmDelete">{{ deletingPending ? 'Đang xóa…' : 'Xóa sách' }}</UiButton></div></AppDialog>
  </section>
</template>
