'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Grid3x3, RefreshCw, Trophy } from 'lucide-react'
import { toast } from 'react-hot-toast'

// Types
type Board = number[][]
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'

export default function Game2048Page() {
  const { data: session } = useSession()
  const [board, setBoard] = useState<Board>([])
  const [score, setScore] = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [leaderboard, setLeaderboard] = useState<any[]>([])

  // Initialize Game
  const initGame = useCallback(() => {
    const newBoard = Array(4).fill(0).map(() => Array(4).fill(0))
    addRandomTile(newBoard)
    addRandomTile(newBoard)
    setBoard(newBoard)
    setScore(0)
    setGameOver(false)
  }, [])

  useEffect(() => {
    initGame()
  }, [initGame])

  // Fetch Leaderboard
  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/games/score?gameType=GAME_2048')
      if (res.ok) {
        const data = await res.json()
        setLeaderboard(data)
        // Find user's best score locally if needed, but for now just show global
      }
    } catch (err) {
      console.error(err)
    }
  }, [])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  const addRandomTile = (currentBoard: Board) => {
    const emptyCells = []
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (currentBoard[r][c] === 0) emptyCells.push({ r, c })
      }
    }
    if (emptyCells.length === 0) return

    const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)]
    currentBoard[r][c] = Math.random() < 0.9 ? 2 : 4
  }

  const move = useCallback((direction: Direction) => {
    if (gameOver) return

    let newBoard = JSON.parse(JSON.stringify(board))
    let moved = false
    let addedScore = 0

    const rotateBoard = (b: Board) => {
      const rotated = Array(4).fill(0).map(() => Array(4).fill(0))
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          rotated[c][3 - r] = b[r][c]
        }
      }
      return rotated
    }

    // Standardize to LEFT movement
    let rotations = 0
    if (direction === 'UP') rotations = 3
    else if (direction === 'RIGHT') rotations = 2
    else if (direction === 'DOWN') rotations = 1

    for (let i = 0; i < rotations; i++) newBoard = rotateBoard(newBoard)

    // Move logic (Left)
    for (let r = 0; r < 4; r++) {
      let row = newBoard[r].filter((val: number) => val !== 0)
      for (let c = 0; c < row.length - 1; c++) {
        if (row[c] === row[c + 1]) {
          row[c] *= 2
          addedScore += row[c]
          row.splice(c + 1, 1)
        }
      }
      while (row.length < 4) row.push(0)
      if (JSON.stringify(newBoard[r]) !== JSON.stringify(row)) moved = true
      newBoard[r] = row
    }

    // Rotate back
    for (let i = 0; i < (4 - rotations) % 4; i++) newBoard = rotateBoard(newBoard)

    if (moved) {
      addRandomTile(newBoard)
      setBoard(newBoard)
      const newScore = score + addedScore
      setScore(newScore)
      if (newScore > bestScore) setBestScore(newScore)

      // Check Game Over
      if (checkGameOver(newBoard)) {
        setGameOver(true)
        handleGameOver(newScore)
      }
    }
  }, [board, gameOver, score, bestScore])

  const checkGameOver = (currentBoard: Board) => {
    // Check for empty cells
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (currentBoard[r][c] === 0) return false
      }
    }
    // Check for merges
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (c < 3 && currentBoard[r][c] === currentBoard[r][c + 1]) return false
        if (r < 3 && currentBoard[r][c] === currentBoard[r + 1][c]) return false
      }
    }
    return true
  }

  const handleGameOver = async (finalScore: number) => {
    toast('遊戲結束！', { icon: '🎮' })
    if (session) {
      try {
        await fetch('/api/games/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameType: 'GAME_2048',
            score: finalScore
          })
        })
        toast.success('分數已紀錄！')
        fetchLeaderboard() // Refresh leaderboard
      } catch (err) {
        console.error(err)
      }
    }
  }

  // Keyboard Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') move('UP')
      else if (e.key === 'ArrowDown') move('DOWN')
      else if (e.key === 'ArrowLeft') move('LEFT')
      else if (e.key === 'ArrowRight') move('RIGHT')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [move])

  // Touch Controls (Swipe) - Basic implementation
  const touchStart = useRef<{ x: number, y: number } | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return
    const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
    const dx = touchEnd.x - touchStart.current.x
    const dy = touchEnd.y - touchStart.current.y

    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > 30) move(dx > 0 ? 'RIGHT' : 'LEFT')
    } else {
      if (Math.abs(dy) > 30) move(dy > 0 ? 'DOWN' : 'UP')
    }
    touchStart.current = null
  }

  const getTileColor = (value: number) => {
    const colors: { [key: number]: string } = {
      2: 'bg-gray-200 text-gray-700',
      4: 'bg-gray-300 text-gray-700',
      8: 'bg-orange-200 text-white',
      16: 'bg-orange-400 text-white',
      32: 'bg-orange-500 text-white',
      64: 'bg-orange-600 text-white',
      128: 'bg-yellow-400 text-white text-3xl',
      256: 'bg-yellow-500 text-white text-3xl',
      512: 'bg-yellow-600 text-white text-3xl',
      1024: 'bg-yellow-700 text-white text-2xl',
      2048: 'bg-yellow-800 text-white text-2xl',
    }
    return colors[value] || 'bg-black text-white text-xl'
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex flex-col md:flex-row gap-8 max-w-7xl mx-auto">
      {/* Game Area */}
      <div className="flex-1 flex flex-col items-center">
        <header className="w-full flex items-center justify-between mb-6 max-w-[500px]">
            <Link href="/playground" className="text-gray-500 hover:text-gray-700">
                ← 回遊樂場
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Grid3x3 className="text-blue-500" />
                2048
            </h1>
            <div className="w-[80px]"></div> {/* Spacer */}
        </header>

        <div className="max-w-[500px] w-full">
            <div className="flex justify-between items-center mb-6">
                <div className="bg-blue-600 text-white p-3 rounded-lg min-w-[100px] text-center">
                    <div className="text-xs opacity-80 uppercase font-bold">Score</div>
                    <div className="text-xl font-bold">{score}</div>
                </div>
                <button 
                    onClick={initGame}
                    className="bg-gray-800 text-white px-4 py-2 rounded-lg font-bold hover:bg-gray-700 transition-colors flex items-center gap-2"
                >
                    <RefreshCw size={18} /> 新遊戲
                </button>
                <div className="bg-gray-200 text-gray-700 p-3 rounded-lg min-w-[100px] text-center">
                    <div className="text-xs opacity-60 uppercase font-bold">Best</div>
                    <div className="text-xl font-bold">{bestScore}</div>
                </div>
            </div>

            <div 
                className="bg-gray-800 p-3 rounded-xl relative touch-none aspect-square"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                {gameOver && (
                    <div className="absolute inset-0 bg-white/70 z-10 rounded-xl flex flex-col items-center justify-center animate-fade-in">
                        <h2 className="text-4xl font-bold text-gray-800 mb-2">Game Over!</h2>
                        <p className="text-lg text-gray-600 mb-6">Final Score: {score}</p>
                        <button 
                            onClick={initGame}
                            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 shadow-lg"
                        >
                            Try Again
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-4 grid-rows-4 gap-3 h-full">
                    {board.map((row, r) => (
                        row.map((val, c) => (
                            <div 
                                key={`${r}-${c}`}
                                className={`
                                    rounded-lg flex items-center justify-center font-bold text-4xl transition-all duration-100
                                    ${val === 0 ? 'bg-gray-700' : getTileColor(val)}
                                `}
                            >
                                {val > 0 && val}
                            </div>
                        ))
                    ))}
                </div>
            </div>
            
            <p className="text-center text-gray-500 mt-4 text-sm">
                使用方向鍵或滑動螢幕來移動方塊
            </p>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="w-full md:w-80">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 sticky top-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Trophy className="text-yellow-500" />
                排行榜
            </h2>
            <div className="space-y-3">
                {leaderboard.length === 0 ? (
                    <div className="text-gray-400 text-sm text-center py-4">暫無紀錄，快來挑戰！</div>
                ) : (
                    leaderboard.map((entry, idx) => (
                        <div key={idx} className="flex items-center gap-3 border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                             <div className={`
                                w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white
                                ${idx === 0 ? 'bg-yellow-400' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-400' : 'bg-blue-100 text-blue-600'}
                            `}>
                                {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">{entry.user.name}</div>
                                <div className="text-[10px] text-gray-400">{new Date(entry.playedAt).toLocaleDateString()}</div>
                            </div>
                            <div className="font-mono font-bold text-gray-900">
                                {entry.score}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
      </div>
    </div>
  )
}

