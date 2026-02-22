import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    return NextResponse.json({ success: true, message: 'Agreement send stub executed', payload: body })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send agreement'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
