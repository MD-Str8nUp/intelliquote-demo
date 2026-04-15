'use client'

import React, { useState } from 'react'
import { useAppContext, Quote } from './context'
import { QuoteStatusBadge } from './dashboard'

export function QuoteHistory() {
  const { quotes, setCurrentQuote, setCurrentPage } = useAppContext()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<Quote['status'] | 'all'>('all')

  const filtered = quotes.filter(q => {
    const matchesSearch = !searchQuery || q.projectName.toLowerCase().includes(searchQuery.toLowerCase()) || q.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || q.address.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || q.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Quote History</h1>
          <p className="text-slate-500 mt-1">View and manage all your quotes</p>
        </div>
        <button onClick={() => setCurrentPage('new-quote')} className="px-4 py-2 bg-amber-500 text-slate-900 font-medium text-sm rounded-lg hover:bg-amber-400 transition-colors">
          + New Quote
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input type="search" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by project name, client, or address..." className="w-full px-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as Quote['status'] | 'all')} className="px-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500">
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="exported">Exported</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <h3 className="text-lg font-medium text-slate-900 mb-1">No quotes found</h3>
            <p className="text-slate-500">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(quote => (
              <button key={quote.id} onClick={() => { setCurrentQuote(quote); setCurrentPage('view-quote') }} className="w-full block p-5 hover:bg-slate-50 transition-colors text-left">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-medium text-slate-900 truncate">{quote.projectName}</h3>
                      <QuoteStatusBadge status={quote.status} />
                    </div>
                    <p className="text-sm text-slate-500 truncate">{quote.clientName}</p>
                    <p className="text-sm text-slate-400 truncate">{quote.address}</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-semibold text-slate-900">${quote.totalAmount.toLocaleString()}</p>
                    <p className="text-sm text-slate-500">{quote.createdAt}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
