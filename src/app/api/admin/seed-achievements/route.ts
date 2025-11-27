import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Clear existing achievements to avoid duplicates during dev
    // In production, you might want to use upsert instead
    // await prisma.userAchievement.deleteMany()
    // await prisma.achievement.deleteMany()

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
