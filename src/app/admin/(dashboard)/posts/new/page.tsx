'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Save, Send, Image as ImageIcon, Eye } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const categories = [
  { value: 'ANALYSIS', label: '분석' },
  { value: 'PREVIEW', label: '프리뷰' },
  { value: 'REVIEW', label: '리뷰' },
  { value: 'NEWS', label: '뉴스' },
  { value: 'GUIDE', label: '가이드' },
  { value: 'ANNOUNCEMENT', label: '공지' },
]

const sportTypes = [
  { value: '', label: '전체 (스포츠 무관)' },
  { value: 'FOOTBALL', label: '축구' },
  { value: 'BASKETBALL', label: '농구' },
  { value: 'BASEBALL', label: '야구' },
]

const languages = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
]

interface TranslationData {
  title: string
  excerpt: string
  content: string
}

type Translations = Record<string, TranslationData>

export default function NewPostPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState('ko')
  const [showPreview, setShowPreview] = useState(false)

  const [slug, setSlug] = useState('')
  const [category, setCategory] = useState('ANALYSIS')
  const [sportType, setSportType] = useState('')
  const [featuredImage, setFeaturedImage] = useState('')

  const [translations, setTranslations] = useState<Translations>({
    ko: { title: '', excerpt: '', content: '' },
    en: { title: '', excerpt: '', content: '' },
  })

  const updateTranslation = (lang: string, field: keyof TranslationData, value: string) => {
    setTranslations((prev) => ({
      ...prev,
      [lang]: { ...prev[lang], [field]: value },
    }))
  }

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9가-힣\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 100)
  }

  const handleTitleChange = (lang: string, value: string) => {
    updateTranslation(lang, 'title', value)
    // 한국어 제목에서 slug 자동 생성
    if (lang === 'ko' && !slug) {
      setSlug(generateSlug(value))
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (result.url) {
        // 마크다운 이미지 문법으로 현재 언어 콘텐츠에 삽입
        const imageMarkdown = `\n![${file.name}](${result.url})\n`
        updateTranslation(
          activeTab,
          'content',
          translations[activeTab].content + imageMarkdown
        )
      } else {
        alert('이미지 업로드에 실패했습니다.')
      }
    } catch {
      alert('이미지 업로드 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const handleFeaturedImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (result.url) {
        setFeaturedImage(result.url)
      } else {
        alert('이미지 업로드에 실패했습니다.')
      }
    } catch {
      alert('이미지 업로드 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async (publish: boolean) => {
    if (!translations.ko.title) {
      alert('한국어 제목을 입력해주세요.')
      return
    }

    if (!slug) {
      alert('슬러그를 입력해주세요.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/admin/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          category,
          sportType: sportType || null,
          featuredImage: featuredImage || null,
          translations,
          status: publish ? 'PUBLISHED' : 'DRAFT',
        }),
      })

      const result = await response.json()

      if (response.ok) {
        router.push('/admin/posts')
        router.refresh()
      } else {
        alert(result.error || '저장에 실패했습니다.')
      }
    } catch {
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">새 포스트</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowPreview(!showPreview)}
            className="border-gray-700"
          >
            <Eye className="w-4 h-4 mr-2" />
            {showPreview ? '편집' : '미리보기'}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={loading}
            className="border-gray-700"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            임시저장
          </Button>
          <Button
            onClick={() => handleSave(true)}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            게시하기
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 메인 에디터 */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-gray-800">
              {languages.map((lang) => (
                <TabsTrigger
                  key={lang.code}
                  value={lang.code}
                  className="data-[state=active]:bg-gray-700"
                >
                  {lang.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {languages.map((lang) => (
              <TabsContent key={lang.code} value={lang.code} className="space-y-4">
                <Card className="bg-gray-900 border-gray-800">
                  <CardContent className="pt-6 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-gray-300">제목</Label>
                      <Input
                        value={translations[lang.code]?.title || ''}
                        onChange={(e) => handleTitleChange(lang.code, e.target.value)}
                        placeholder="포스트 제목을 입력하세요"
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-gray-300">발췌문 (요약)</Label>
                      <Textarea
                        value={translations[lang.code]?.excerpt || ''}
                        onChange={(e) => updateTranslation(lang.code, 'excerpt', e.target.value)}
                        placeholder="포스트 요약을 입력하세요 (목록에 표시됩니다)"
                        rows={2}
                        className="bg-gray-800 border-gray-700 text-white resize-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-gray-300">본문 (Markdown)</Label>
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={uploading}
                            className="border-gray-700"
                            asChild
                          >
                            <span>
                              {uploading ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <ImageIcon className="w-4 h-4 mr-2" />
                              )}
                              이미지 삽입
                            </span>
                          </Button>
                        </label>
                      </div>

                      {showPreview ? (
                        <div className="prose prose-invert prose-sm max-w-none bg-gray-800 border border-gray-700 rounded-md p-4 min-h-[400px]">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {translations[lang.code]?.content || '*내용이 없습니다*'}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <Textarea
                          value={translations[lang.code]?.content || ''}
                          onChange={(e) => updateTranslation(lang.code, 'content', e.target.value)}
                          placeholder="마크다운 형식으로 본문을 작성하세요..."
                          rows={20}
                          className="bg-gray-800 border-gray-700 text-white font-mono text-sm resize-none"
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* 사이드바 설정 */}
        <div className="space-y-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white text-base">포스트 설정</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-300">슬러그 (URL)</Label>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="post-url-slug"
                  className="bg-gray-800 border-gray-700 text-white"
                />
                <p className="text-xs text-gray-500">/blog/post/{slug || 'slug'}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">카테고리</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">스포츠</Label>
                <Select value={sportType} onValueChange={setSportType}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {sportTypes.map((sport) => (
                      <SelectItem key={sport.value || 'none'} value={sport.value}>
                        {sport.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">대표 이미지</Label>
                {featuredImage ? (
                  <div className="relative">
                    <img
                      src={featuredImage}
                      alt="Featured"
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setFeaturedImage('')}
                      className="absolute top-2 right-2"
                    >
                      삭제
                    </Button>
                  </div>
                ) : (
                  <label className="block cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFeaturedImageUpload}
                      className="hidden"
                    />
                    <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center hover:border-gray-600 transition-colors">
                      {uploading ? (
                        <Loader2 className="w-8 h-8 mx-auto text-gray-500 animate-spin" />
                      ) : (
                        <>
                          <ImageIcon className="w-8 h-8 mx-auto text-gray-500 mb-2" />
                          <p className="text-sm text-gray-500">클릭하여 업로드</p>
                        </>
                      )}
                    </div>
                  </label>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
