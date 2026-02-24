<script setup lang="ts">
import type { HudStatus } from "../types";

defineProps<{
  status: HudStatus;
  message: string;
}>();
</script>

<template>
  <div
    v-if="status !== 'idle'"
    class="notch-hud"
  >
    <!-- Recording indicator -->
    <div v-if="status === 'recording'" class="flex items-center gap-2">
      <span class="recording-dot" />
      <span class="text-white text-sm font-medium">Recording...</span>
    </div>

    <!-- Transcribing indicator -->
    <div v-if="status === 'transcribing'" class="flex items-center gap-2">
      <span class="spinner" />
      <span class="text-white text-sm font-medium">Transcribing...</span>
    </div>

    <!-- Success indicator -->
    <div v-if="status === 'success'" class="flex items-center gap-2">
      <span class="text-green-400 text-base">&#10003;</span>
      <span class="text-green-400 text-sm font-medium">Pasted!</span>
    </div>

    <!-- Error indicator -->
    <div v-if="status === 'error'" class="flex items-center gap-2">
      <span class="text-orange-400 text-base">&#9888;</span>
      <span class="text-orange-400 text-sm font-medium truncate max-w-[200px]">
        {{ message || "Error" }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.notch-hud {
  position: fixed;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  min-width: 160px;
  max-width: 300px;
  height: 48px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 28px;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.recording-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ef4444;
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
