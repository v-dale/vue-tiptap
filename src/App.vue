
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

//const editorContent = ref(`
//<p>بسم <a class="footnote-ref" data-number="1" href="#fn1" id="bk1">[1]</a> الله <a class="footnote-ref" data-number="2" href="#fn2" id="bk2">[2]</a> الرحمن <a class="footnote-ref" data-number="3" href="#fn3" id="bk3">[3]</a> الرحيم <a class="footnote-ref" data-number="4" href="#fn4" id="bk4">[4]</a></p><footer id="footnotes" aria-label="Footnotes"><p data-number="1" id="fn1" class="footnote-citation"><a href="#bk1" target="_blank" class="footnote-backlink">[1]</a> بسم</p><p data-number="2" id="fn2" class="footnote-citation"><a href="#bk2" target="_blank" class="footnote-backlink">[2]</a> الله</p><p data-number="3" id="fn3" class="footnote-citation"><a href="#bk3" target="_blank" class="footnote-backlink">[3]</a> الرحمن</p><p data-number="4" id="fn4" class="footnote-citation"><a href="#bk4" target="_blank" class="footnote-backlink">[4]</a> الرحيم</p></footer>
//`)

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

