import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // 1. Basic Counts
    const [
        totalLocations,
        pendingRequests,
        pendingReports,
        todayReviews,
        todayActiveUsers
    ] = await Promise.all([
        prisma.location.count(),
        prisma.facilityRequest.count({ where: { status: 'PENDING' } }),
        prisma.report.count({ where: { status: 'PENDING' } }),
        prisma.review.count({ where: { createdAt: { gte: startOfToday } } }),
        prisma.review.groupBy({
            by: ['userId'],
            where: { createdAt: { gte: startOfToday } },
        }).then((res: { userId: string | null }[]) => res.length) // Distinct users who reviewed today
    ])

    // 2. Trend Data (Last 7 Days) for Reviews & Reports
    // We'll fetch raw data and aggregate in JS for simplicity (or raw SQL for performance)
    const last7DaysReviews = await prisma.review.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true }
    })

    const last7DaysReports = await prisma.report.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true }
    })

    // Aggregate by date
    const trends = []
    for (let i = 6; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        
        const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
        const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)

        trends.push({
            name: dateStr,
            reviews: last7DaysReviews.filter((r: { createdAt: Date }) => r.createdAt >= start && r.createdAt < end).length,
            reports: last7DaysReports.filter((r: { createdAt: Date }) => r.createdAt >= start && r.createdAt < end).length
        })
    }

    return NextResponse.json({
        counts: {
            totalLocations,
            pendingRequests,
            pendingReports,
            todayReviews,
            todayActiveUsers
        },
        trends
    })

  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}

