import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.name) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const body = await request.json()
    const { newPassword } = body

    if (!newPassword || newPassword.length < 6) {
        return new NextResponse('Password must be at least 6 characters', { status: 400 })
    }

    // Update password - Note: In a real app, you should hash the password here!
    // Since we are using simple text password for demo/prototype as per initial setup:
    await prisma.user.update({
        where: { name: session.user.name },
        data: { password: newPassword }
    })

    return NextResponse.json({ message: 'Password updated' })
  } catch (error) {
    console.error('Password update error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

