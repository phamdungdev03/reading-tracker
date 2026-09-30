<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  type?: 'button' | 'submit' | 'reset'
}>(), { variant: 'secondary', type: 'button' })

const variants = {
  primary: 'border-primary bg-primary text-white hover:border-[#1c4133] hover:bg-[#1c4133]',
  secondary: 'border-line bg-white text-ink hover:border-[#8ca493] hover:bg-soft',
  danger: 'border-accent bg-accent text-white hover:bg-[#863625]',
  ghost: 'border-transparent bg-transparent text-accent hover:bg-soft',
}
</script>

<template>
  <button :type="type" :class="variants[variant]" class="min-h-11 cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent disabled:cursor-default disabled:opacity-45 motion-reduce:transition-none">
    <slot />
  </button>
</template>
