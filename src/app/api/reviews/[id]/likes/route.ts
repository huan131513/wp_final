import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // 檢查評論是否存在且未被刪除
    const review = await prisma.review.findUnique({
      where: { id },
      select: { id: true, isDeleted: true }
    })

    if (!review || review.isDeleted) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    // 檢查是否已經點讚
    const existingLike = await prisma.reviewLike.findUnique({
      where: {
        reviewId_userId: {
          reviewId: id,
          userId: session.user.id
        }
      }
    })

    if (existingLike) {
      // 取消點讚
      await prisma.reviewLike.delete({
        where: {
          id: existingLike.id
        }
      })

      const likesCount = await prisma.reviewLike.count({
        where: { reviewId: id }
      })

      return NextResponse.json({ 
        isLiked: false,
        likesCount 
      })
    } else {
      // 新增點讚
      await prisma.reviewLike.create({
        data: {
          reviewId: id,
          userId: session.user.id
        }
      })

      const likesCount = await prisma.reviewLike.count({
        where: { reviewId: id }
      })

      return NextResponse.json({ 
        isLiked: true,
        likesCount 
      })
    }
  } catch (error) {
    console.error('Like toggle error:', error)
    return NextResponse.json({ error: 'Failed to toggle like' }, { status: 500 })
  }
}

