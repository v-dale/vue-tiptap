
<template>
  <div class="app">
    <tiptap-editor
      v-model="editorContent"
    />
    <div class="content-preview" dir="rtl">
      <h3>Content:</h3>
      <div v-html="editorContent"></div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import TiptapEditor from './components/TiptapEditor.vue'

const editorContent = ref('')
</script>

<style scoped>
.app {
  max-width: 800px;
  margin: 20px auto;
}

.content-preview {
  margin-top: 20px;
  padding: 10px;
  border: 1px solid #eee;
  text-align: right;
}
</style>

