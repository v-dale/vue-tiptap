<!-- components/EditorFooter.vue -->
<template>
  <div class="editor-footer-tools">
    <button @click="editor?.chain().focus().toggleBold().run()">
      Bold
    </button>
    <button @click="editor?.chain().focus().toggleItalic().run()">
      Italic
    </button>
    <span class="character-count">
      Characters: {{ editor?.storage.characterCount.characters() ?? 0 }}
    </span>
  </div>
</template>

<script setup>
defineProps({
  editor: {
    type: Object,
    required: true
  }
})
</script>

