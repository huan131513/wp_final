import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const currentUserId = session?.user?.id
    // Await params if necessary in newer Next.js versions, but in 13/14 it's usually direct or awaited.
    // In Next.js 15 params is a promise. Assuming stable 14 or so based on file structure.
    // To be safe/future-proof if using Next 15, await it. If 14, it's fine.
    // But "params" is passed as second arg.
    const { id } = await Promise.resolve(params)

    const location = await prisma.location.findUnique({
      where: { id },
      include: {
        reports: {
          where: {
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            },
            status: 'PENDING'
          },
          select: {
            type: true,
            createdAt: true
          }
        },
        reviews: {
          where: {
            parentId: null,
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

    if (!location) {
        return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    // Process location status (same logic as main route)
    let currentStatus = 'CLEAN'
    const reports = location.reports
    const activeIssuesMap = new Map<string, { count: number, lastReportTime: Date }>()
    
    if (reports.length > 0) {
        const priorities: Record<string, number> = {
            'MAINTENANCE': 5,
            'CLOGGED': 4,
            'NO_PAPER': 3,
            'DIRTY': 2,
            'OTHER': 1,
            'CLEAN': 0
        }

        let maxPriority = 0
        
        for (const report of reports) {
            if (report.type !== 'CLEAN') {
                if (!activeIssuesMap.has(report.type)) {
                    activeIssuesMap.set(report.type, { count: 0, lastReportTime: new Date(0) })
                }
                
                const issue = activeIssuesMap.get(report.type)!
                issue.count++
                
                if (new Date(report.createdAt) > issue.lastReportTime) {
                    issue.lastReportTime = new Date(report.createdAt)
                }
            }

            const p = priorities[report.type as string] || 0
            if (p > maxPriority) {
                maxPriority = p
                currentStatus = report.type
            }
        }
    }

    const activeIssues = Array.from(activeIssuesMap.entries()).map(([type, data]) => ({
        type,
        count: data.count,
        lastReportTime: data.lastReportTime
    }))

    const lastReportTime = reports.length > 0 ? reports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].createdAt : null

    const processedLocation = {
        ...location,
        currentStatus,
        activeIssues,
        activeReportsCount: reports.length,
        lastReportTime,
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
            likes: undefined,
            _count: undefined
        }))
    }

    return NextResponse.json(processedLocation)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch location details' }, { status: 500 })
  }
}
