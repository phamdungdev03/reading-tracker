<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

defineProps<{ labelledBy: string; eyebrow?: string; busy?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement | null>(null)
let previousFocus: HTMLElement | null = null
onMounted(() => {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  dialog.value?.showModal()
  document.documentElement.classList.add('overflow-hidden')
})
onBeforeUnmount(() => {
  dialog.value?.close()
  document.documentElement.classList.remove('overflow-hidden')
  if (previousFocus?.isConnected) previousFocus.focus()
})
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" :aria-labelledby="labelledBy" class="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[680px] overflow-y-auto rounded-[20px] border border-line bg-[#fffefa] p-5 font-sans text-ink shadow-2xl backdrop:bg-[#17352980] backdrop:backdrop-blur-[3px] sm:p-8" @cancel.prevent="!busy && emit('close')">
      <div class="mb-5 flex items-center justify-between gap-4">
        <p class="text-[11px] font-bold tracking-[0.18em] text-muted uppercase">{{ eyebrow }}</p>
        <button type="button" :disabled="busy" aria-label="Đóng cửa sổ" class="size-11 shrink-0 cursor-pointer rounded-lg text-3xl hover:bg-soft focus-visible:outline-2 focus-visible:outline-accent" @click="emit('close')">×</button>
      </div>
      <slot />
    </dialog>
  </Teleport>
</template>
