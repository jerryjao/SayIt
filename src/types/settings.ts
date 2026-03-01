import type { TriggerMode } from "./index";

export interface HotkeyConfig {
  key: string;
  modifiers: string[];
}

export interface SettingsDto {
  hotkeyConfig: HotkeyConfig | null;
  triggerMode: TriggerMode;
  hasApiKey: boolean;
  aiPrompt: string;
}
