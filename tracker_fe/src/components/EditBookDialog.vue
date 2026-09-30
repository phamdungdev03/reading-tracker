<script setup lang="ts">
import { ref, watch } from 'vue'
import { useLibrary } from '@/composables/useLibrary'
import { statusLabels, type ShelfBook, type ShelfPatch } from '@/types/book'
import AppDialog from './AppDialog.vue'
import UiButton from './UiButton.vue'

const props = defineProps<{ book: ShelfBook }>()
const emit = defineEmits<{ close: []; saved: [book: ShelfBook] }>()
const { updateBook } = useLibrary()
const currentPage = ref(props.book.entry.currentPage)
const status = ref(props.book.entry.status)
const rating = ref(props.book.entry.rating === null ? '' : String(props.book.entry.rating))
const notes = ref(props.book.entry.notes)
const error = ref('')
watch(status, () => { currentPage.value = props.book.entry.currentPage })
const saving = ref(false)
async function save(): Promise<void> {
  if (saving.value) return
  saving.value = true
  error.value = ''
  try {
    const patch: ShelfPatch = { rating: rating.value === '' ? null : Number(rating.value), notes: notes.value }
    if (status.value !== props.book.entry.status) patch.status = status.value
    else if (Number(currentPage.value) !== props.book.entry.currentPage) patch.currentPage = Number(currentPage.value)
    const updated = await updateBook(props.book, patch)
    emit('saved', updated)
    emit('close')
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Không thể cập nhật sách.' }
  finally { saving.value = false }
}
</script>

<template>
  <AppDialog :busy="saving" labelled-by="edit-book-title" eyebrow="TIẾP TỤC HÀNH TRÌNH ĐỌC" @close="emit('close')">
    <h2 id="edit-book-title" class="mb-6 font-editorial text-3xl">{{ book.title }}</h2>
    <form @submit.prevent="save">
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="text-sm font-medium">Trang đã đọc<input v-model.number="currentPage" type="number" min="0" :max="book.entry.totalPages" step="1" required :disabled="status !== book.entry.status" aria-describedby="pages-hint" class="mt-2 min-h-11 w-full rounded-lg border border-[#bbc6b6] bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-accent disabled:bg-soft disabled:text-muted" /><span id="pages-hint" class="mt-1 block text-xs font-normal text-muted">Tổng {{ book.entry.totalPages }} trang</span></label>
        <label class="text-sm font-medium">Trạng thái<select v-model="status" class="mt-2 min-h-11 w-full rounded-lg border border-[#bbc6b6] bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-accent"><option v-for="(label, value) in statusLabels" :key="value" :value="value">{{ label }}</option></select></label>
        <label class="text-sm font-medium">Đánh giá<select v-model="rating" class="mt-2 min-h-11 w-full rounded-lg border border-[#bbc6b6] bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-accent"><option value="">Chưa đánh giá</option><option v-for="value in 5" :key="value" :value="String(value)">{{ '★'.repeat(value) }} — {{ value }}/5</option></select></label>
      </div>
      <p v-if="status !== book.entry.status" class="mt-3 text-xs leading-5 text-muted">Khi đổi trạng thái, tiến độ tự điều chỉnh: Đã đọc = 100%; Muốn đọc hoặc bắt đầu đọc lại = 0 trang.</p>
      <label class="mt-5 block text-sm font-medium">Ghi chú<textarea v-model="notes" maxlength="1000" rows="3" placeholder="Một điều bạn muốn ghi nhớ…" class="mt-2 w-full resize-y rounded-lg border border-[#bbc6b6] bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-accent"></textarea></label>
      <p class="mt-1 text-xs text-muted">{{ notes.length }}/1.000 ký tự</p>
      <p v-if="error" role="alert" class="mt-3 text-sm text-accent">{{ error }}</p>
      <div class="mt-6 flex justify-end gap-3"><UiButton :disabled="saving" @click="emit('close')">Hủy</UiButton><UiButton type="submit" variant="primary" :disabled="saving">{{ saving ? 'Đang lưu…' : 'Lưu thay đổi' }}</UiButton></div>
    </form>
  </AppDialog>
</template>
