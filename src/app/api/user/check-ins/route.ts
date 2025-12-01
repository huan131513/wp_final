import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user?.role !== 'MEMBER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const checkIns = await prisma.checkIn.findMany({
      where: { userId: session.user.id },
      include: {
        location: {
          select: { name: true, type: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(checkIns)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch check-ins' }, { status: 500 })
  }
}

