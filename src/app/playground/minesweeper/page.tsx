'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Bomb, Trophy } from 'lucide-react'
import { toast } from 'react-hot-toast'

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD'

interface Cell {
  row: number
  col: number
  isMine: boolean
  isRevealed: boolean
  isFlagged: boolean
  neighborMines: number
}

const CONFIG = {
  EASY: { rows: 9, cols: 9, mines: 10 },
  MEDIUM: { rows: 16, cols: 16, mines: 40 },
  HARD: { rows: 16, cols: 30, mines: 99 },
}

export default function MinesweeperPage() {
  const { data: session } = useSession()
  const [difficulty, setDifficulty] = useState<Difficulty>('EASY')
  const [board, setBoard] = useState<Cell[][]>([])
  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'WON' | 'LOST'>('IDLE')
  const [minesLeft, setMinesLeft] = useState(0)
  const [timer, setTimer] = useState(0) // Timer in seconds with 2 decimal precision
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [highlightedNeighbors, setHighlightedNeighbors] = useState<string[]>([])
  const [isMobile, setIsMobile] = useState(false)
  
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const touchStartPosRef = useRef<{ r: number, c: number } | null>(null)
  const isLongPressRef = useRef(false)

  // Wrapper for setDifficulty that enforces EASY on mobile
  const handleSetDifficulty = useCallback((newDifficulty: Difficulty) => {
    if (isMobile) {
      // Force EASY on mobile, ignore other difficulties
      setDifficulty('EASY')
    } else {
      setDifficulty(newDifficulty)
    }
  }, [isMobile])

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      // Check if screen width is less than 768px (md breakpoint)
      const isMobileDevice = window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      setIsMobile(isMobileDevice)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Force EASY difficulty on mobile
  useEffect(() => {
    if (isMobile && difficulty !== 'EASY') {
      setDifficulty('EASY')
    }
  }, [isMobile, difficulty])

  // Initialize Board
  const initBoard = useCallback(() => {
    const { rows, cols, mines } = CONFIG[difficulty]
    const newBoard: Cell[][] = []

    // Create empty cells
    for (let r = 0; r < rows; r++) {
      const row: Cell[] = []
      for (let c = 0; c < cols; c++) {
        row.push({
          row: r,
          col: c,
          isMine: false,
          isRevealed: false,
          isFlagged: false,
          neighborMines: 0
        })
      }
      newBoard.push(row)
    }

    // Place mines
    let minesPlaced = 0
    while (minesPlaced < mines) {
      const r = Math.floor(Math.random() * rows)
      const c = Math.floor(Math.random() * cols)
      if (!newBoard[r][c].isMine) {
        newBoard[r][c].isMine = true
        minesPlaced++
      }
    }

    // Calculate neighbors
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!newBoard[r][c].isMine) {
          let count = 0
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue
              const nr = r + dr
              const nc = c + dc
              if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && newBoard[nr][nc].isMine) {
                count++
              }
            }
          }
          newBoard[r][c].neighborMines = count
        }
      }
    }

    setBoard(newBoard)
    setMinesLeft(mines)
    setGameState('IDLE')
    setTimer(0)
    setHighlightedNeighbors([])
    if (timerRef.current) clearInterval(timerRef.current)
  }, [difficulty])

  useEffect(() => {
    initBoard()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
    }
  }, [initBoard])

  useEffect(() => {
    if (gameState === 'PLAYING') {
      timerRef.current = setInterval(() => {
        setTimer(t => Math.round((t + 0.01) * 100) / 100) // Increment by 0.01 and round to 2 decimals
      }, 10) // Update every 10ms (0.01 seconds)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [gameState])

  // Map difficulty to level number
  const getDifficultyLevel = (diff: Difficulty): number => {
    switch (diff) {
      case 'EASY': return 1
      case 'MEDIUM': return 2
      case 'HARD': return 3
      default: return 1
    }
  }

  // Fetch Leaderboard
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const level = getDifficultyLevel(difficulty)
        const res = await fetch(`/api/games/score?gameType=MINESWEEPER&level=${level}`)
        if (res.ok) {
          const data = await res.json()
          setLeaderboard(data)
        }
      } catch (err) {
        console.error(err)
      }
    }
    fetchLeaderboard()
  }, [gameState, difficulty]) // Refresh when game ends or difficulty changes

  const getNeighbors = (r: number, c: number, rows: number, cols: number) => {
    const neighbors = []
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue
            const nr = r + dr
            const nc = c + dc
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                neighbors.push({ r: nr, c: nc })
            }
        }
    }
    return neighbors
  }

  const handleMouseDown = (e: React.MouseEvent, r: number, c: number) => {
    if (e.button !== 0) return // Only left click
    if (gameState === 'WON' || gameState === 'LOST') return
    
    const cell = board[r][c]
    // Chord visual effect: press on revealed number
    if (cell.isRevealed && cell.neighborMines > 0) {
        const { rows, cols } = CONFIG[difficulty]
        const neighbors = getNeighbors(r, c, rows, cols)
        // Highlight unrevealed and non-flagged neighbors
        const toHighlight = neighbors
            .filter(({r, c}) => !board[r][c].isRevealed && !board[r][c].isFlagged)
            .map(({r, c}) => `${r}-${c}`)
        setHighlightedNeighbors(toHighlight)
    }
  }

  const handleMouseUp = (e: React.MouseEvent, r: number, c: number) => {
    if (e.button !== 0) return
    
    // Always clear highlight on mouse up
    setHighlightedNeighbors([])
    
    if (gameState === 'WON' || gameState === 'LOST') return

    const cell = board[r][c]

    // 1. Handle Chord Action
    if (cell.isRevealed && cell.neighborMines > 0) {
        const { rows, cols } = CONFIG[difficulty]
        const neighbors = getNeighbors(r, c, rows, cols)
        
        const flagCount = neighbors.reduce((acc, {r, c}) => acc + (board[r][c].isFlagged ? 1 : 0), 0)
        
        if (flagCount === cell.neighborMines) {
            const newBoard = [...board] // Shallow copy of rows
            // Deep copy cells that we might modify is safer, but here we just mutate.
            // In React strict mode this might be an issue, but typically works if we setBoard new ref.
            // For safety with recursion, let's trust revealCell logic which should be careful.
            
            let hitMine = false
            
            neighbors.forEach(({r, c}) => {
                const target = newBoard[r][c]
                if (!target.isRevealed && !target.isFlagged) {
                    if (target.isMine) {
                        hitMine = true
                        target.isRevealed = true
                    } else {
                        revealCell(newBoard, r, c)
                    }
                }
            })
            
            setBoard(newBoard)
            
            if (hitMine) {
                revealAllMines(newBoard)
                setGameState('LOST')
                toast.error('💩 踩到便便了！')
            } else {
                checkWin(newBoard)
            }
        }
        return
    }

    // 2. Handle Normal Click Action
    // If cell is flagged or already revealed, do nothing (unless chording which is handled above)
    if (cell.isFlagged || cell.isRevealed) return

    if (gameState === 'IDLE') setGameState('PLAYING')

    const newBoard = [...board]
    const target = newBoard[r][c]

    if (target.isMine) {
        revealAllMines(newBoard)
        setBoard(newBoard)
        setGameState('LOST')
        toast.error('💥 踩到地雷了！')
    } else {
        revealCell(newBoard, r, c)
        setBoard(newBoard)
        checkWin(newBoard)
    }
  }

  const handleMouseLeave = () => {
    setHighlightedNeighbors([])
  }

  const handleRightClick = (e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault()
    if (gameState === 'WON' || gameState === 'LOST' || board[r][c].isRevealed) return
    if (gameState === 'IDLE') setGameState('PLAYING')

    const newBoard = [...board]
    const cell = newBoard[r][c]
    
    cell.isFlagged = !cell.isFlagged
    setBoard(newBoard)
    setMinesLeft(prev => cell.isFlagged ? prev - 1 : prev + 1)
  }

  // Touch handlers for mobile long press to flag
  const handleTouchStart = (e: React.TouchEvent, r: number, c: number) => {
    if (gameState === 'WON' || gameState === 'LOST') return
    
    const cell = board[r][c]
    if (cell.isRevealed) return // Can't flag revealed cells
    
    touchStartPosRef.current = { r, c }
    isLongPressRef.current = false
    
    // Prevent default to avoid scrolling/zooming
    e.preventDefault()
    
    // Start long press timer (1 second = 1000ms)
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true
      // Trigger flag action
      if (gameState === 'IDLE') setGameState('PLAYING')
      
      const newBoard = [...board]
      const targetCell = newBoard[r][c]
      
      targetCell.isFlagged = !targetCell.isFlagged
      setBoard(newBoard)
      setMinesLeft(prev => targetCell.isFlagged ? prev - 1 : prev + 1)
      
      // Provide haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50)
      }
    }, 500)
  }

  const handleTouchEnd = (e: React.TouchEvent, r: number, c: number) => {
    // Clear long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    
    // If it was a long press, prevent the normal click action
    if (isLongPressRef.current) {
      isLongPressRef.current = false
      touchStartPosRef.current = null
      e.preventDefault()
      e.stopPropagation()
      return
    }
    
    // Check if touch ended on the same cell (and wasn't a long press)
    if (touchStartPosRef.current && touchStartPosRef.current.r === r && touchStartPosRef.current.c === c) {
      // Normal tap - trigger normal click action
      if (gameState === 'WON' || gameState === 'LOST') {
        touchStartPosRef.current = null
        return
      }
      
      const cell = board[r][c]
      
      // Handle chord action (same as mouse)
      if (cell.isRevealed && cell.neighborMines > 0) {
        const { rows, cols } = CONFIG[difficulty]
        const neighbors = getNeighbors(r, c, rows, cols)
        const flagCount = neighbors.reduce((acc, {r, c}) => acc + (board[r][c].isFlagged ? 1 : 0), 0)
        
        if (flagCount === cell.neighborMines) {
          const newBoard = [...board]
          let hitMine = false
          
          neighbors.forEach(({r, c}) => {
            const target = newBoard[r][c]
            if (!target.isRevealed && !target.isFlagged) {
              if (target.isMine) {
                hitMine = true
                target.isRevealed = true
              } else {
                revealCell(newBoard, r, c)
              }
            }
          })
          
          setBoard(newBoard)
          
          if (hitMine) {
            revealAllMines(newBoard)
            setGameState('LOST')
            toast.error('💩 踩到便便了！')
          } else {
            checkWin(newBoard)
          }
        }
        touchStartPosRef.current = null
        return
      }
      
      // Normal click action
      if (cell.isFlagged || cell.isRevealed) {
        touchStartPosRef.current = null
        return
      }
      
      if (gameState === 'IDLE') setGameState('PLAYING')
      
      const newBoard = [...board]
      const target = newBoard[r][c]
      
      if (target.isMine) {
        revealAllMines(newBoard)
        setBoard(newBoard)
        setGameState('LOST')
        toast.error('💩 踩到便便了！')
      } else {
        revealCell(newBoard, r, c)
        setBoard(newBoard)
        checkWin(newBoard)
      }
    }
    
    touchStartPosRef.current = null
  }

  const handleTouchCancel = () => {
    // Clear long press timer on touch cancel
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    isLongPressRef.current = false
    touchStartPosRef.current = null
  }

  const revealCell = (board: Cell[][], r: number, c: number) => {
    if (r < 0 || r >= board.length || c < 0 || c >= board[0].length || board[r][c].isRevealed || board[r][c].isFlagged) return

    board[r][c].isRevealed = true

    if (board[r][c].neighborMines === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          revealCell(board, r + dr, c + dc)
        }
      }
    }
  }

  const revealAllMines = (board: Cell[][]) => {
    board.forEach(row => {
      row.forEach(cell => {
        if (cell.isMine) cell.isRevealed = true
      })
    })
  }

  const checkWin = async (board: Cell[][]) => {
    const { rows, cols, mines } = CONFIG[difficulty]
    let revealedCount = 0
    board.forEach(row => {
      row.forEach(cell => {
        if (cell.isRevealed) revealedCount++
      })
    })

    if (revealedCount === rows * cols - mines) {
      setGameState('WON')
      toast.success('🎉 恭喜通關！')
      
      // Submit Score
      if (session) {
        try {
          const level = getDifficultyLevel(difficulty)
          const scoreData = {
            gameType: 'MINESWEEPER',
            score: Math.round(timer * 100), // Convert to centiseconds for storage
            level: level
          }
          console.log('Submitting score with level:', scoreData) // Debug log
          
          const response = await fetch('/api/games/score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scoreData)
          })
          
          if (!response.ok) {
            const errorData = await response.json()
            console.error('Score submission error:', errorData)
            throw new Error('Failed to submit score')
          }
          
          const result = await response.json()
          console.log('Score submitted successfully:', result) // Debug log
          toast.success('分數已上傳！')
          
          // Refresh leaderboard after submitting score
          const res = await fetch(`/api/games/score?gameType=MINESWEEPER&level=${level}`)
          if (res.ok) {
            const data = await res.json()
            setLeaderboard(data)
          }
        } catch (err) {
          console.error('Score submission error:', err)
          toast.error('分數上傳失敗')
        }
      }
    }
  }

  const getCellColor = (count: number) => {
    // Classic Minesweeper colors
    const colors: { [key: number]: string } = {
      1: 'text-[#0000FF]', // Blue
      2: 'text-[#008000]', // Green
      3: 'text-[#FF0000]', // Red
      4: 'text-[#000080]', // Dark Blue
      5: 'text-[#800000]', // Maroon
      6: 'text-[#008080]', // Teal
      7: 'text-[#000000]', // Black
      8: 'text-[#808080]', // Gray
    }
    return colors[count] || ''
  }

  const getFaceEmoji = () => {
    if (gameState === 'WON') return '😎'
    if (gameState === 'LOST') return '😵'
    return '😊'
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex flex-col md:flex-row gap-8 max-w-7xl mx-auto" onMouseUp={handleMouseLeave}>
      {/* Game Area */}
      <div className="flex-1 flex flex-col items-center">
        <header className="w-full flex items-center justify-between mb-6">
            <Link href="/playground" className="text-gray-500 hover:text-gray-700">
                ← 回遊樂場
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Bomb className="text-red-500" />
                踩地雷
            </h1>
            <div className="w-[80px]"></div> {/* Spacer */}
        </header>

        <div className="flex flex-col items-center">
            {/* Difficulty Selector - Only show EASY on mobile */}
            {!isMobile ? (
                <div className="flex gap-2 mb-4 bg-white p-1.5 rounded-lg shadow-sm border border-gray-200">
                    {(['EASY', 'MEDIUM', 'HARD'] as Difficulty[]).map(d => (
                        <button
                            key={d}
                            onClick={() => handleSetDifficulty(d)}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                                difficulty === d 
                                ? 'bg-blue-600 text-white shadow-sm' 
                                : 'bg-transparent text-gray-500 hover:bg-gray-100'
                            }`}
                        >
                            {d === 'EASY' ? '簡單' : d === 'MEDIUM' ? '中等' : '困難'}
                        </button>
                    ))}
                </div>
            ) : (
                <div className="mb-4 text-sm text-gray-600 text-center">
                    難度：簡單（手機模式）
                </div>
            )}

            <div 
                className="bg-[#c0c0c0] p-2 shadow-xl border-t-4 border-l-4 border-[#ffffff] border-b-4 border-r-4 border-[#808080] w-fit select-none" 
                onMouseLeave={handleMouseLeave}
                onContextMenu={(e) => e.preventDefault()}
            >
                <div className="flex justify-between items-center mb-2 bg-[#c0c0c0] px-2 py-1 border-t-2 border-l-2 border-[#808080] border-b-2 border-r-2 border-[#ffffff]">
                    {/* Mine Counter */}
                    <div className="font-mono text-3xl bg-black text-[#ff0000] px-2 border-t-1 border-l-1 border-[#808080] border-b-1 border-r-1 border-[#ffffff] min-w-[70px] text-center tracking-wider font-bold" style={{ fontFamily: 'Consolas, monospace' }}>
                        {String(minesLeft).padStart(3, '0')}
                    </div>
                    
                    {/* Face Button */}
                    <button 
                        onClick={initBoard}
                        className="bg-[#c0c0c0] w-[40px] h-[40px] flex items-center justify-center text-2xl border-t-3 border-l-3 border-[#ffffff] border-b-3 border-r-3 border-[#808080] active:border-t-[#808080] active:border-l-[#808080] active:border-b-[#ffffff] active:border-r-[#ffffff] focus:outline-none"
                    >
                        {getFaceEmoji()}
                    </button>

                    {/* Timer */}
                    <div className="font-mono text-3xl bg-black text-[#ff0000] px-2 border-t-1 border-l-1 border-[#808080] border-b-1 border-r-1 border-[#ffffff] min-w-[90px] text-center tracking-wider font-bold" style={{ fontFamily: 'Consolas, monospace' }}>
                        {Math.min(timer, 999.99).toFixed(2).padStart(6, '0')}
                    </div>
                </div>

                <div 
                    className="grid bg-[#c0c0c0] border-t-4 border-l-4 border-[#808080] border-b-4 border-r-4 border-[#ffffff]"
                    style={{
                        gridTemplateColumns: `repeat(${CONFIG[difficulty].cols}, 30px)`,
                        gap: '1px',
                        backgroundColor: '#808080'
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                >
                    {board.map((row, r) => (
                        row.map((cell, c) => {
                            const isPressed = highlightedNeighbors.includes(`${r}-${c}`)
                            const showPressedStyle = cell.isRevealed || isPressed

                            return (
                                <div
                                    key={`${r}-${c}`}
                                    onMouseDown={(e) => handleMouseDown(e, r, c)}
                                    onMouseUp={(e) => handleMouseUp(e, r, c)}
                                    onContextMenu={(e) => handleRightClick(e, r, c)}
                                    onTouchStart={(e) => handleTouchStart(e, r, c)}
                                    onTouchEnd={(e) => handleTouchEnd(e, r, c)}
                                    onTouchCancel={handleTouchCancel}
                                    className={`
                                        flex items-center justify-center cursor-pointer leading-none touch-none
                                        ${showPressedStyle
                                            ? cell.isMine && cell.isRevealed
                                                ? 'bg-[#ff0000]'
                                                : 'bg-[#c0c0c0]'
                                            : 'bg-[#c0c0c0] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-[#808080]'
                                        }
                                    `}
                                    style={{ 
                                        width: '30px', 
                                        height: '30px', 
                                        fontSize: '18px', 
                                        fontWeight: 900, 
                                        fontFamily: 'Arial Black, sans-serif',
                                        userSelect: 'none',
                                        WebkitUserSelect: 'none',
                                        WebkitTouchCallout: 'none'
                                    }}
                                >
                                    {cell.isRevealed ? (
                                        cell.isMine ? (
                                            <span style={{ fontSize: '18px' }}>💩</span>
                                        ) : cell.neighborMines > 0 ? (
                                            <span className={getCellColor(cell.neighborMines)}>{cell.neighborMines}</span>
                                        ) : ''
                                    ) : (
                                        !isPressed && cell.isFlagged ? (
                                            <span style={{ fontSize: '18px' }}>🚩</span>
                                        ) : ''
                                    )}
                                </div>
                            )
                        })
                    ))}
                </div>
            </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="w-full md:w-80">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 sticky top-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Trophy className="text-yellow-500" />
                排行榜 - {difficulty === 'EASY' ? '簡單' : difficulty === 'MEDIUM' ? '中等' : '困難'}
            </h2>
            <div className="space-y-3">
                {leaderboard.length === 0 ? (
                    <div className="text-gray-400 text-sm text-center py-4">暫無紀錄，快來挑戰！</div>
                ) : (
                    leaderboard.map((entry, idx) => (
                        <div key={idx} className="flex items-center gap-2 md:gap-3 border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                             <div className={`
                                w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0
                                ${idx === 0 ? 'bg-yellow-400' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-400' : 'bg-blue-100 text-blue-600'}
                            `}>
                                {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                                <div className="font-medium text-sm truncate" title={entry.user.name}>{entry.user.name || '未知用戶'}</div>
                                <div className="text-[10px] text-gray-400 truncate">{new Date(entry.playedAt).toLocaleDateString()}</div>
                            </div>
                            <div className="font-mono font-bold text-gray-900 text-sm flex-shrink-0">
                                {(entry.score / 100).toFixed(2)}s
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
