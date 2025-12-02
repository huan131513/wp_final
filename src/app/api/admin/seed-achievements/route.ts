import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Clean up old "Poop Bro" levels to ensure only "Poop Bro" exists
    // Deleting by name if they exist. 
    // Note: This will also delete UserAchievement records linked to these achievements due to onDelete: Cascade usually,
    // but Prisma schema might not have cascade set up in schema.prisma explicitly for implicit relations or manual relations.
    // However, assuming we want to remove them.
    
    const oldNames = ['屎哥 LV.1', '屎哥 LV.2', '屎哥 LV.3']
    await prisma.userAchievement.deleteMany({
        where: {
            achievement: {
                name: { in: oldNames }
            }
        }
    })
    await prisma.achievement.deleteMany({
        where: {
            name: { in: oldNames }
        }
    })

    const achievements = [
        // 評論類
        {
            name: '初試啼聲',
            description: '發表您的第 1 則評論',
            icon: '🌱',
            criteriaType: 'REVIEW_COUNT',
            threshold: 1
        },
        {
            name: '專業評論家',
            description: '發表 5 則評論，幫助更多人',
            icon: '✍️',
            criteriaType: 'REVIEW_COUNT',
            threshold: 5
        },
        {
            name: '廁所達人',
            description: '發表 20 則評論，您是這裡的權威！',
            icon: '👑',
            criteriaType: 'REVIEW_COUNT',
            threshold: 20
        },
        // 回報類
        {
            name: '熱心回報者',
            description: '回報 1 個問題，感謝您的貢獻',
            icon: '📢',
            criteriaType: 'REPORT_COUNT',
            threshold: 1
        },
        {
            name: '校園守護者',
            description: '回報 5 個問題，維護校園環境',
            icon: '🛡️',
            criteriaType: 'REPORT_COUNT',
            threshold: 5
        },
        // 申請類
        {
            name: '廁所探勘者',
            description: '成功申請新增 1 個地點',
            icon: '🗺️',
            criteriaType: 'REQUEST_COUNT',
            threshold: 1
        },
        {
            name: '拓荒先鋒',
            description: '成功申請新增 3 個地點',
            icon: '🚩',
            criteriaType: 'REQUEST_COUNT',
            threshold: 3
        },
        // 大便類 - 屎哥 (連擊 7 天)
        {
            name: '屎哥',
            description: '連續拉屎打卡 7 天',
            icon: '💩',
            criteriaType: 'STREAK_7_DAYS',
            threshold: 1
        },
        // 大便類 - 屎帝 (連擊 30 天)
        {
            name: '屎帝',
            description: '連續拉屎打卡 30 天',
            icon: '👑',
            criteriaType: 'STREAK_30_DAYS',
            threshold: 30
        },
        // 大便類 - 兜不住洗 (單日 5 次)
        {
            name: '兜不住洗',
            description: '在一天內打卡 5 次',
            icon: '🚽',
            criteriaType: 'DAILY_5_TIMES',
            threshold: 1
        }
    ]

    for (const ach of achievements) {
        await prisma.achievement.upsert({
            where: { name: ach.name },
            update: ach,
            create: ach
        })
    }

    return NextResponse.json({ message: 'Achievements seeded successfully' })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
