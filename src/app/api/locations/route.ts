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
    const session = await getServerSession(authOptions)
    const currentUserId = session?.user?.id

    const locations = await prisma.location.findMany({
      include: {
        reviews: {
          where: {
            parentId: null, // 只獲取頂層評論
            isDeleted: false
          },
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true
              }
            },
            replies: {
              where: {
                isDeleted: false
              },
              orderBy: { createdAt: 'asc' },
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
                    likes: true
                  }
                },
                likes: currentUserId ? {
                  where: {
                    userId: currentUserId
                  },
                  select: {
                    id: true
                  }
                } : false
              }
            },
            _count: {
              select: {
                likes: true,
                replies: true
              }
            },
            likes: currentUserId ? {
              where: {
                userId: currentUserId
              },
              select: {
                id: true
              }
            } : false
          }
        },
        checkIns: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true
              }
            }
          }
        }
      }
    })

    // 處理評論資料，添加 isLiked 標記
    const processedLocations = locations.map(location => ({
      ...location,
      reviews: location.reviews.map((review: any) => ({
        ...review,
        isLiked: review.likes && review.likes.length > 0,
        likesCount: review._count.likes,
        repliesCount: review._count.replies,
        replies: review.replies.map((reply: any) => ({
          ...reply,
          isLiked: reply.likes && reply.likes.length > 0,
          likesCount: reply._count.likes
        })),
        likes: undefined, // 移除原始 likes 陣列
        _count: undefined // 移除 _count
      }))
    }))

    return NextResponse.json(processedLocations)
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
