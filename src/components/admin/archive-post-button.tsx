'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Archive, RotateCcw, Loader2 } from 'lucide-react'

interface ArchivePostButtonProps {
  postId: string
  currentStatus: string
}

export function ArchivePostButton({ postId, currentStatus }: ArchivePostButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const isArchived = currentStatus === 'ARCHIVED'

  const handleToggleArchive = async () => {
    const action = isArchived ? '복원' : '보관'
    if (!confirm(`이 포스트를 ${action}하시겠습니까?`)) {
      return
    }

    setLoading(true)

    try {
      const newStatus = isArchived ? 'DRAFT' : 'ARCHIVED'
      const response = await fetch(`/api/admin/posts/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        router.refresh()
      } else {
        alert(`${action}에 실패했습니다.`)
      }
    } catch {
      alert('요청 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleToggleArchive}
      disabled={loading}
      className={isArchived
        ? "border-blue-900 text-blue-400 hover:bg-blue-950/50 hover:text-blue-300"
        : "border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-gray-300"
      }
      title={isArchived ? '복원하기' : '보관하기'}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isArchived ? (
        <RotateCcw className="w-4 h-4" />
      ) : (
        <Archive className="w-4 h-4" />
      )}
    </Button>
  )
}
