<script setup lang="ts">
import { onMounted } from "vue";
import NotchHud from "./components/NotchHud.vue";
import { useVoiceFlow } from "./composables/useVoiceFlow";

const { state, initialize } = useVoiceFlow();

onMounted(() => {
  initialize();
});
</script>

<template>
  <div class="h-screen w-screen bg-transparent">
    <NotchHud :status="state.status" :message="state.message" />
  </div>
</template>
