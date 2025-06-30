// Instale antes:
// npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link

import { useEditor, EditorContent, Editor, Extension } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { useEffect } from 'react'
import { Separator } from '../ui/separator'
import { Button } from '../ui/button'
import { cn } from '~/lib/utils'
import { Braces, Code, ListOrdered, Quote, Redo, SeparatorHorizontal, Undo, WrapText } from 'lucide-react'
import { ListBulletIcon } from '@radix-ui/react-icons'
import Heading from '@tiptap/extension-heading'
import BulletList from '@tiptap/extension-bullet-list'
import OrderedList from '@tiptap/extension-ordered-list'

const TiptapEditor = ({ onChange, content = "" }: { onChange: (html: string) => void, content?: string }) => {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Heading.configure({
        levels: [1, 2, 3, 4, 5, 6],
        HTMLAttributes: {
          class: 'font-semibold'
        }
      }),
      BulletList.configure({
        HTMLAttributes: {
          class: 'list-disc pl-5'
        }
      }),
      OrderedList.configure({
        HTMLAttributes: {
          class: 'list-decimal pl-5'
        }
      }),

    ],
    content,
    editorProps: {
      attributes: {
        class: 'min-h-[200px] border p-4 rounded-md bg-white focus:outline-none prose'
      }

    },
    onUpdate({ editor }) {
      onChange(editor.getHTML())
    }
  })

  useEffect(() => {
    if (editor && content) editor.commands.setContent(content)
  }, [editor])

  return (
    <>
      <MenuBar editor={editor} />
      <Separator className='my-2' />
      <EditorContent editor={editor} />
    </>
  )
}

interface MenuBarProps {
  editor: Editor | null
}

const MenuBar = ({ editor }: MenuBarProps) => {
  if (!editor) {
    return null
  }

  return (
    <div className="control-group">
      <div className="flex flex-wrap gap-2 items-center ">
        <section className='flex gap-2 items-center'>
          <Button variant="outline"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={cn(
              "text-xs w-8 h-8 p-2",
              editor.isActive('bold') && 'bg-slate-200',
              "font-semibold"
            )}
          >
            B
          </Button>
          <Button variant="outline"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={cn(
              "text-xs w-8 h-8 p-2",
              editor.isActive('italic') && 'bg-slate-200',
              "italic"
            )}
          >
            I
          </Button>
          <Button variant="outline"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={cn(
              "text-xs w-8 h-8 p-2",
              editor.isActive('strike') && 'bg-slate-200',
              "line-through"
            )}
          >
            S
          </Button>
        </section>
        <Separator orientation='vertical' className='h-[14px]' />
        <section className='flex gap-2'>
          {/* <Button variant="outline"
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={cn(
              "text-xs w-8 h-8 p-2",
              editor.isActive('code') && 'bg-slate-200',
              "line-through"
            )}
          >
            <Code width={12} height={12} />
          </Button> */}
          {/* <Button variant="outline" onClick={() => editor.chain().focus().unsetAllMarks().run()}>
            Clear marks
          </Button>
          <Button variant="outline" onClick={() => editor.chain().focus().clearNodes().run()}>
            Clear nodes
          </Button> */}
        </section>
        <Separator orientation='vertical' className='h-[14px]' />
        <section className='flex gap-2'>
          <Button variant="outline"
            onClick={() => editor.chain().focus().setParagraph().run()}
            className={cn(
              "text-xs w-8 h-8 p-2",
              editor.isActive('code') && 'bg-slate-200',
              "paraghraph"
            )}
          >
            P
          </Button>
          <Button variant="outline"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={cn(
              "text-xs w-8 h-8 p-2",
              editor.isActive('heading', { level: 1 }) && 'bg-slate-200',
            )}
          >
            H1
          </Button>
          <Button variant="outline"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={cn(
              "text-xs w-8 h-8 p-2",
              editor.isActive('heading', { level: 2 }) && 'bg-slate-200',
            )}
          >
            H2
          </Button>
          <Button variant="outline"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={cn(
              "text-xs w-8 h-8 p-2",
              editor.isActive('heading', { level: 3 }) && 'bg-slate-200',
            )}
          >
            H3
          </Button>
          <Button variant="outline"
            onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
            className={cn(
              "text-xs w-8 h-8 p-2",
              editor.isActive('heading', { level: 4 }) && 'bg-slate-200',
            )}
          >
            H4
          </Button>
          <Button variant="outline"
            onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}
            className={cn(
              "text-xs w-8 h-8 p-2",
              editor.isActive('heading', { level: 5 }) && 'bg-slate-200',
            )}
          >
            H5
          </Button>
          <Button variant="outline"
            onClick={() => editor.chain().focus().toggleHeading({ level: 6 }).run()}
            className={cn(
              "text-xs w-8 h-8 p-2",
              editor.isActive('heading', { level: 6 }) && 'bg-slate-200',
            )}
          >
            H6
          </Button>
        </section>
        <Separator orientation='vertical' className='h-[14px]' />
        <Button variant="outline"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn(
            "text-xs w-8 h-8 p-2",
            editor.isActive('bulletList') && 'bg-slate-200',
          )}
        >
          <ListBulletIcon />
        </Button>
        <Button variant="outline"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn(
            "text-xs w-8 h-8 p-2",
            editor.isActive('orderedList') && 'bg-slate-200',
          )}
        >
          <ListOrdered />
        </Button>
        {/* <Button variant="outline"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={cn(
            "text-xs w-8 h-8 p-2",
            editor.isActive('codeBlock') && 'bg-slate-200',
          )}
        >
          <Code />
        </Button> */}
        <Button variant="outline"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={cn(
            "text-xs w-8 h-8 p-2",
            editor.isActive('blockQuote') && 'bg-slate-200',
          )}
        >
          <Quote />
        </Button>
        <Button variant="outline"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className={cn(
            "text-xs w-8 h-8 p-2",
          )}
        >
          <SeparatorHorizontal />
        </Button>
        <Button variant="outline" onClick={() => editor.chain().focus().setHardBreak().run()}
          className={cn(
            "text-xs w-8 h-8 p-2",
          )}
        >
          <WrapText />
        </Button>
        <Button variant="outline" onClick={() => editor.chain().focus().undo().run()}
          className={cn(
            "text-xs w-8 h-8 p-2",
          )}
        >
          <Undo />
        </Button>
        <Button variant="outline" onClick={() => editor.chain().focus().redo().run()}
          className={cn(
            "text-xs w-8 h-8 p-2",
          )}
        >
          <Redo />
        </Button>
      </div>
    </div>
  )
}


export default TiptapEditor;
