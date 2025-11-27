import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const reviewSchema = z.object({
  locationId: z.string().uuid(),
  userName: z.string().min(1),
  rating: z.number().min(1).max(5),
  comment: z.string().min(1),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validatedData = reviewSchema.parse(body)
    
    const review = await prisma.review.create({
      data: validatedData,
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

