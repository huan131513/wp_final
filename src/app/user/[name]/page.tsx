'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Crown } from 'lucide-react'
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
                                <div className="mt-2 w-full bg-gray-200 rounded-full h-1 overflow-hidden">
                                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                        <span>進度</span>
                                        <span>{ach.currentVal} / {ach.threshold}</span>
                                    </div>
                                    <div 
                                        className={`h-full rounded-full transition-all duration-500 ${ach.isUnlocked ? 'bg-yellow-400' : 'bg-gray-400'}`}
                                        style={{ width: `${ach.progress}%` }}
                                    />
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

