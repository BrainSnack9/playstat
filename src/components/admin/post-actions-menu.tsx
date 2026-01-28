'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Edit, Archive, RotateCcw, Trash2, ExternalLink } from 'lucide-react'

interface PostActionsMenuProps {
  postId: string
  currentStatus: string
}

export function PostActionsMenu({ postId, currentStatus }: PostActionsMenuProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleArchive = async () => {
    if (isLoading) return
    setIsLoading(true)

    try {
      const newStatus = currentStatus === 'ARCHIVED' ? 'DRAFT' : 'ARCHIVED'
      const res = await fetch(`/api/admin/posts/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (res.ok) {
        router.refresh()
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (isLoading) return
    if (!confirm('정말 삭제하시겠습니까?')) return

    setIsLoading(true)

    try {
      const res = await fetch(`/api/admin/posts/${postId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        router.refresh()
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-gray-400 hover:text-white hover:bg-gray-800"
          disabled={isLoading}
        >
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 bg-gray-900 border-gray-800">
        <DropdownMenuItem
          onClick={() => router.push(`/admin/posts/${postId}/edit`)}
          className="text-gray-300 focus:text-white focus:bg-gray-800"
        >
          <Edit className="w-4 h-4 mr-2" />
          편집
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => window.open(`/ko/blog/post/${postId}`, '_blank')}
          className="text-gray-300 focus:text-white focus:bg-gray-800"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          보기
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-gray-800" />
        <DropdownMenuItem
          onClick={handleArchive}
          className="text-gray-300 focus:text-white focus:bg-gray-800"
        >
          {currentStatus === 'ARCHIVED' ? (
            <>
              <RotateCcw className="w-4 h-4 mr-2" />
              복원
            </>
          ) : (
            <>
              <Archive className="w-4 h-4 mr-2" />
              보관
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleDelete}
          className="text-red-400 focus:text-red-400 focus:bg-red-950/30"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          삭제
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
