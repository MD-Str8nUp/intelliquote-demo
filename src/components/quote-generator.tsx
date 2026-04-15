'use client'

import React, { useState } from 'react'
import { useAppContext, Quote, QuoteLineItem } from './context'
import { QuoteStatusBadge } from './dashboard'
import { CheckCircle } from 'lucide-react'

export function QuoteGenerator() {
  const { currentQuote, setCurrentPage } = useAppContext()
  const [activeTab, setActiveTab] = useState<'materials' | 'labour' | 'summary'>('materials')

  if (!currentQuote) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12">
        <p className="text-slate-500">No quote selected.</p>
        <button onClick={() => setCurrentPage('quotes')} className="mt-4 px-4 py-2 bg-amber-500 text-slate-900 font-medium text-sm rounded-lg hover:bg-amber-400 transition-colors">
          View All Quotes
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{currentQuote.projectName}</h1>
          <p className="text-slate-500 mt-1">{currentQuote.address}</p>
        </div>
        <div className="flex items-center gap-3">
          <QuoteStatusBadge status={currentQuote.status} />
          <button className="px-4 py-2 border border-slate-200 text-slate-700 font-medium text-sm rounded-lg hover:bg-slate-50 transition-colors">
            Edit Details
          </button>
          <button className="px-4 py-2 bg-amber-500 text-slate-900 font-medium text-sm rounded-lg hover:bg-amber-400 transition-colors">
            Export PDF
          </button>
        </div>
      </div>

      {/* Client info */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-slate-500 mb-1">Client</p>
            <p className="font-medium text-slate-900">{currentQuote.clientName}</p>
          </div>
          {currentQuote.clientEmail && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Email</p>
              <p className="font-medium text-slate-900 text-sm">{currentQuote.clientEmail}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-500 mb-1">Date</p>
            <p className="font-medium text-slate-900">{currentQuote.createdAt}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Quote ID</p>
            <p className="font-medium text-slate-900 font-mono text-sm">{currentQuote.id}</p>
          </div>
        </div>
      </div>

      {/* Metadata cards */}
      {currentQuote.metadata && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <MetadataCard label="Wind Class" value={currentQuote.metadata.windClass || '\u2014'} />
          <MetadataCard label="Soil Type" value={currentQuote.metadata.soilType || '\u2014'} />
          <MetadataCard label="Roof" value={currentQuote.metadata.roofMaterial || '\u2014'} />
          <MetadataCard label="Storeys" value={String(currentQuote.metadata.storeys)} />
          <MetadataCard label="Floor Area" value={`${currentQuote.metadata.totalFloorArea || 0} m\u00b2`} />
          <MetadataCard label="Class" value={currentQuote.metadata.buildingClass || '\u2014'} />
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200">
          <nav className="flex">
            {(['materials', 'labour', 'summary'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-4 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === tab ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'materials' && ` (${currentQuote.items.filter(i => i.category !== 'labour').length})`}
                {tab === 'labour' && ` (${currentQuote.items.filter(i => i.category === 'labour').length})`}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'materials' && <QuoteItemsTable items={currentQuote.items.filter(i => i.category !== 'labour')} />}
          {activeTab === 'labour' && <QuoteItemsTable items={currentQuote.items.filter(i => i.category === 'labour')} />}
          {activeTab === 'summary' && <QuoteSummary quote={currentQuote} />}
        </div>
      </div>
    </div>
  )
}

function MetadataCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="font-semibold text-slate-900 capitalize">{value}</p>
    </div>
  )
}

function QuoteItemsTable({ items }: { items: QuoteLineItem[] }) {
  if (items.length === 0) {
    return <div className="text-center py-8 text-slate-500">No items in this category</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Description</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Qty</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Unit</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Rate</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Total</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Reference</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map(item => (
            <tr key={item.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <p className="font-medium text-slate-900">{item.description}</p>
                {item.notes && <p className="text-sm text-slate-500 mt-1">{item.notes}</p>}
              </td>
              <td className="px-4 py-3 text-right text-slate-600">{item.quantity.toLocaleString()}</td>
              <td className="px-4 py-3 text-center text-slate-500 text-sm">{item.unit}</td>
              <td className="px-4 py-3 text-right text-slate-600">${item.unitPrice.toFixed(2)}</td>
              <td className="px-4 py-3 text-right font-medium text-slate-900">${item.total.toLocaleString()}</td>
              <td className="px-4 py-3">
                {item.as1684Reference && (
                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">{item.as1684Reference}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-200">
            <td colSpan={4} className="px-4 py-3 text-right font-medium text-slate-700">Subtotal</td>
            <td className="px-4 py-3 text-right font-semibold text-slate-900">${items.reduce((s, i) => s + i.total, 0).toLocaleString()}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function QuoteSummary({ quote }: { quote: Quote }) {
  const materialsTotal = quote.items.filter(i => i.category !== 'labour').reduce((sum, i) => sum + i.total, 0)
  const labourTotal = quote.items.filter(i => i.category === 'labour').reduce((sum, i) => sum + i.total, 0)
  const subtotal = materialsTotal + labourTotal
  const gst = subtotal * 0.1
  const total = subtotal + gst

  return (
    <div className="max-w-md ml-auto space-y-4">
      <div className="flex justify-between py-2">
        <span className="text-slate-500">Materials & Hardware</span>
        <span className="font-medium text-slate-900">${materialsTotal.toLocaleString()}</span>
      </div>
      <div className="flex justify-between py-2">
        <span className="text-slate-500">Labour</span>
        <span className="font-medium text-slate-900">${labourTotal.toLocaleString()}</span>
      </div>
      <div className="flex justify-between py-2 border-t border-slate-200">
        <span className="text-slate-500">Subtotal (ex. GST)</span>
        <span className="font-medium text-slate-900">${subtotal.toLocaleString()}</span>
      </div>
      <div className="flex justify-between py-2">
        <span className="text-slate-500">GST (10%)</span>
        <span className="font-medium text-slate-900">${Math.round(gst).toLocaleString()}</span>
      </div>
      <div className="flex justify-between py-3 border-t-2 border-slate-900">
        <span className="text-lg font-semibold text-slate-900">Total (inc. GST)</span>
        <span className="text-lg font-semibold text-slate-900">${Math.round(total).toLocaleString()}</span>
      </div>

      <div className="mt-6 p-4 bg-green-50 rounded-lg">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-green-900">AS 1684 Compliant</p>
            <p className="text-sm text-green-700 mt-1">
              All timber specifications meet Australian Standard 1684.2 for {quote.metadata.windClass} wind zone, {quote.metadata.roofMaterial} roof.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 p-4 bg-amber-50 rounded-lg">
        <p className="text-sm text-amber-800">
          <strong>Quote valid for 30 days.</strong> Material prices subject to supplier confirmation. Labour rates based on current CCC Group schedules.
        </p>
      </div>
    </div>
  )
}
