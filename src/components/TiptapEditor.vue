
<template>
  <div class="tiptap-editor">
    <div class="menu-bar">
      <!-- Alignment -->
      
      <button 
        @click="editor?.chain().focus().setTextAlign('center').run()"
        :class="{ 'is-active': editor?.isActive({ textAlign: 'center' }) }"
      >
        center
      </button>
      <button 
    @click="editor?.chain().focus().unsetTextAlign().run()"
    :class="{ 'is-active': !editor?.isActive({ textAlign: 'left' }) && 
                          !editor?.isActive({ textAlign: 'center' }) && 
                          !editor?.isActive({ textAlign: 'justify' }) }"
  >
    default
  </button>
      <span class="divider">|</span>
     
      <!-- Headings -->
      <button 
        @click="editor?.chain().focus().setParagraph().run()"
        :class="{ 'is-active': editor?.isActive('paragraph') }"
      >
        paragraph
      </button>
      <button 
        @click="editor?.chain().focus().toggleHeading({ level: 1 }).run()"
        :class="{ 'is-active': editor?.isActive('heading', { level: 1 }) }"
      >
        h1
      </button>
      <button 
        @click="editor?.chain().focus().toggleHeading({ level: 2 }).run()"
        :class="{ 'is-active': editor?.isActive('heading', { level: 2 }) }"
      >
        h2
      </button>
      
      <span class="divider">|</span>
      
      <!-- Lists -->
      <button 
        @click="editor?.chain().focus().toggleBulletList().run()"
        :class="{ 'is-active': editor?.isActive('bulletList') }"
      >
        bullet list
      </button>
      <button 
        @click="editor?.chain().focus().toggleOrderedList().run()"
        :class="{ 'is-active': editor?.isActive('orderedList') }"
      >
        ordered list
      </button>

      <span class="divider">|</span>
      
      <!-- Add Footer Reference Button -->
      <button 
        @click="editor?.chain().focus().insertFooterRef().run()"
      >
        Add Footer
      </button>
      
      <span class="divider">|</span>

      <!-- HTML Toggle -->
      <button 
        @click="isHtmlMode = !isHtmlMode"
        :class="{ 'is-active': isHtmlMode }"
      >
        HTML
      </button>
    </div>

    <!-- Toggle between HTML and Rich Text Editor -->
    <div v-if="isHtmlMode" class="html-code">
      <textarea
        v-model="htmlContent"
        @input="updateHtmlContent"
        dir="ltr"
      ></textarea>
    </div>
    <editor-content 
      v-else 
      :editor="editor" 
    />
  </div>
</template>

<script setup>
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { FooterRef } from './FooterExtension'
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue'])

const isHtmlMode = ref(false)
const htmlContent = ref(props.modelValue)

const editor = useEditor({
  content: props.modelValue,
  extensions: [
    StarterKit,
    Underline,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
      alignments: ['left', 'center', 'justify'],
      defaultAlignment: null,
    }),
    FooterRef,
  
  ],
  editorProps: {
    attributes: {
      dir: 'rtl',
    },
  },
  onUpdate: ({ editor }) => {
    const html = editor.getHTML()
        // Clean up unnecessary right alignment styles
    const cleanedHtml = html.replace(/style="text-align: right;?"/g, '')
    htmlContent.value = html
    emit('update:modelValue', html)
  },
})

// Watch for external content changes
watch(() => props.modelValue, (newContent) => {
  if (!isHtmlMode.value && editor.value && newContent !== editor.value.getHTML()) {
    editor.value.commands.setContent(newContent, false)
    htmlContent.value = newContent
  }
})

// Handle HTML content updates
const updateHtmlContent = () => {
  if (editor.value) {
    editor.value.commands.setContent(htmlContent.value, false)
    emit('update:modelValue', htmlContent.value)
  }
}

onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<style>
.tiptap-editor {
  border-radius: 0.5rem;
  border: 1px solid #ccc;
  direction: rtl;
}

.menu-bar {
  padding: 0.5rem;
  border-bottom: 1px solid #ccc;
  background-color: #f5f5f5;
  border-top-left-radius: 0.5rem;
  border-top-right-radius: 0.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.menu-bar button {
  border: none;
  background: none;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.875rem;
}

.menu-bar button:hover {
  background-color: #e0e0e0;
}

.menu-bar button.is-active {
  background-color: #000;
  color: #fff;
}

.divider {
  color: #ccc;
  margin: 0 0.25rem;
}

.ProseMirror {
  padding: 1rem;
  min-height: 150px;
  outline: none;
 text-align: right; /* Add this line */

}

.ProseMirror p {
  margin: 1rem 0;
}

.ProseMirror h1 {
  font-size: 2em;
  margin: 1rem 0;
}

.ProseMirror h2 {
  font-size: 1.5em;
  margin: 1rem 0;
}

.ProseMirror ul,
.ProseMirror ol {
  padding-right: 1.5rem;
  margin: 1rem 0;
}

.ProseMirror:focus {
  outline: none;
}

.ProseMirror .text-left {
  text-align: left;
}

.ProseMirror .text-center {
  text-align: center;
}


.ProseMirror .text-justify {
  text-align: justify;
}

.ProseMirror p.is-editor-empty:first-child::before {
  color: #adb5bd;
  content: attr(data-placeholder);
  float: right;
  height: 0;
  pointer-events: none;
}

.html-code {
  position: relative;
  height: 300px;
}

.html-code textarea {
  width: 100%;
  height: 100%;
  padding: 1rem;
  font-family: monospace;
  font-size: 14px;
  line-height: 1.4;
  color: #2c3e50;
  background: #f8f9fa;
  border: none;
  resize: none;
  outline: none;
  white-space: pre-wrap;
}

.html-code textarea::selection {
  background: #b3d4fc;
}

/* Add styles for footnote references */
#footnote-registry {
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid #e0e0e0;
}

.footnote-citation {
  margin: 0.5rem 0;
  font-size: 0.875rem;
  color: #666;
}

.footnote-ref {
  color: #0366d6;
  text-decoration: none;
  cursor: pointer;
  font-size: 0.75em;
  vertical-align: super;
  padding: 0 2px;
}

.footnote-ref:hover {
  text-decoration: underline;
}

</style>
