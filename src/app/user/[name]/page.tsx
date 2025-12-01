'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Crown, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

interface AchievementDisplay {
    id: string
    name: string
    description: string
    icon: string
    criteriaType: string
    threshold: number
    isUnlocked: boolean
    progress: number
    currentVal: number
    unlockedAt: string | null
}

interface CheckIn {
    id: string
    location: {
        name: string
        type: string
    }
    createdAt: string
}

interface PublicProfile {
  name: string
  bio?: string
  avatar?: string
  joinedAt: string
  stats: {
    reviews: number
    reports: number
    requests: number
  }
  achievements: AchievementDisplay[]
  checkIns: CheckIn[]
}

export default function PublicProfilePage() {
  const params = useParams()
  const router = useRouter()
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchProfile = async () => {
        if (!params.name) return
        
        try {
            // Decode the name from URL
            const decodedName = decodeURIComponent(params.name as string)
            const res = await fetch(`/api/users/${encodeURIComponent(decodedName)}`)
            
            if (res.ok) {
                setProfile(await res.json())
            } else {
                toast.error('找不到該使用者')
                router.push('/')
            }
        } catch (error) {
            console.error(error)
            toast.error('載入失敗')
        } finally {
            setIsLoading(false)
        }
    }

    fetchProfile()
  }, [params.name, router])

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500 bg-gray-50">Loading...</div>
  }

  if (!profile) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500 bg-gray-50">User not found</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header & Profile Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
            <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-gradient-to-br from-gray-500 to-gray-700 rounded-full flex items-center justify-center shadow-md overflow-hidden">
                    {profile.avatar && profile.avatar.startsWith('data:image') ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-3xl text-white font-bold">{profile.avatar || profile.name.charAt(0).toUpperCase()}</span>
                    )}
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold text-gray-900">{profile.name}</h1>
                        <span className="text-xs font-bold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                            LV. {Math.floor((profile.stats.reviews * 10 + profile.stats.reports * 20 + profile.stats.requests * 50) / 100) + 1}
                        </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{profile.bio || '這傢伙很懶，什麼都沒寫...'}</p>
                    <p className="text-xs text-gray-400 mt-2">
                        加入於 {new Date(profile.joinedAt).toLocaleDateString()}
                    </p>
                </div>
            </div>
            
            <div className="flex items-center gap-4 self-end md:self-auto">
                <Link href="/" className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                    ← 回地圖
                </Link>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Stats */}
            <div className="lg:col-span-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatCard label="已發表評論" value={profile.stats.reviews} icon="📝" />
                    <StatCard label="已回報問題" value={profile.stats.reports} icon="📢" />
                    <StatCard label="已申請地點" value={profile.stats.requests} icon="📍" />
                </div>
            </div>

            {/* Poop History Calendar */}
            <div className="lg:col-span-3">
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        💩 歷史大便紀錄
                    </h2>
                    <PoopCalendar checkIns={profile.checkIns || []} />
                    
                    <div className="mt-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">最近打卡</h3>
                        {(!profile.checkIns || profile.checkIns.length === 0) ? (
                             <p className="text-gray-500 text-xs">還沒有打卡紀錄。</p>
                        ) : (
                            <div className="space-y-2">
                                {profile.checkIns.slice(0, 5).map(checkIn => (
                                    <div key={checkIn.id} className="flex justify-between items-center text-sm border-b border-gray-100 pb-2">
                                        <span className="font-medium text-gray-800">{checkIn.location.name}</span>
                                        <span className="text-gray-500 text-xs">{new Date(checkIn.createdAt).toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Achievements */}
            <div className="lg:col-span-3">
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Crown className="text-yellow-500" size={20} /> 成就展示
                        <span className="text-sm font-normal text-gray-500 ml-auto">
                            ({profile.achievements.filter(a => a.isUnlocked).length}/{profile.achievements.length})
                        </span>
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        {profile.achievements.map((ach) => (
                            <div 
                                key={ach.id} 
                                className={`relative p-4 rounded-xl border transition-all duration-200 ${ach.isUnlocked ? 'bg-yellow-50/50 border-yellow-200' : 'bg-gray-50 border-dashed opacity-70'}`}
                            >
                                <div className="flex flex-col items-center text-center">
                                    <div className={`text-3xl mb-2 ${!ach.isUnlocked && 'grayscale opacity-50'}`}>{ach.icon}</div>
                                    <h3 className={`font-bold text-sm ${ach.isUnlocked ? 'text-gray-900' : 'text-gray-500'}`}>{ach.name}</h3>
                                    <p className="text-[10px] text-gray-500 mt-1 h-8 flex items-center justify-center">{ach.description}</p>
                                </div>
                                <div className="mt-2 w-full">
                                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                        <span>進度</span>
                                        <span>{ach.currentVal} / {ach.threshold}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-500 ${ach.isUnlocked ? 'bg-yellow-400' : 'bg-gray-400'}`}
                                            style={{ width: `${ach.progress}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string, value: number, icon: string }) {
    return (
        <div className="bg-white p-5 rounded-xl shadow-sm border border-transparent">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
                    <p className="text-2xl font-bold text-gray-900">{value}</p>
                </div>
                <div className="text-2xl opacity-80">{icon}</div>
            </div>
        </div>
    )
}

function PoopCalendar({ checkIns }: { checkIns: CheckIn[] }) {
    const [currentDate, setCurrentDate] = useState(new Date())

    const getDaysInMonth = (year: number, month: number) => {
        return new Date(year, month + 1, 0).getDate()
    }

    const getFirstDayOfMonth = (year: number, month: number) => {
        return new Date(year, month, 1).getDay()
    }

    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    }

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    }

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const daysInMonth = getDaysInMonth(year, month)
    const firstDay = getFirstDayOfMonth(year, month)

    // Create array for grid
    const days = []
    // Add empty slots for previous month
    for (let i = 0; i < firstDay; i++) {
        days.push(null)
    }
    // Add days of current month
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(new Date(year, month, i))
    }

    // Map check-ins
    const counts: Record<string, number> = {}
    checkIns.forEach(c => {
        const d = new Date(c.createdAt)
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
        counts[key] = (counts[key] || 0) + 1
    })

    const getColor = (count: number) => {
        if (count === 0) return 'bg-gray-50 hover:bg-gray-100 text-gray-700'
        if (count === 1) return 'bg-[#D2B48C] text-white font-bold shadow-sm' // Tan
        return 'bg-[#8B4513] text-white font-bold shadow-sm' // SaddleBrown
    }

    return (
        <div className="w-full max-w-md mx-auto bg-white p-2 rounded-xl">
            <div className="flex justify-between items-center mb-4 px-2">
                <button 
                    onClick={handlePrevMonth} 
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600"
                >
                    <ChevronLeft size={20} />
                </button>
                <h3 className="font-bold text-lg text-gray-800">
                    {year} 年 {month + 1} 月
                </h3>
                <button 
                    onClick={handleNextMonth} 
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600"
                >
                    <ChevronRight size={20} />
                </button>
            </div>
            
            <div className="grid grid-cols-7 gap-2 mb-2">
                {['日', '一', '二', '三', '四', '五', '六'].map((d, i) => (
                    <div key={d} className={`text-center text-xs font-medium py-1 ${i === 0 || i === 6 ? 'text-red-400' : 'text-gray-500'}`}>
                        {d}
                    </div>
                ))}
            </div>
            
            <div className="grid grid-cols-7 gap-2">
                {days.map((day, i) => {
                    if (!day) return <div key={`empty-${i}`} />
                    const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`
                    const count = counts[key] || 0
                    const isToday = new Date().toDateString() === day.toDateString()
                    
                    return (
                        <div 
                            key={i}
                            className={`
                                aspect-square flex flex-col items-center justify-center rounded-xl text-sm transition-all relative
                                ${getColor(count)}
                                ${isToday ? 'ring-2 ring-blue-400 ring-offset-2' : ''}
                            `}
                            title={`${day.toLocaleDateString()}: ${count} 次`}
                        >
                            <span>{day.getDate()}</span>
                            {count > 0 && (
                                <div className="flex gap-0.5 mt-0.5">
                                    {Array.from({ length: Math.min(count, 3) }).map((_, idx) => (
                                        <div key={idx} className="w-1 h-1 rounded-full bg-white/70" />
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
            
            <div className="flex items-center justify-end gap-4 mt-6 text-xs text-gray-500 px-2">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-[#D2B48C]"></div> 
                    <span>1 次</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-[#8B4513]"></div> 
                    <span>2 次+</span>
                </div>
            </div>
        </div>
    )
}
