import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const checkInSchema = z.object({
  locationId: z.string().uuid(),
})

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user?.role !== 'MEMBER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { locationId } = checkInSchema.parse(body)

    const location = await prisma.location.findUnique({
      where: { id: locationId },
    })

    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    if (location.type !== 'TOILET' && location.type !== 'ACCESSIBLE_TOILET') {
      return NextResponse.json({ error: 'Only toilets allow check-ins' }, { status: 400 })
    }

    const checkIn = await prisma.checkIn.create({
      data: {
        userId: session.user.id,
        locationId,
      },
    })
    
    return NextResponse.json(checkIn)
  } catch (error) {
    console.error(error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to check in' }, { status: 500 })
  }
}

