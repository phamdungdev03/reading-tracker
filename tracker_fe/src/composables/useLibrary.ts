import { computed, readonly, shallowReadonly, ref } from 'vue'
import { api, ApiError } from '@/services/api'
import type { ReadingStatus, ShelfBook, ShelfPatch } from '@/types/book'

const shelfBooks = ref<ShelfBook[]>([])
const loading = ref(false)
const loaded = ref(false)
const error = ref('')
const notice = ref('')
const membership = ref<Record<string, boolean>>({})
let noticeTimeout: ReturnType<typeof setTimeout> | undefined
let refresh: Promise<void> | null = null
let version = 0
const stats = computed(() => ({
  total: shelfBooks.value.length,
  want_to_read: shelfBooks.value.filter(book => book.entry.status === 'want_to_read').length,
  reading: shelfBooks.value.filter(book => book.entry.status === 'reading').length,
  completed: shelfBooks.value.filter(book => book.entry.status === 'completed').length,
}))
function notify(message: string) {
  notice.value = message
  clearTimeout(noticeTimeout)
  noticeTimeout = setTimeout(() => { notice.value = '' }, 4000)
}
async function loadShelf(): Promise<void> {
  if (refresh) return refresh
  loading.value = true
  error.value = ''
  refresh = (async () => {
    try {
      // Mutation trong lúc GET đang chạy: đọc lại để không bỏ mất các mục cũ.
      while (true) {
        const current = version
        try {
          const result = await api.shelf()
          if (current !== version) continue
          shelfBooks.value = result
          loaded.value = true
          break
        } catch (cause) {
          if (current !== version) continue
          throw cause
        }
      }
    } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Không tải được tủ sách.' }
    finally { loading.value = false; refresh = null }
  })()
  return refresh
}
function acceptMembership(books: { id: string; inShelf: boolean }[], revision: number) {
  if (revision !== version) return
  for (const book of books) membership.value[book.id] = book.inShelf
}

function remember(book: ShelfBook) {
  version++
  membership.value[book.id] = true
  shelfBooks.value = [book, ...shelfBooks.value.filter(item => item.id !== book.id)]
}
async function addBook(workId: string, totalPages: number, status: ReadingStatus) {
  try {
    const book = await api.add(workId, totalPages, status)
    remember(book)
    notify('Đã thêm sách vào tủ.')
    return book
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 409) await loadShelf()
    throw cause
  }
}
async function updateBook(book: ShelfBook, patch: ShelfPatch) {
  const updated = await api.update(book.entry.id, patch)
  remember(updated)
  notify('Đã lưu thay đổi.')
  return updated
}
async function removeBook(book: ShelfBook) {
  await api.remove(book.entry.id)
  version++
  membership.value[book.id] = false
  shelfBooks.value = shelfBooks.value.filter(item => item.id !== book.id)
  notify('Đã xóa sách khỏi tủ.')
}
export function useLibrary() {
  return { shelfBooks: shallowReadonly(shelfBooks), stats, loading: readonly(loading), loaded: readonly(loaded), error: readonly(error),
    membership: readonly(membership), acceptMembership, getRevision: () => version, notice: readonly(notice), loadShelf, addBook, updateBook, removeBook }
}
