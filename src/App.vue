
<template>
  <div class="app">
    <tiptap-editor
      v-model="editorContent"
    />
    <div class="content-preview">
      <h3>Content:</h3>
      <div v-html="editorContent"></div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import TiptapEditor from './components/TiptapEditor.vue'

const editorContent = ref(`
<p>بسم <a class="footnote-ref" data-number="1">[1]</a>الله <a class="footnote-ref" data-number="2">[2]</a>الرحمن <a class="footnote-ref" data-number="3">[3]</a>الرحيم <a class="footnote-ref" data-number="4">[4]</a></p><div id="footnote-registry"><p data-number="1" class="footnote-citation">[1] </p><p data-number="2" class="footnote-citation">[2] </p><p data-number="3" class="footnote-citation">[3] </p><p data-number="4" class="footnote-citation">[4] </p></div>
`)
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
}
</style>

