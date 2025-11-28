'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Report {
  id: string
  content: string
  status: 'PENDING' | 'RESOLVED'
  adminReply?: string
  createdAt: string
  location: {
    name: string
    type: string
  }
}

export default function ReportsHistoryPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await fetch('/api/user/reports')
        if (res.ok) {
          setReports(await res.json())
        }
      } catch (e) {
        console.error(e)
      } finally {
        setIsLoading(false)
      }
    }
    fetchReports()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">我的回報紀錄</h1>
            <Link href="/member" className="text-blue-600 hover:text-blue-800">
                ← 回會員中心
            </Link>
        </div>

        {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : reports.length === 0 ? (
            <div className="text-center py-8 text-gray-500 bg-white rounded-lg shadow">
                尚無回報紀錄
            </div>
        ) : (
            <div className="space-y-4">
                {reports.map(report => (
                    <div key={report.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h3 className="font-bold text-lg text-gray-900">{report.location.name}</h3>
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                    {report.location.type}
                                </span>
                            </div>
                            <div className="text-right">
                                <span className={`text-xs px-2 py-1 rounded font-bold ${
                                    report.status === 'RESOLVED' 
                                        ? 'bg-green-100 text-green-800' 
                                        : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                    {report.status === 'RESOLVED' ? '已解決' : '處理中'}
                                </span>
                                <div className="text-xs text-gray-400 mt-1">
                                    {new Date(report.createdAt).toLocaleDateString()}
                                </div>
                            </div>
                        </div>
                        <p className="text-gray-700 bg-gray-50 p-3 rounded mt-2 text-sm">
                            問題描述：{report.content}
                        </p>
                        {report.adminReply && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                                <p className="text-sm font-bold text-gray-900 mb-1">管理員回覆：</p>
                                <p className="text-gray-600 text-sm bg-blue-50 p-3 rounded border border-blue-100">
                                    {report.adminReply}
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
