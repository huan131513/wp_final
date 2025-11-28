import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const updateReviewSchema = z.object({
  comment: z.string().min(1),
  rating: z.number().min(1).max(5).optional()
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = updateReviewSchema.parse(body)

    // 檢查評論是否存在且屬於當前用戶
    const review = await prisma.review.findUnique({
      where: { id },
      select: { userId: true, parentId: true, isDeleted: true }
    })

    if (!review || review.isDeleted) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    if (review.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 如果是回覆，不需要評分
    const updateData: any = {
      comment: validatedData.comment,
      editedAt: new Date()
    }

    if (!review.parentId && validatedData.rating) {
      updateData.rating = validatedData.rating
    }

    const updatedReview = await prisma.review.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json({
      ...updatedReview,
      isLiked: false, // 需要前端重新獲取
      likesCount: updatedReview._count.likes,
      repliesCount: updatedReview._count.replies,
      _count: undefined
    })
  } catch (error) {
    console.error('Update review error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to update review' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // 檢查評論是否存在
    const review = await prisma.review.findUnique({
      where: { id },
      select: { userId: true, isDeleted: true }
    })

    if (!review || review.isDeleted) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    // 檢查權限：只有作者或管理員可以刪除
    const isAdmin = session.user.role === 'ADMIN'
    if (review.userId !== session.user.id && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 軟刪除
    await prisma.review.update({
      where: { id },
      data: { isDeleted: true }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete review error:', error)
    return NextResponse.json({ error: 'Failed to delete review' }, { status: 500 })
  }
}

