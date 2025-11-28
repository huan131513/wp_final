import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Get users with their review and report counts
    // In a real app, you might want to cache this or have a separate 'points' field
    const users = await prisma.user.findMany({
        select: {
            name: true,
            avatar: true,
            _count: {
                select: {
                    reviews: true,
                    reports: true,
                    requests: true
                }
            }
        }
    })

    // Calculate points: Review = 10, Report = 20, Request = 50
    const leaderboard = users.map(user => ({
        name: user.name,
        avatar: user.avatar,
        points: (user._count.reviews * 10) + (user._count.reports * 20) + (user._count.requests * 50),
        counts: user._count
    }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 10) // Top 10

    return NextResponse.json(leaderboard)
  } catch (error) {
    console.error(error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

