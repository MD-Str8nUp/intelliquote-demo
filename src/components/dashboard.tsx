'use client'

import React from 'react'
import { useAppContext, Quote } from './context'
import { Upload, Edit, Copy, FileInput, TrendingUp, TrendingDown } from 'lucide-react'

export function Dashboard() {
  const { quotes, setCurrentPage, setCurrentQuote } = useAppContext()

  const totalValue = quotes.reduce((sum, q) => sum + q.totalAmount, 0)
  const approvedValue = quotes.filter(q => q.status === 'approved').reduce((sum, q) => sum + q.totalAmount, 0)
  const pendingCount = quotes.filter(q => q.status === 'pending').length
  const winRate = quotes.length > 0 ? Math.round((quotes.filter(q => q.status === 'approved' || q.status === 'exported').length / quotes.length) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Overview of your quoting activity</p>
        </div>
        <button onClick={() => setCurrentPage('new-quote')} className="px-4 py-2 bg-amber-500 text-slate-900 font-medium text-sm rounded-lg hover:bg-amber-400 transition-colors flex items-center gap-2">
          <span>+</span> Start New Quote
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Quotes" value={String(quotes.length)} change="+12%" changeType="positive" period="vs last month" />
        <StatCard title="Approved Value" value={`$${approvedValue.toLocaleString()}`} change="+23%" changeType="positive" period="vs last month" />
        <StatCard title="Pending Review" value={String(pendingCount)} change="" changeType="neutral" period="awaiting client" />
        <StatCard title="Win Rate" value={`${winRate}%`} change="+5%" changeType="positive" period="vs last month" />
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { id: 'upload', title: 'Upload Plans', description: 'Upload PDF plans for automatic extraction', icon: Upload, colour: 'bg-blue-50 text-blue-600', page: 'upload' },
            { id: 'manual', title: 'Manual Quote', description: 'Create a quote without uploading plans', icon: Edit, colour: 'bg-amber-50 text-amber-600', page: 'new-quote' },
            { id: 'template', title: 'From Template', description: 'Start from a saved quote template', icon: Copy, colour: 'bg-purple-50 text-purple-600', page: 'new-quote' },
            { id: 'import', title: 'Import Quote', description: 'Import from CSV or other systems', icon: FileInput, colour: 'bg-green-50 text-green-600', page: 'upload' },
          ].map(action => {
            const Icon = action.icon
            return (
              <button key={action.id} onClick={() => setCurrentPage(action.page)} className="p-4 rounded-lg border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all duration-200 group text-left">
                <div className={`w-10 h-10 rounded-lg ${action.colour} flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-medium text-slate-900 mb-1">{action.title}</h3>
                <p className="text-sm text-slate-500">{action.description}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Recent quotes */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Recent Quotes</h2>
          <button onClick={() => setCurrentPage('quotes')} className="text-sm text-amber-600 hover:text-amber-700 font-medium">View all</button>
        </div>

        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Project</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Client</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Amount</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {quotes.map(quote => (
              <tr key={quote.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => { setCurrentQuote(quote); setCurrentPage('view-quote') }}>
                <td className="px-5 py-4">
                  <p className="font-medium text-slate-900">{quote.projectName}</p>
                  <p className="text-sm text-slate-500">{quote.address}</p>
                </td>
                <td className="px-5 py-4 text-sm text-slate-600">{quote.clientName}</td>
                <td className="px-5 py-4"><QuoteStatusBadge status={quote.status} /></td>
                <td className="px-5 py-4 text-right font-medium text-slate-900">${quote.totalAmount.toLocaleString()}</td>
                <td className="px-5 py-4 text-right text-sm text-slate-500">{quote.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatCard({ title, value, change, changeType, period }: {
  title: string; value: string; change: string; changeType: 'positive' | 'negative' | 'neutral'; period: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <p className="text-sm text-slate-500 mb-1">{title}</p>
      <p className="text-2xl font-semibold text-slate-900 mb-2">{value}</p>
      <div className="flex items-center gap-2 text-xs">
        {change && (
          <span className={`font-medium flex items-center gap-1 ${changeType === 'positive' ? 'text-green-600' : changeType === 'negative' ? 'text-red-600' : 'text-slate-500'}`}>
            {changeType === 'positive' && <TrendingUp className="w-3 h-3" />}
            {changeType === 'negative' && <TrendingDown className="w-3 h-3" />}
            {change}
          </span>
        )}
        <span className="text-slate-400">{period}</span>
      </div>
    </div>
  )
}

export function QuoteStatusBadge({ status }: { status: Quote['status'] }) {
  const styles: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700',
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    exported: 'bg-blue-100 text-blue-700',
    archived: 'bg-slate-100 text-slate-500',
  }
  const labels: Record<string, string> = {
    draft: 'Draft', pending: 'Pending', approved: 'Approved', exported: 'Exported', archived: 'Archived',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}
