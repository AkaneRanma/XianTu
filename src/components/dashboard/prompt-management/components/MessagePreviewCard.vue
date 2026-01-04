<template>
  <div
    class="message-preview-card"
    :class="[
      `role-${message.role}`,
      { expanded: isExpanded, truncated: message.truncated }
    ]"
  >
    <!-- 消息头部 -->
    <div class="card-header" @click="toggleExpand">
      <div class="header-left">
        <span class="role-badge" :class="message.role">
          {{ getRoleLabel(message.role) }}
        </span>
        <span class="source-label">{{ message.source }}</span>
      </div>
      <div class="header-right">
        <span class="depth-badge" v-if="showDepth">
          深度: {{ message.depth }}
        </span>
        <span class="char-count">
          {{ formatCharCount(message.charCount) }}
        </span>
        <button
          v-if="message.truncated"
          class="expand-btn"
          :title="isExpanded ? '收起' : '展开'"
        >
          <svg viewBox="0 0 24 24" class="expand-icon" :class="{ rotated: isExpanded }">
            <path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 消息内容 -->
    <div class="card-content">
      <pre class="content-text" :class="{ 'full-content': isExpanded }">{{ displayContent }}</pre>
    </div>

    <!-- 操作按钮 -->
    <div class="card-actions" v-if="showActions">
      <button class="action-btn copy-btn" @click.stop="copyContent" title="复制内容">
        <svg viewBox="0 0 24 24" width="14" height="14">
          <path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { PreviewMessage } from '@/services/promptPreviewService';

const props = withDefaults(defineProps<{
  message: PreviewMessage;
  showDepth?: boolean;
  showActions?: boolean;
}>(), {
  showDepth: true,
  showActions: true,
});

const emit = defineEmits<{
  (e: 'copy', content: string): void;
}>();

const isExpanded = ref(false);

const displayContent = computed(() => {
  if (isExpanded.value && props.message.fullContent) {
    return props.message.fullContent;
  }
  return props.message.content;
});

const toggleExpand = () => {
  if (props.message.truncated) {
    isExpanded.value = !isExpanded.value;
  }
};

const getRoleLabel = (role: string): string => {
  switch (role) {
    case 'system': return 'SYS';
    case 'user': return 'USR';
    case 'assistant': return 'AST';
    default: return role.toUpperCase();
  }
};

const formatCharCount = (count: number): string => {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
};

const copyContent = async () => {
  const content = props.message.fullContent || props.message.content;
  try {
    await navigator.clipboard.writeText(content);
    emit('copy', content);
  } catch (error) {
    console.error('复制失败:', error);
  }
};
</script>

<style scoped>
.message-preview-card {
  background: rgba(30, 35, 45, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  margin-bottom: 8px;
  overflow: hidden;
  transition: all 0.2s ease;
}

.message-preview-card:hover {
  border-color: rgba(255, 255, 255, 0.15);
  background: rgba(35, 40, 50, 0.9);
}

.message-preview-card.role-system {
  border-left: 3px solid #4a9eff;
}

.message-preview-card.role-user {
  border-left: 3px solid #10b981;
}

.message-preview-card.role-assistant {
  border-left: 3px solid #f59e0b;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.2);
  cursor: pointer;
  user-select: none;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.role-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.role-badge.system {
  background: rgba(74, 158, 255, 0.2);
  color: #4a9eff;
}

.role-badge.user {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

.role-badge.assistant {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
}

.source-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.depth-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
}

.char-count {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  font-family: 'JetBrains Mono', monospace;
}

.expand-btn {
  background: transparent;
  border: none;
  padding: 2px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.expand-icon {
  width: 18px;
  height: 18px;
  color: rgba(255, 255, 255, 0.5);
  transition: transform 0.2s ease;
}

.expand-icon.rotated {
  transform: rotate(180deg);
}

.card-content {
  padding: 8px 12px;
  max-height: 120px;
  overflow: hidden;
  transition: max-height 0.3s ease;
}

.expanded .card-content {
  max-height: none;
}

.content-text {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.85);
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
}

.truncated .content-text:not(.full-content)::after {
  content: '';
  display: block;
  height: 30px;
  background: linear-gradient(transparent, rgba(30, 35, 45, 0.95));
  position: relative;
  margin-top: -30px;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.15);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.message-preview-card:hover .card-actions {
  opacity: 1;
}

.action-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 11px;
  transition: all 0.15s ease;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}
</style>
