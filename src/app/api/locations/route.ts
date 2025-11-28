import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

const locationSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['TOILET', 'ACCESSIBLE_TOILET', 'NURSING_ROOM']),
  lat: z.number(),
  lng: z.number(),
  floor: z.string().optional(),
  hasTissue: z.boolean().optional(),
  hasDryer: z.boolean().optional(),
  hasSeat: z.boolean().optional(),
  hasDiaperTable: z.boolean().optional(),
  hasWaterDispenser: z.boolean().optional(),
  hasAutoDoor: z.boolean().optional(),
  hasHandrail: z.boolean().optional(),
})

export async function GET() {
  try {
    const locations = await prisma.location.findMany({
        include: {
            reviews: {
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: {
                            avatar: true
                        }
                    }
                }
            }
        }
    })
    return NextResponse.json(locations)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const validatedData = locationSchema.parse(body)
    
    const location = await prisma.location.create({
      data: validatedData,
    })
    
    return NextResponse.json(location)
  } catch (error) {
    console.error(error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create location' }, { status: 500 })
  }
}
