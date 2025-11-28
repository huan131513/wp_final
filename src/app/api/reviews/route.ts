import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const reviewSchema = z.object({
  locationId: z.string().uuid(),
  rating: z.number().min(1).max(5).optional(), // 回覆不需要評分
  comment: z.string().min(1),
  parentId: z.string().uuid().optional(), // 回覆的父評論 ID
}).refine((data) => {
  // 如果是頂層評論（沒有 parentId），則需要評分
  if (!data.parentId && !data.rating) {
    return false
  }
  return true
}, {
  message: 'Top-level reviews require a rating',
  path: ['rating']
})

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = reviewSchema.parse(body)
    
    // 如果是回覆，需要驗證父評論存在且屬於同一個地點
    if (validatedData.parentId) {
      const parentReview = await prisma.review.findUnique({
        where: { id: validatedData.parentId },
        select: { locationId: true, isDeleted: true }
      })
      
      if (!parentReview) {
        return NextResponse.json({ error: 'Parent review not found' }, { status: 404 })
      }
      
      if (parentReview.isDeleted) {
        return NextResponse.json({ error: 'Cannot reply to deleted review' }, { status: 400 })
      }
      
      if (parentReview.locationId !== validatedData.locationId) {
        return NextResponse.json({ error: 'Parent review must be from the same location' }, { status: 400 })
      }
    }
    
    const review = await prisma.review.create({
      data: {
        locationId: validatedData.locationId,
        userId: session.user.id,
        userName: session.user.name || 'Member',
        rating: validatedData.parentId ? null : validatedData.rating || null, // 回覆不需要評分
        comment: validatedData.comment,
        parentId: validatedData.parentId || null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true
          }
        },
        _count: {
          select: {
            likes: true,
            replies: true
          }
        }
      }
    })
    
    // 如果是回覆，發送通知給父評論的作者
    if (validatedData.parentId) {
      const parentReview = await prisma.review.findUnique({
        where: { id: validatedData.parentId },
        select: { userId: true, userName: true }
      })
      
      if (parentReview && parentReview.userId && parentReview.userId !== session.user.id) {
        await prisma.notification.create({
          data: {
            userId: parentReview.userId,
            title: '新的回覆',
            message: `${session.user.name || '有人'} 回覆了您的評論`,
            type: 'REPLY',
            link: `/location/${validatedData.locationId}`
          }
        })
      }
    }
    
    return NextResponse.json(review)
  } catch (error) {
    console.error(error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create review' }, { status: 500 })
  }
}

