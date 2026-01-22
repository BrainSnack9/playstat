import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'PlayStat - AI Sports Analysis Platform'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0a',
          backgroundImage: 'radial-gradient(circle at 25% 25%, #10b98120 0%, transparent 50%), radial-gradient(circle at 75% 75%, #3b82f620 0%, transparent 50%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 40,
          }}
        >
          <svg
            width="120"
            height="120"
            viewBox="0 0 512 512"
            fill="none"
            style={{ marginRight: 24 }}
          >
            <path
              d="M64 384L192 192L320 320L448 128"
              stroke="#5eead4"
              strokeWidth="48"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            style={{
              fontSize: 96,
              fontWeight: 'bold',
              color: 'white',
              letterSpacing: '-0.02em',
            }}
          >
            PlayStat
          </span>
        </div>
        <div
          style={{
            fontSize: 36,
            color: '#a1a1aa',
            textAlign: 'center',
            maxWidth: 800,
            lineHeight: 1.4,
          }}
        >
          AI-powered Sports Analysis Platform
        </div>
        <div
          style={{
            display: 'flex',
            gap: 32,
            marginTop: 48,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 24px',
              borderRadius: 9999,
              backgroundColor: '#84cc1620',
              color: '#84cc16',
              fontSize: 24,
            }}
          >
            ⚽ Football
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 24px',
              borderRadius: 9999,
              backgroundColor: '#f9731620',
              color: '#f97316',
              fontSize: 24,
            }}
          >
            🏀 Basketball
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 24px',
              borderRadius: 9999,
              backgroundColor: '#10b98120',
              color: '#10b981',
              fontSize: 24,
            }}
          >
            ⚾ Baseball
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
