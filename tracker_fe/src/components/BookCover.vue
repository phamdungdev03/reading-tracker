<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Book } from '@/types/book'
const props = withDefaults(defineProps<{ book: Book; small?: boolean }>(), { small: false })
const failed = ref(false)
watch(() => props.book.coverUrl, () => { failed.value = false })
</script>

<template>
  <div :class="small ? 'h-[119px] w-[82px]' : 'h-[183px] w-[124px]'" class="relative flex shrink-0 items-center justify-center overflow-hidden rounded-r-md bg-soft text-center shadow-lg">
    <img v-if="book.coverUrl && !failed" :src="book.coverUrl" :alt="`Bìa sách ${book.title}`" loading="lazy" class="h-full w-full object-contain" @error="failed = true" />
    <div v-else class="flex h-full w-full flex-col items-center justify-center gap-3 border-l-4 border-primary/30 p-2 text-primary">
      <span class="line-clamp-4 font-editorial text-sm">{{ book.title }}</span>
      <span class="text-[10px] text-muted">Chưa có ảnh bìa</span>
    </div>
  </div>
</template>
