import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ isAdmin: false }, { status: 400 })
    }

    const adminEmail = process.env.ADMIN_EMAIL

    if (!adminEmail) {
      console.error('ADMIN_EMAIL environment variable is not set')
      return NextResponse.json({ isAdmin: false }, { status: 500 })
    }

    const isAdmin = email.toLowerCase() === adminEmail.toLowerCase()

    return NextResponse.json({ isAdmin })
  } catch {
    return NextResponse.json({ isAdmin: false }, { status: 500 })
  }
}
