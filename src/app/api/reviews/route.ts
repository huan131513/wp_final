import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const reviewSchema = z.object({
  locationId: z.string().uuid(),
  rating: z.number().min(1).max(5),
  comment: z.string().min(1),
})

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = reviewSchema.parse(body)
    
    const review = await prisma.review.create({
      data: {
        locationId: validatedData.locationId,
        userId: session.user.id,
        userName: session.user.name || 'Member',
        rating: validatedData.rating,
        comment: validatedData.comment,
      },
    })
    
    return NextResponse.json(review)
  } catch (error) {
    console.error(error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create review' }, { status: 500 })
  }
}

