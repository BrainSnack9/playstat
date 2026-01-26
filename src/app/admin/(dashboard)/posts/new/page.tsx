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
import { Loader2, Save, Send, Image as ImageIcon, Eye, Languages } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'

const categories = [
  { value: 'ANALYSIS', label: '분석' },
  { value: 'PREVIEW', label: '프리뷰' },
  { value: 'REVIEW', label: '리뷰' },
]

const sportTypes = [
  { value: 'NONE', label: '전체 (스포츠 무관)' },
  { value: 'FOOTBALL', label: '축구' },
  { value: 'BASKETBALL', label: '농구' },
  { value: 'BASEBALL', label: '야구' },
]

const languages = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'ja', label: '日本語' },
  { code: 'de', label: 'Deutsch' },
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
  const [translating, setTranslating] = useState(false)
  const [activeTab, setActiveTab] = useState('ko')
  const [showPreview, setShowPreview] = useState(false)

  const [slug, setSlug] = useState('')
  const [category, setCategory] = useState('ANALYSIS')
  const [sportType, setSportType] = useState('NONE')
  const [featuredImage, setFeaturedImage] = useState('')

  // 번역 설정
  const [sourceLocale, setSourceLocale] = useState('ko')
  const [targetLocales, setTargetLocales] = useState<string[]>([])

  const [translations, setTranslations] = useState<Translations>({
    ko: { title: '', excerpt: '', content: '' },
    en: { title: '', excerpt: '', content: '' },
    es: { title: '', excerpt: '', content: '' },
    ja: { title: '', excerpt: '', content: '' },
    de: { title: '', excerpt: '', content: '' },
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
          sportType: sportType === 'NONE' ? null : sportType,
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
    } catch (error) {
      console.error('Save error:', error)
      alert(`저장 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleTargetLocale = (locale: string) => {
    setTargetLocales((prev) =>
      prev.includes(locale)
        ? prev.filter((l) => l !== locale)
        : [...prev, locale]
    )
  }

  const handleTranslate = async () => {
    const sourceContent = translations[sourceLocale]
    if (!sourceContent?.title && !sourceContent?.content) {
      alert('번역할 원본 콘텐츠가 없습니다.')
      return
    }

    if (targetLocales.length === 0) {
      alert('번역할 언어를 선택해주세요.')
      return
    }

    setTranslating(true)

    try {
      const response = await fetch('/api/admin/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceLocale,
          targetLocales,
          content: {
            title: sourceContent.title,
            excerpt: sourceContent.excerpt,
            content: sourceContent.content,
          },
        }),
      })

      const result = await response.json()

      if (response.ok && result.translations) {
        setTranslations((prev) => ({
          ...prev,
          ...result.translations,
        }))
        alert(`${Object.keys(result.translations).length}개 언어로 번역이 완료되었습니다.`)
      } else {
        alert(result.error || '번역에 실패했습니다.')
      }
    } catch (error) {
      console.error('Translation error:', error)
      alert('번역 중 오류가 발생했습니다.')
    } finally {
      setTranslating(false)
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
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkBreaks]}
                            components={{
                              h1: ({ children }) => <h1 className="text-xl font-bold text-white mt-6 mb-3">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-lg font-bold text-white mt-6 mb-3">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-base font-bold text-white mt-4 mb-2">{children}</h3>,
                              p: ({ children }) => <p className="text-gray-300 mb-3 leading-relaxed">{children}</p>,
                              blockquote: ({ children }) => (
                                <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-4 bg-gray-900/50 text-gray-300 italic">
                                  {children}
                                </blockquote>
                              ),
                              hr: () => <hr className="my-6 border-t border-gray-600" />,
                              strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
                              em: ({ children }) => <em className="italic text-gray-200">{children}</em>,
                              a: ({ href, children }) => (
                                <a href={href} className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">
                                  {children}
                                </a>
                              ),
                              ul: ({ children }) => <ul className="list-disc list-inside text-gray-300 mb-3 space-y-1">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal list-inside text-gray-300 mb-3 space-y-1">{children}</ol>,
                              img: ({ src, alt }) => <img src={src} alt={alt || ''} className="rounded-lg my-4 max-w-full" />,
                            }}
                          >
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
                      <SelectItem key={sport.value} value={sport.value}>
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

          {/* 번역 설정 */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Languages className="w-4 h-4" />
                번역
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-300">원본 언어</Label>
                <Select value={sourceLocale} onValueChange={setSourceLocale}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {languages.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">번역할 언어</Label>
                <div className="space-y-2">
                  {languages
                    .filter((lang) => lang.code !== sourceLocale)
                    .map((lang) => (
                      <label
                        key={lang.code}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={targetLocales.includes(lang.code)}
                          onChange={() => handleToggleTargetLocale(lang.code)}
                          className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900"
                        />
                        <span className="text-gray-300 text-sm">{lang.label}</span>
                      </label>
                    ))}
                </div>
              </div>

              <Button
                onClick={handleTranslate}
                disabled={translating || targetLocales.length === 0}
                variant="outline"
                className="w-full border-gray-700"
              >
                {translating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    번역 중...
                  </>
                ) : (
                  <>
                    <Languages className="w-4 h-4 mr-2" />
                    번역하기
                  </>
                )}
              </Button>

              <p className="text-xs text-gray-500">
                원본 언어의 콘텐츠를 선택한 언어로 번역합니다.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
