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
        },
        checkIns: {
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                createdAt: true,
                location: {
                    select: {
                        name: true,
                        type: true
                    }
                }
            }
        }
      }
    })

    if (!user) {
      return new NextResponse('User not found', { status: 404 })
    }

    // Helper to calculate streaks for Public Profile (same logic as Member Profile)
    // Note: Since we order by desc for display, we need to reverse for streak calculation or handle accordingly
    // Sorting asc for streak calc
    const checkInDates = user.checkIns.map(c => new Date(c.createdAt)).sort((a, b) => a.getTime() - b.getTime())
    
    const calculateStreaks = (dates: Date[]) => {
        if (dates.length === 0) return { maxStreak: 0, currentStreak: 0, streakCount7: 0 }

        // Convert to date strings YYYY-MM-DD to ignore time and remove duplicates
        const uniqueDates = Array.from(new Set(dates.map(d => d.toISOString().split('T')[0]))).sort()
        
        let currentStreak = 0
        let maxStreak = 0
        let streakCount7 = 0 
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
                    streakCount7 += Math.floor(tempStreak / 7)
                    tempStreak = 1
                }
            }
            lastDate = currentDate
            maxStreak = Math.max(maxStreak, tempStreak)
        }
        streakCount7 += Math.floor(tempStreak / 7)
        currentStreak = tempStreak
        return { maxStreak, currentStreak, streakCount7 }
    }

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

    const streaks = calculateStreaks(checkInDates)
    const maxDailyCheckIns = calculateMaxDailyCheckIns(checkInDates)

    // Transform achievements to match the structure used in member dashboard
    const allAchievements = await prisma.achievement.findMany()
    
    const processedAchievements = allAchievements.map(ach => {
        const userAch = user.achievements.find(ua => ua.achievementId === ach.id)
        const isUnlocked = !!userAch
        
        let currentVal = 0
        if (ach.criteriaType === 'REVIEW_COUNT') currentVal = user._count.reviews
        else if (ach.criteriaType === 'REPORT_COUNT') currentVal = user._count.reports
        else if (ach.criteriaType === 'REQUEST_COUNT') currentVal = user._count.requests
        else if (ach.criteriaType === 'STREAK_7_DAYS_1') currentVal = streaks.streakCount7
        else if (ach.criteriaType === 'STREAK_7_DAYS_2') currentVal = streaks.streakCount7
        else if (ach.criteriaType === 'STREAK_30_DAYS') currentVal = streaks.maxStreak
        else if (ach.criteriaType === 'DAILY_5_TIMES') currentVal = maxDailyCheckIns

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
        achievements: processedAchievements,
        checkIns: user.checkIns
    }

    return NextResponse.json(publicProfile)
  } catch (error) {
    console.error('Public profile fetch error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
