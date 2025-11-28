import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params
    // Decode the name because it might be URL encoded
    const decodedName = decodeURIComponent(name)

    const user = await prisma.user.findUnique({
      where: { name: decodedName },
      select: {
        id: true,
        name: true,
        bio: true,
        avatar: true,
        createdAt: true,
        _count: {
          select: {
            reviews: true,
            reports: true,
            requests: true
          }
        },
        achievements: {
            where: {
                // Only return unlocked achievements for public view if desired, 
                // or return all and let frontend filter. 
                // Let's return all but mark unlocked ones.
                // Actually, UserAchievement is the join table. 
                // So we need to fetch UserAchievement specifically.
            },
            include: {
                achievement: true
            }
        }
      }
    })

    if (!user) {
      return new NextResponse('User not found', { status: 404 })
    }

    // Transform achievements to match the structure used in member dashboard
    const allAchievements = await prisma.achievement.findMany()
    
    const processedAchievements = allAchievements.map(ach => {
        const userAch = user.achievements.find(ua => ua.achievementId === ach.id)
        const isUnlocked = !!userAch
        
        let currentVal = 0
        if (ach.criteriaType === 'REVIEW_COUNT') currentVal = user._count.reviews
        else if (ach.criteriaType === 'REPORT_COUNT') currentVal = user._count.reports
        else if (ach.criteriaType === 'REQUEST_COUNT') currentVal = user._count.requests

        const progress = Math.min(100, Math.floor((currentVal / ach.threshold) * 100))

        return {
            ...ach,
            isUnlocked,
            progress,
            currentVal,
            unlockedAt: userAch?.unlockedAt || null
        }
    }).sort((a, b) => {
        if (a.isUnlocked === b.isUnlocked) return a.threshold - b.threshold
        return a.isUnlocked ? -1 : 1
    })

    const publicProfile = {
        name: user.name,
        bio: user.bio,
        avatar: user.avatar,
        joinedAt: user.createdAt,
        stats: user._count,
        achievements: processedAchievements
    }

    return NextResponse.json(publicProfile)
  } catch (error) {
    console.error('Public profile fetch error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

