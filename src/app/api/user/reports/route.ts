import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.name) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const reports = await prisma.report.findMany({
      where: {
        user: { name: session.user.name }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        location: {
          select: { name: true, type: true }
        }
      }
    })

    return NextResponse.json(reports)
  } catch (error) {
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
