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
        reports: { // 新增：獲取過去 24 小時的未解決回報
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
        }
      }
    })

    // 處理評論資料，添加 isLiked 標記
    const processedLocations = locations.map(location => {
      // 計算地點即時狀態
      let currentStatus = 'CLEAN'
      const reports = location.reports
      const activeIssuesMap = new Map<string, { count: number, lastReportTime: Date }>()
      
      if (reports.length > 0) {
        // 定義問題優先級 (數字越大越嚴重)
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
            // 收集並聚合所有非 CLEAN 的問題類型
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

      // 轉換 map 為 activeIssues 陣列
      const activeIssues = Array.from(activeIssuesMap.entries()).map(([type, data]) => ({
        type,
        count: data.count,
        lastReportTime: data.lastReportTime
      }))

      // 找出最新的警示回報時間
      const lastReportTime = reports.length > 0 ? reports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].createdAt : null

      return {
        ...location,
        currentStatus,
        activeIssues,
        activeReportsCount: reports.length,
        lastReportTime
      }
    })

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
