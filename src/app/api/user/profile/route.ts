import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.name) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { name: session.user.name },
      include: {
        _count: {
          select: {
            reviews: true,
            reports: true,
            requests: true
          }
        },
        achievements: {
          select: {
            achievementId: true,
            unlockedAt: true
          }
        }
      }
    })

    if (!user) {
      return new NextResponse('User not found', { status: 404 })
    }

    // 1. Get all defined achievements
    const allAchievements = await prisma.achievement.findMany()
    
    // 2. Check for new unlocks & Calculate progress
    const processedAchievements = []
    
    for (const ach of allAchievements) {
        // Check if already unlocked
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userAch = user.achievements.find((ua: any) => ua.achievementId === ach.id)
        let isUnlocked = !!userAch
        let progress = 0
        let currentVal = 0

        // Calculate progress based on criteria
        if (ach.criteriaType === 'REVIEW_COUNT') currentVal = user._count.reviews
        else if (ach.criteriaType === 'REPORT_COUNT') currentVal = user._count.reports
        else if (ach.criteriaType === 'REQUEST_COUNT') currentVal = user._count.requests
        
        progress = Math.min(100, Math.floor((currentVal / ach.threshold) * 100))

        // Unlock if criteria met but not yet in DB
        if (!isUnlocked && currentVal >= ach.threshold) {
            await prisma.userAchievement.create({
                data: {
                    userId: user.id,
                    achievementId: ach.id
                }
            })
            isUnlocked = true
            progress = 100
        }

        processedAchievements.push({
            ...ach,
            isUnlocked,
            progress,
            currentVal,
            unlockedAt: userAch?.unlockedAt || (isUnlocked ? new Date() : null)
        })
    }

    // 3. Construct response
    const profileData = {
        ...user,
        achievements: processedAchievements.sort((a, b) => {
            // Sort: Unlocked first, then by threshold
            if (a.isUnlocked === b.isUnlocked) return a.threshold - b.threshold
            return a.isUnlocked ? -1 : 1
        })
    }

    return NextResponse.json(profileData)

  } catch (error) {
    console.error('Profile fetch error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function PATCH(request: Request) {
    const session = await getServerSession(authOptions)

    if (!session?.user?.name) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    try {
        const body = await request.json()
        const { bio, avatar } = body

        const updatedUser = await prisma.user.update({
            where: { name: session.user.name },
            data: {
                bio,
                avatar
            }
        })

        return NextResponse.json(updatedUser)
    } catch (error) {
        console.error('Profile update error:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
