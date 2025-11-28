import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.name) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const requests = await prisma.facilityRequest.findMany({
      where: {
        user: { name: session.user.name }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(requests)
  } catch (error) {
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
