'use client'

import React, { useState, useRef } from 'react'
import { useAppContext, Quote } from './context'
import { Pencil, Download, FileText, Ruler, Hammer, Calculator, ClipboardList, Palette, Upload as UploadIcon, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Editable measurement row
function EditableRow({ label, value, unit, onChange }: { label: string; value: number; unit: string; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
      <span className="text-slate-700 font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="any"
          value={value || ''}
          onChange={e => onChange(Number(e.target.value) || 0)}
          className="w-28 px-3 py-1.5 text-right font-semibold border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
        />
        <span className="text-sm text-slate-500 w-10">{unit}</span>
      </div>
    </div>
  )
}

// Editable line item for cutting list / labour
function EditableLineItem({ item, onChange, onRemove }: {
  item: { id: string; description: string; quantity: number; unit: string; unitPrice: number }
  onChange: (updates: Partial<typeof item>) => void
  onRemove: () => void
}) {
  return (
    <tr className="hover:bg-slate-50 group">
      <td className="px-3 py-2">
        <input type="text" value={item.description} onChange={e => onChange({ description: e.target.value })}
          className="w-full px-2 py-1 border border-transparent hover:border-slate-200 focus:border-amber-500 rounded focus:outline-none text-sm" />
      </td>
      <td className="px-3 py-2">
        <input type="number" value={item.quantity || ''} onChange={e => onChange({ quantity: Number(e.target.value) || 0 })}
          className="w-20 px-2 py-1 text-right border border-transparent hover:border-slate-200 focus:border-amber-500 rounded focus:outline-none text-sm" />
      </td>
      <td className="px-3 py-2">
        <input type="text" value={item.unit} onChange={e => onChange({ unit: e.target.value })}
          className="w-14 px-2 py-1 text-center border border-transparent hover:border-slate-200 focus:border-amber-500 rounded focus:outline-none text-sm" />
      </td>
      <td className="px-3 py-2">
        <input type="number" step="0.01" value={item.unitPrice || ''} onChange={e => onChange({ unitPrice: Number(e.target.value) || 0 })}
          className="w-24 px-2 py-1 text-right border border-transparent hover:border-slate-200 focus:border-amber-500 rounded focus:outline-none text-sm" />
      </td>
      <td className="px-3 py-2 text-right font-medium text-sm text-slate-900">
        ${(item.quantity * item.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className="px-2 py-2">
        <button onClick={onRemove} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 text-xs transition-opacity">
          &times;
        </button>
      </td>
    </tr>
  )
}

interface LineItem {
  id: string
  description: string
  quantity: number
  unit: string
  unitPrice: number
}

export function QuoteGenerator() {
  const { currentQuote, setCurrentPage } = useAppContext()
  const [activeTab, setActiveTab] = useState<'measurements' | 'cutting-list' | 'labour' | 'summary' | 'branding'>('measurements')

  // Editable project details
  const [projectName, setProjectName] = useState(currentQuote?.projectName || 'New Project')
  const [clientName, setClientName] = useState(currentQuote?.clientName || 'CCC Group')
  const [address, setAddress] = useState(currentQuote?.address || 'Sydney NSW')
  const [editingDetails, setEditingDetails] = useState(false)

  // Editable measurements (Tab 1)
  const [wallLM, setWallLM] = useState(currentQuote?.metadata?.totalFloorArea ? Math.round((currentQuote.metadata.totalFloorArea) * 0.55) : 0)
  const [floorM2, setFloorM2] = useState(currentQuote?.metadata?.totalFloorArea || 0)
  const [roofM2, setRoofM2] = useState(currentQuote?.metadata?.totalFloorArea ? Math.round((currentQuote.metadata.totalFloorArea) * 1.15) : 0)
  const [steelT, setSteelT] = useState(0)

  // Cutting list items (Tab 2 - for internal use, NOT added to total)
  const [cuttingList, setCuttingList] = useState<LineItem[]>([
    { id: 'cl-1', description: '', quantity: 0, unit: 'LM', unitPrice: 0 },
  ])

  // Labour items (Tab 3)
  const [labourItems, setLabourItems] = useState<LineItem[]>([
    { id: 'lb-1', description: '', quantity: 0, unit: 'HR', unitPrice: 0 },
  ])

  // Branding (Tab 5)
  const [brandCompanyName, setBrandCompanyName] = useState('CCC Group')
  const [brandAbn, setBrandAbn] = useState('')
  const [brandPhone, setBrandPhone] = useState('')
  const [brandEmail, setBrandEmail] = useState('')
  const [brandAddress, setBrandAddress] = useState('')
  const [brandWebsite, setBrandWebsite] = useState('')
  const [brandLogoUrl, setBrandLogoUrl] = useState('')
  const [brandPrimaryColour, setBrandPrimaryColour] = useState('#f59e0b')
  const [brandTagline, setBrandTagline] = useState('Quality Carpentry Since 2008')

  const addCuttingItem = () => setCuttingList(prev => [...prev, { id: `cl-${Date.now()}`, description: '', quantity: 0, unit: 'LM', unitPrice: 0 }])
  const addLabourItem = () => setLabourItems(prev => [...prev, { id: `lb-${Date.now()}`, description: '', quantity: 0, unit: 'HR', unitPrice: 0 }])

  const updateCuttingItem = (id: string, updates: Partial<LineItem>) => setCuttingList(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
  const updateLabourItem = (id: string, updates: Partial<LineItem>) => setLabourItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))

  const removeCuttingItem = (id: string) => setCuttingList(prev => prev.filter(i => i.id !== id))
  const removeLabourItem = (id: string) => setLabourItems(prev => prev.filter(i => i.id !== id))

  // Summary calculations - ONLY measurements (m2), NOT labour or materials
  const measurementTotal = (floorM2 + roofM2) // This is the m2 based total
  const cuttingListTotal = cuttingList.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0)
  const labourTotal = labourItems.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0)

  // PDF Export
  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>IntelliQuote - ${projectName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; padding: 40px; max-width: 800px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 3px solid ${brandPrimaryColour}; }
          .logo { display: flex; align-items: center; gap: 12px; }
          .logo-icon { width: 40px; height: 40px; background: ${brandPrimaryColour}; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #1e293b; font-weight: bold; font-size: 14px; }
          .logo-text { font-size: 24px; font-weight: 700; color: #1e293b; }
          .logo-sub { font-size: 12px; color: #64748b; }
          .quote-info { text-align: right; font-size: 13px; color: #64748b; }
          .quote-id { font-weight: 600; color: #1e293b; font-size: 14px; }
          .client-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
          .client-box h3 { font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; margin-bottom: 8px; }
          .client-name { font-size: 18px; font-weight: 600; }
          .client-detail { font-size: 13px; color: #64748b; }
          h2 { font-size: 16px; font-weight: 600; margin: 24px 0 12px; padding-bottom: 8px; border-bottom: 2px solid #f1f5f9; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th { text-align: left; font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; padding: 8px 12px; border-bottom: 2px solid #e2e8f0; }
          th.right { text-align: right; }
          td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
          td.right { text-align: right; }
          td.bold { font-weight: 600; }
          .measurement-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
          .m-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
          .m-label { font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; }
          .m-value { font-size: 28px; font-weight: 700; color: #1e293b; }
          .m-unit { font-size: 14px; font-weight: 500; color: #64748b; }
          .summary-box { background: #fffbeb; border: 2px solid ${brandPrimaryColour}; border-radius: 8px; padding: 20px; margin-top: 24px; }
          .summary-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
          .summary-total { display: flex; justify-content: space-between; padding: 12px 0; margin-top: 8px; border-top: 2px solid #1e293b; font-size: 18px; font-weight: 700; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
          .note { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; font-size: 12px; color: #166534; margin-top: 16px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">
            ${brandLogoUrl ? `<img src="${brandLogoUrl}" alt="Logo" style="width: 40px; height: 40px; border-radius: 8px; object-fit: contain;" />` : `<div class="logo-icon">${brandCompanyName.split(' ').map(w => w[0]).join('').substring(0, 3)}</div>`}
            <div>
              <div class="logo-text">${brandCompanyName}</div>
              <div class="logo-sub">${brandTagline}</div>
            </div>
          </div>
          <div class="quote-info">
            <div class="quote-id">${currentQuote?.id || 'DRAFT'}</div>
            <div>${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            <div>Valid for 30 days</div>
          </div>
        </div>

        <div class="client-box">
          <h3>Prepared For</h3>
          <div class="client-name">${clientName}</div>
          <div class="client-detail">${address}</div>
          <div class="client-detail" style="margin-top: 8px; font-weight: 600; color: #1e293b;">${projectName}</div>
        </div>

        <h2>Project Measurements</h2>
        <div class="measurement-grid">
          <div class="m-card">
            <div class="m-label">Walls (Lineal)</div>
            <div class="m-value">${wallLM} <span class="m-unit">LM</span></div>
          </div>
          <div class="m-card">
            <div class="m-label">Floor Area</div>
            <div class="m-value">${floorM2} <span class="m-unit">m&sup2;</span></div>
          </div>
          <div class="m-card">
            <div class="m-label">Roof Area</div>
            <div class="m-value">${roofM2} <span class="m-unit">m&sup2;</span></div>
          </div>
          <div class="m-card">
            <div class="m-label">Steel</div>
            <div class="m-value">${steelT} <span class="m-unit">T</span></div>
          </div>
        </div>

        <div class="summary-box">
          <h2 style="border: none; margin-top: 0; padding-bottom: 12px;">Quote Summary</h2>
          <div class="summary-row">
            <span>Floor Area</span>
            <span>${floorM2} m&sup2;</span>
          </div>
          <div class="summary-row">
            <span>Roof Area</span>
            <span>${roofM2} m&sup2;</span>
          </div>
          <div class="summary-row">
            <span>Total Square Metres</span>
            <span style="font-weight: 600;">${measurementTotal} m&sup2;</span>
          </div>
        </div>

        <div class="note">
          Quote generated by IntelliQuote AI. Measurements extracted from uploaded architectural and structural plans. All figures subject to site verification.
        </div>

        <div class="footer">
          ${brandCompanyName}${brandPhone ? ` | ${brandPhone}` : ''}${brandEmail ? ` | ${brandEmail}` : ''}${brandWebsite ? ` | ${brandWebsite}` : ''}
          ${brandAbn ? `<br/>ABN: ${brandAbn}` : ''}
          <br/><br/>Quote generated by IntelliQuote &mdash; AI-Powered Construction Quoting
        </div>
      </body>
      </html>
    `)
    printWindow.document.close()
    setTimeout(() => printWindow.print(), 500)
  }

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

  const tabs = [
    { id: 'measurements' as const, label: 'Project Measurements', icon: Ruler },
    { id: 'cutting-list' as const, label: 'Cutting List', icon: ClipboardList },
    { id: 'labour' as const, label: 'Labour', icon: Hammer },
    { id: 'summary' as const, label: 'Summary', icon: Calculator },
    { id: 'branding' as const, label: 'Branding', icon: Palette },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {editingDetails ? (
            <div className="space-y-2">
              <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} className="text-2xl font-semibold text-slate-900 border-b-2 border-amber-500 focus:outline-none bg-transparent w-full" />
              <div className="flex gap-3">
                <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} className="text-sm text-slate-500 border-b border-slate-300 focus:outline-none bg-transparent" placeholder="Client name" />
                <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="text-sm text-slate-500 border-b border-slate-300 focus:outline-none bg-transparent flex-1" placeholder="Address" />
              </div>
              <button onClick={() => setEditingDetails(false)} className="text-xs text-amber-600 font-medium">Done editing</button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-slate-900">{projectName}</h1>
              <p className="text-slate-500 mt-1">{clientName} &mdash; {address}</p>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">Draft</span>
          <button onClick={() => setEditingDetails(!editingDetails)} className="px-4 py-2 border border-slate-200 text-slate-700 font-medium text-sm rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2">
            <Pencil className="w-3.5 h-3.5" /> Edit Details
          </button>
          <button onClick={handleExportPDF} className="px-4 py-2 bg-amber-500 text-slate-900 font-medium text-sm rounded-lg hover:bg-amber-400 transition-colors flex items-center gap-2">
            <Download className="w-3.5 h-3.5" /> Export PDF
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200">
          <nav className="flex">
            {tabs.map(tab => {
              const Icon = tab.icon
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-5 py-4 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === tab.id ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Tab 1: Project Measurements */}
          {activeTab === 'measurements' && (
            <div className="max-w-lg">
              <p className="text-sm text-slate-500 mb-4">These are the key measurements extracted from your plans. Edit any value.</p>
              <div className="bg-slate-50 rounded-xl p-5">
                <EditableRow label="Wall Lineal Metres" value={wallLM} unit="LM" onChange={setWallLM} />
                <EditableRow label="Floor Area" value={floorM2} unit="m\u00b2" onChange={setFloorM2} />
                <EditableRow label="Roof Area" value={roofM2} unit="m\u00b2" onChange={setRoofM2} />
                <EditableRow label="Steel Tonnage" value={steelT} unit="T" onChange={setSteelT} />
              </div>
            </div>
          )}

          {/* Tab 2: Cutting List (internal use, not added to total) */}
          {activeTab === 'cutting-list' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-slate-500">Material cutting list for internal use. <span className="font-medium text-amber-600">Not included in quote total.</span></p>
                </div>
                <button onClick={addCuttingItem} className="px-3 py-1.5 bg-amber-500 text-slate-900 font-medium text-xs rounded-lg hover:bg-amber-400 transition-colors">
                  + Add Item
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Description</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">Qty</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase">Unit</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">Rate</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">Total</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuttingList.map(item => (
                      <EditableLineItem key={item.id} item={item} onChange={u => updateCuttingItem(item.id, u)} onRemove={() => removeCuttingItem(item.id)} />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200">
                      <td colSpan={4} className="px-3 py-3 text-right text-sm font-medium text-slate-500">Cutting List Total (not in quote)</td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-400">${cuttingListTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: Labour */}
          {activeTab === 'labour' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-500">Labour line items. Add carpenters, crane hire, etc.</p>
                <button onClick={addLabourItem} className="px-3 py-1.5 bg-amber-500 text-slate-900 font-medium text-xs rounded-lg hover:bg-amber-400 transition-colors">
                  + Add Item
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Description</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">Qty</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase">Unit</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">Rate</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">Total</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {labourItems.map(item => (
                      <EditableLineItem key={item.id} item={item} onChange={u => updateLabourItem(item.id, u)} onRemove={() => removeLabourItem(item.id)} />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200">
                      <td colSpan={4} className="px-3 py-3 text-right text-sm font-medium text-slate-700">Labour Total</td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-900">${labourTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Tab 5: Branding */}
          {activeTab === 'branding' && (
            <div className="max-w-2xl space-y-6">
              <p className="text-sm text-slate-500">Your company details and logo appear on exported PDF quotes.</p>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Company Info</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
                    <input type="text" value={brandCompanyName} onChange={e => setBrandCompanyName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">ABN</label>
                    <input type="text" value={brandAbn} onChange={e => setBrandAbn(e.target.value)} placeholder="XX XXX XXX XXX" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                    <input type="tel" value={brandPhone} onChange={e => setBrandPhone(e.target.value)} placeholder="0400 000 000" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                    <input type="email" value={brandEmail} onChange={e => setBrandEmail(e.target.value)} placeholder="info@company.com.au" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                    <input type="text" value={brandAddress} onChange={e => setBrandAddress(e.target.value)} placeholder="Sydney, NSW" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Website</label>
                    <input type="text" value={brandWebsite} onChange={e => setBrandWebsite(e.target.value)} placeholder="www.company.com.au" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tagline</label>
                  <input type="text" value={brandTagline} onChange={e => setBrandTagline(e.target.value)} placeholder="Quality Carpentry Since 2008" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm" />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Branding</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Logo</label>
                    <LogoUpload logoUrl={brandLogoUrl} onUploaded={setBrandLogoUrl} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Primary Colour</label>
                    <div className="flex items-center gap-3">
                      <input type="color" value={brandPrimaryColour} onChange={e => setBrandPrimaryColour(e.target.value)} className="w-10 h-10 rounded cursor-pointer border border-slate-200" />
                      <input type="text" value={brandPrimaryColour} onChange={e => setBrandPrimaryColour(e.target.value)} className="flex-1 px-3 py-2 border border-slate-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="border border-slate-200 rounded-xl p-5 bg-slate-50">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">PDF Header Preview</p>
                <div className="flex items-center gap-3" style={{ borderBottom: `3px solid ${brandPrimaryColour}`, paddingBottom: 12 }}>
                  {brandLogoUrl ? (
                    <img src={brandLogoUrl} alt="Logo" className="w-10 h-10 rounded-lg object-contain" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: brandPrimaryColour }}>
                      {brandCompanyName.split(' ').map(w => w[0]).join('').substring(0, 3)}
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-slate-900">{brandCompanyName}</p>
                    <p className="text-xs text-slate-500">{brandTagline}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Summary - only square metre figures, NOT labour or materials */}
          {activeTab === 'summary' && (
            <div className="max-w-md ml-auto space-y-4">
              <p className="text-sm text-slate-500 mb-4">Quote summary based on square metre measurements only.</p>

              <div className="flex justify-between py-3">
                <span className="text-slate-600">Floor Area</span>
                <span className="font-medium text-slate-900">{floorM2} m{'\u00b2'}</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-slate-600">Roof Area</span>
                <span className="font-medium text-slate-900">{roofM2} m{'\u00b2'}</span>
              </div>
              <div className="flex justify-between py-3 border-t border-slate-200">
                <span className="text-slate-600">Wall Lineal Metres</span>
                <span className="font-medium text-slate-900">{wallLM} LM</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-slate-600">Steel Tonnage</span>
                <span className="font-medium text-slate-900">{steelT} T</span>
              </div>

              <div className="flex justify-between py-4 border-t-2 border-slate-900 mt-4">
                <span className="text-lg font-semibold text-slate-900">Total Square Metres</span>
                <span className="text-lg font-semibold text-slate-900">{measurementTotal} m{'\u00b2'}</span>
              </div>

              <div className="mt-6 p-4 bg-amber-50 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> This summary shows square metre totals only. Cutting list and labour figures are tracked separately and not included in this total.
                </p>
              </div>

              <div className="mt-4 p-4 bg-slate-50 rounded-lg text-sm text-slate-600">
                <p className="font-medium text-slate-700 mb-2">Breakdown (for reference)</p>
                <div className="flex justify-between py-1">
                  <span>Cutting List Total</span>
                  <span className="text-slate-400">${cuttingListTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} (not in quote)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Labour Total</span>
                  <span className="text-slate-400">${labourTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} (not in quote)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function LogoUpload({ logoUrl, onUploaded }: { logoUrl: string; onUploaded: (url: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const path = `logos/${Date.now()}-${safeName}`

    const { data, error } = await supabase.storage
      .from('intelliquote-branding')
      .upload(path, file, { cacheControl: '3600', upsert: false })

    if (error) {
      console.error('Logo upload error:', error)
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage
      .from('intelliquote-branding')
      .getPublicUrl(data.path)

    onUploaded(urlData.publicUrl)
    setUploading(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        {/* Preview */}
        <div className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50 flex-shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
          ) : (
            <span className="text-slate-400 text-xs text-center">No logo</span>
          )}
        </div>

        <div className="flex-1">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={handleUpload} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="px-3 py-1.5 bg-slate-100 text-slate-700 font-medium text-xs rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1.5"
          >
            {uploading ? <><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</> : <><UploadIcon className="w-3 h-3" /> Upload Logo</>}
          </button>
          <p className="text-xs text-slate-400 mt-1">PNG, JPG, SVG or WebP. Max 2MB.</p>
          {logoUrl && (
            <button onClick={() => onUploaded('')} className="text-xs text-red-500 hover:text-red-600 mt-1">Remove logo</button>
          )}
        </div>
      </div>
    </div>
  )
}
