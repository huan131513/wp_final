import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

// Validation schema for submitting scores
const scoreSchema = z.object({
  gameType: z.enum(['MINESWEEPER', 'GAME_2048', 'SUDOKU', 'WATER_SORT']),
  score: z.number().int(),
  level: z.number().int().optional(), // Optional level for games with levels
})

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const validatedData = scoreSchema.parse(body)

    const gameScore = await prisma.gameScore.create({
      data: {
        userId: session.user.id,
        gameType: validatedData.gameType,
        score: validatedData.score,
        level: validatedData.level,
      },
    })

    return NextResponse.json(gameScore)
  } catch (error) {
    console.error('Failed to submit score:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to submit score' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gameType = searchParams.get('gameType')
  const levelParam = searchParams.get('level')

  if (!gameType || !['MINESWEEPER', 'GAME_2048', 'SUDOKU', 'WATER_SORT'].includes(gameType)) {
    return NextResponse.json({ error: 'Invalid or missing gameType' }, { status: 400 })
  }

  try {
    // Determine sort order based on game type
    // Minesweeper & Water Sort: lower score (moves/time) is better
    // 2048: higher score is better
    const isLowerBetter = gameType === 'MINESWEEPER' || gameType === 'WATER_SORT'
    
    // Parse level if provided
    const level = levelParam ? parseInt(levelParam, 10) : null

    // Build where clause
    const where: any = {
      gameType: gameType as any
    }
    
    // If level is specified, filter by level
    if (level !== null) {
      where.level = level
    }

    // Fetch all scores for this game type (and level if specified)
    const allScores = await prisma.gameScore.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          }
        }
      },
      orderBy: {
        playedAt: 'desc' // Get most recent first, then we'll pick best per user
      }
    })

    // Group by user and keep only the best score for each user
    // If level is specified, all scores are already filtered to that level
    const userBestScores = new Map<string, typeof allScores[0]>()
    
    for (const score of allScores) {
      const userId = score.userId
      const existing = userBestScores.get(userId)
      
      if (!existing) {
        userBestScores.set(userId, score)
      } else {
        // Compare scores: for Minesweeper/Water Sort, lower is better; for others, higher is better
        const isBetter = isLowerBetter 
          ? score.score < existing.score 
          : score.score > existing.score
        
        if (isBetter) {
          userBestScores.set(userId, score)
        }
      }
    }

    // Convert map to array and sort
    const leaderboard = Array.from(userBestScores.values())
      .sort((a, b) => {
        return isLowerBetter 
          ? a.score - b.score  // Ascending for Minesweeper/Water Sort
          : b.score - a.score  // Descending for others
      })
      .slice(0, 10) // Take top 10

    return NextResponse.json(leaderboard)
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error)
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 })
  }
}

