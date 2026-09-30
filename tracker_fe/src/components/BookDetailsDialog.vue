<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useLibrary } from '@/composables/useLibrary'
import { api, ApiError } from '@/services/api'
import { statusLabels, type Book, type ReadingStatus } from '@/types/book'
import AppDialog from './AppDialog.vue'
import BookCover from './BookCover.vue'
import UiButton from './UiButton.vue'

const props = defineProps<{ book: Book }>()
const emit = defineEmits<{ close: [] }>()
const router = useRouter()
const library = useLibrary()
const detail = ref<Book | null>(null)
const shownBook = computed(() => detail.value ?? props.book)
const savedEntry = computed(() => library.shelfBooks.value.find(book => book.id === props.book.id)?.entry)
const alreadyAdded = ref(false)
const inShelf = computed(() => alreadyAdded.value || (library.membership.value[props.book.id] ?? detail.value?.inShelf ?? props.book.inShelf))
const totalPages = ref<number | string>('')
const status = ref<ReadingStatus>('want_to_read')
const error = ref('')
const detailError = ref('')
const loading = ref(true)
const saving = ref(false)
let pending: AbortController | undefined
async function loadDetails(): Promise<void> {
  pending?.abort()
  const controller = new AbortController()
  pending = controller
  loading.value = true
  detailError.value = ''
  const revision = library.getRevision()
  try {
    detail.value = await api.details(props.book.id, controller.signal)
    library.acceptMembership([detail.value], revision)
    totalPages.value = detail.value.pages ?? ''
  } catch (cause) {
    if (!controller.signal.aborted) detailError.value = cause instanceof Error ? cause.message : 'Không tải được chi tiết.'
  } finally { if (!controller.signal.aborted) loading.value = false }
}
async function add(): Promise<void> {
  if (saving.value) return
  saving.value = true
  error.value = ''
  try {
    await library.addBook(props.book.id, Number(totalPages.value), status.value)
    emit('close')
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 409) alreadyAdded.value = true
    error.value = cause instanceof Error ? cause.message : 'Không thể thêm sách.'
  } finally { saving.value = false }
}
function openShelf(): void { emit('close'); void router.push('/shelf') }
onMounted(loadDetails)
onBeforeUnmount(() => pending?.abort())
</script>

<template>
  <AppDialog :busy="saving" labelled-by="book-detail-title" eyebrow="MỘT CUỐN SÁCH, MỘT HÀNH TRÌNH" @close="emit('close')">
    <div class="mb-6 flex items-center gap-5 sm:gap-7">
      <BookCover :book="shownBook" class="max-[380px]:hidden" />
      <div class="min-w-0">
        <p class="text-xs font-semibold tracking-widest text-muted">{{ shownBook.year ?? 'Chưa rõ năm' }} · {{ savedEntry?.totalPages ?? shownBook.pages ?? 'Chưa rõ số' }} trang</p>
        <h2 id="book-detail-title" class="my-3 font-editorial text-3xl leading-tight sm:text-4xl">{{ shownBook.title }}</h2>
        <p class="text-sm text-muted">{{ shownBook.author }}</p>
      </div>
    </div>
    <p v-if="loading" role="status" class="py-8 text-center text-muted">Đang tải chi tiết sách…</p>
    <div v-else-if="detailError" role="alert" class="py-6 text-center"><p class="mb-4 text-accent">{{ detailError }}</p><UiButton @click="loadDetails">Thử lại</UiButton></div>
    <template v-else>
    <h3 class="font-editorial text-2xl">Về cuốn sách</h3>
    <p class="my-4 text-sm leading-7 text-muted">{{ shownBook.description }}</p>
    <div class="flex flex-wrap gap-2"><span v-for="subject in shownBook.subjects" :key="subject" class="rounded-md bg-soft px-3 py-1 text-xs">{{ subject }}</span></div>
    <div v-if="inShelf" class="mt-6 border-t border-line pt-6">
      <span class="rounded-md bg-soft px-3 py-2 text-xs font-semibold text-primary">✓ Đã có trong tủ sách</span>
      <div class="mt-6 flex justify-end"><UiButton variant="primary" @click="openShelf">Đến tủ sách</UiButton></div>
    </div>
    <form v-else class="mt-6 border-t border-line pt-6" @submit.prevent="add">
      <h3 class="mb-5 font-editorial text-2xl">Thêm vào tủ sách</h3>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="text-sm font-medium">Tổng số trang<input v-model.number="totalPages" type="number" min="1" max="2147483647" step="1" required aria-describedby="total-pages-hint" class="mt-2 min-h-11 w-full rounded-lg border border-[#bbc6b6] bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-accent" /></label>
        <label class="text-sm font-medium">Trạng thái ban đầu<select v-model="status" class="mt-2 min-h-11 w-full rounded-lg border border-[#bbc6b6] bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-accent"><option v-for="(label, value) in statusLabels" :key="value" :value="value">{{ label }}</option></select></label>
      </div>
      <p id="total-pages-hint" class="mt-3 text-xs leading-5 text-muted">Xác nhận số trang theo bản sách bạn đọc. Số trang gợi ý có thể khác bản bạn đang đọc.</p>
      <p v-if="shownBook.suggestedEditionId" class="mt-1 text-xs text-muted">Nguồn gợi ý: edition {{ shownBook.suggestedEditionId }}.</p>
      <p v-if="error" class="mt-3 text-sm text-accent" role="alert">{{ error }}</p>
      <div class="mt-6 flex justify-end gap-3"><UiButton :disabled="saving" @click="emit('close')">Để sau</UiButton><UiButton type="submit" variant="primary" :disabled="saving">{{ saving ? 'Đang thêm…' : '+ Thêm vào tủ' }}</UiButton></div>
    </form>
    </template>
  </AppDialog>
</template>
