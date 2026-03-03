<script setup lang="ts">
defineProps<{
  title: string;
}>();
</script>

<template>
  <header
    class="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-4"
  >
    <h1 class="text-base font-semibold text-foreground">
      {{ title }}
    </h1>
  </header>
</template>
