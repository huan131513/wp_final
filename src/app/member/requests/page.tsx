'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Request {
  id: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  adminReply?: string
  createdAt: string
  data: {
    name: string
    type: string
    floor?: string
  }
}

export default function RequestsHistoryPage() {
  const [requests, setRequests] = useState<Request[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const res = await fetch('/api/user/requests')
        if (res.ok) {
          setRequests(await res.json())
        }
      } catch (e) {
        console.error(e)
      } finally {
        setIsLoading(false)
      }
    }
    fetchRequests()
  }, [])

  const getStatusBadge = (status: string) => {
    switch (status) {
        case 'APPROVED': return <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">已通過</span>
        case 'REJECTED': return <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-bold">已拒絕</span>
        default: return <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-bold">審核中</span>
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">我的申請紀錄</h1>
            <Link href="/member" className="text-blue-600 hover:text-blue-800">
                ← 回會員中心
            </Link>
        </div>

        {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : requests.length === 0 ? (
            <div className="text-center py-8 text-gray-500 bg-white rounded-lg shadow">
                尚無申請紀錄
            </div>
        ) : (
            <div className="space-y-4">
                {requests.map(req => (
                    <div key={req.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-lg text-gray-900">{req.data.name}</h3>
                                    {getStatusBadge(req.status)}
                                </div>
                                <div className="flex gap-2 mt-1 text-sm text-gray-500">
                                    <span className="bg-gray-100 px-2 py-0.5 rounded">{req.data.type}</span>
                                    {req.data.floor && <span>{req.data.floor}</span>}
                                </div>
                            </div>
                            <div className="text-sm text-gray-400">
                                {new Date(req.createdAt).toLocaleDateString()}
                            </div>
                        </div>
                        {req.adminReply && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                                <p className="text-sm font-bold text-gray-900 mb-1">管理員回覆：</p>
                                <p className="text-gray-600 text-sm bg-blue-50 p-3 rounded border border-blue-100">
                                    {req.adminReply}
                                </p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  )
}
