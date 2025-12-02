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
        },
        checkIns: {
            orderBy: { createdAt: 'asc' } // Get all check-ins for streak calculation, sorted asc
        }
      }
    })

    if (!user) {
      return new NextResponse('User not found', { status: 404 })
    }

    // Helper to calculate streaks
    const calculateStreaks = (dates: Date[]) => {
        if (dates.length === 0) return { maxStreak: 0, currentStreak: 0, streakCount7: 0, streakCount30: 0 }

        // Convert to date strings YYYY-MM-DD to ignore time and remove duplicates
        const uniqueDates = Array.from(new Set(dates.map(d => d.toISOString().split('T')[0]))).sort()
        
        let currentStreak = 0
        let maxStreak = 0
        let streakCount7 = 0 // Count of 7-day streaks
        let tempStreak = 0
        
        let lastDate: Date | null = null

        for (const dateStr of uniqueDates) {
            const currentDate = new Date(dateStr)
            
            if (!lastDate) {
                tempStreak = 1
            } else {
                const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime())
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                
                if (diffDays === 1) {
                    tempStreak++
                } else {
                    // Streak broken
                    // Check if previous streak met criteria
                    streakCount7 += Math.floor(tempStreak / 7)
                    tempStreak = 1
                }
            }
            lastDate = currentDate
            maxStreak = Math.max(maxStreak, tempStreak)
        }

        // Add final streak
        streakCount7 += Math.floor(tempStreak / 7)
        currentStreak = tempStreak

        return { maxStreak, currentStreak, streakCount7 }
    }

    // Helper to calculate max daily check-ins
    const calculateMaxDailyCheckIns = (dates: Date[]) => {
        const counts: Record<string, number> = {}
        let maxDaily = 0
        for (const d of dates) {
            const key = d.toISOString().split('T')[0]
            counts[key] = (counts[key] || 0) + 1
            maxDaily = Math.max(maxDaily, counts[key])
        }
        return maxDaily
    }

    const checkInDates = user.checkIns.map(c => new Date(c.createdAt))
    const streaks = calculateStreaks(checkInDates)
    const maxDailyCheckIns = calculateMaxDailyCheckIns(checkInDates)

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
        if (ach.criteriaType === 'REVIEW_COUNT') {
            currentVal = user._count.reviews
        } else if (ach.criteriaType === 'REPORT_COUNT') {
            currentVal = user._count.reports
        } else if (ach.criteriaType === 'REQUEST_COUNT') {
            currentVal = user._count.requests
        } else if (ach.criteriaType === 'STREAK_7_DAYS') {
            currentVal = streaks.streakCount7
        } else if (ach.criteriaType === 'STREAK_30_DAYS') {
            // Use maxStreak directly, threshold is 30
            currentVal = streaks.maxStreak
        } else if (ach.criteriaType === 'DAILY_5_TIMES') {
            currentVal = maxDailyCheckIns
        }
        
        progress = Math.min(100, Math.floor((currentVal / ach.threshold) * 100))

        // Unlock if criteria met but not yet in DB
        let shouldUnlock = false
        if (!isUnlocked) {
             shouldUnlock = currentVal >= ach.threshold
        }

        if (shouldUnlock) {
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
        checkIns: undefined, // Don't send all check-ins in profile, too heavy
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
