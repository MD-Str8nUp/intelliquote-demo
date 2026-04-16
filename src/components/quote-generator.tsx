'use client'

import React, { useState, useRef, useCallback } from 'react'
import { useAppContext, Quote, LineItem } from './context'
import { Pencil, Download, FileText, Ruler, Hammer, Calculator, ClipboardList, Palette, Upload as UploadIcon, Loader2, Plus, X, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtInt(n: number): string {
  return n.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

// ─── Editable line item row (shared by cutting list + labour) ───────────────

function EditableLineItem({ item, onChange, onRemove }: {
  item: LineItem
  onChange: (updates: Partial<LineItem>) => void
  onRemove: () => void
}) {
  const lineTotal = item.quantity * item.unitPrice
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
          className="w-16 px-2 py-1 text-center border border-transparent hover:border-slate-200 focus:border-amber-500 rounded focus:outline-none text-sm" />
      </td>
      <td className="px-3 py-2">
        <input type="number" step="0.01" value={item.unitPrice || ''} onChange={e => onChange({ unitPrice: Number(e.target.value) || 0 })}
          className="w-24 px-2 py-1 text-right border border-transparent hover:border-slate-200 focus:border-amber-500 rounded focus:outline-none text-sm" />
      </td>
      <td className="px-3 py-2 text-right font-medium text-sm text-slate-900">
        ${fmt(lineTotal)}
      </td>
      <td className="px-2 py-2">
        <button onClick={onRemove} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity" aria-label="Remove item">
          <X className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  )
}

// ─── Measurement input row with rate and calculated total ───────────────────

function MeasurementRow({ label, value, onValueChange, unit, rate, onRateChange, rateUnit }: {
  label: string
  value: number
  onValueChange: (v: number) => void
  unit: string
  rate: number
  onRateChange: (v: number) => void
  rateUnit: string
}) {
  const total = value * rate
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
      <span className="text-slate-700 font-medium text-sm w-44 flex-shrink-0">{label}</span>
      <div className="flex items-center gap-2 flex-1">
        <input
          type="number"
          step="any"
          value={value || ''}
          onChange={e => onValueChange(Number(e.target.value) || 0)}
          className="w-24 px-3 py-1.5 text-right font-semibold border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm"
        />
        <span className="text-xs text-slate-500 w-8">{unit}</span>
        <span className="text-slate-400 text-xs">x</span>
        <span className="text-slate-500 text-xs">$</span>
        <input
          type="number"
          step="0.01"
          value={rate || ''}
          onChange={e => onRateChange(Number(e.target.value) || 0)}
          className="w-20 px-2 py-1.5 text-right border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm"
        />
        <span className="text-xs text-slate-500 w-12">{rateUnit}</span>
        <span className="text-slate-400 text-xs">=</span>
        <span className="font-semibold text-slate-900 text-sm w-28 text-right">${fmt(total)}</span>
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function QuoteGenerator() {
  const {
    currentQuote, setCurrentQuote, setCurrentPage,
    extractedMeasurements, setExtractedMeasurements,
    cuttingList, setCuttingList,
    labourItems, setLabourItems,
  } = useAppContext()

  const [activeTab, setActiveTab] = useState<'measurements' | 'cutting-list' | 'labour' | 'summary' | 'branding'>('measurements')

  // Editable project details (seeded from currentQuote)
  const [projectName, setProjectName] = useState(currentQuote?.projectName || 'New Project')
  const [clientName, setClientName] = useState(currentQuote?.clientName || 'CCC Group')
  const [address, setAddress] = useState(currentQuote?.address || 'Sydney NSW')
  const [editingDetails, setEditingDetails] = useState(false)

  // Branding state
  const [brandCompanyName, setBrandCompanyName] = useState('CCC Group')
  const [brandAbn, setBrandAbn] = useState('')
  const [brandPhone, setBrandPhone] = useState('')
  const [brandEmail, setBrandEmail] = useState('')
  const [brandAddress, setBrandAddress] = useState('')
  const [brandWebsite, setBrandWebsite] = useState('')
  const [brandLogoUrl, setBrandLogoUrl] = useState('')
  const [brandPrimaryColour, setBrandPrimaryColour] = useState('#f59e0b')
  const [brandTagline, setBrandTagline] = useState('Quality Carpentry Since 2008')

  // ── Shorthand aliases for measurements ──
  const m = extractedMeasurements
  const setM = useCallback((field: string, value: number) => {
    setExtractedMeasurements(prev => {
      const updated = { ...prev, [field]: value }
      // Recompute totals when per-floor values change
      if (field === 'groundFloorWallLM' || field === 'firstFloorWallLM') {
        updated.wallLinealMetres = (field === 'groundFloorWallLM' ? value : prev.groundFloorWallLM) +
          (field === 'firstFloorWallLM' ? value : prev.firstFloorWallLM)
      }
      if (field === 'groundFloorAreaM2' || field === 'firstFloorAreaM2') {
        updated.floorSqMetres = (field === 'groundFloorAreaM2' ? value : prev.groundFloorAreaM2) +
          (field === 'firstFloorAreaM2' ? value : prev.firstFloorAreaM2)
      }
      return updated
    })
  }, [setExtractedMeasurements])

  // ── Calculated totals ──
  const groundWallTotal = m.groundFloorWallLM * m.wallRatePerLM
  const firstWallTotal = m.firstFloorWallLM * m.wallRatePerLM
  const groundFloorTotal = m.groundFloorAreaM2 * m.floorRatePerM2
  const firstFloorTotal = m.firstFloorAreaM2 * m.floorRatePerM2
  const roofTotal = m.roofSqMetres * m.roofRatePerM2
  const steelTotal = m.steelTonnage * m.steelRatePerT
  const measurementsSubtotal = groundWallTotal + firstWallTotal + groundFloorTotal + firstFloorTotal + roofTotal + steelTotal

  const cuttingListTotal = cuttingList.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0)
  const labourTotal = labourItems.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0)

  const subtotalExGST = measurementsSubtotal + labourTotal
  const gst = subtotalExGST * 0.10
  const totalIncGST = subtotalExGST + gst

  // ── List operations ──
  const addCuttingItem = () => setCuttingList(prev => [...prev, { id: `cl-${Date.now()}`, description: '', quantity: 0, unit: 'LM', unitPrice: 0 }])
  const addLabourItem = () => setLabourItems(prev => [...prev, { id: `lb-${Date.now()}`, description: '', quantity: 0, unit: 'HR', unitPrice: 0 }])
  const updateCuttingItem = (id: string, updates: Partial<LineItem>) => setCuttingList(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
  const updateLabourItem = (id: string, updates: Partial<LineItem>) => setLabourItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
  const removeCuttingItem = (id: string) => setCuttingList(prev => prev.filter(i => i.id !== id))
  const removeLabourItem = (id: string) => setLabourItems(prev => prev.filter(i => i.id !== id))

  // ── Save details back to context ──
  const saveDetails = () => {
    if (currentQuote) {
      setCurrentQuote({ ...currentQuote, projectName, clientName, address })
    }
    setEditingDetails(false)
  }

  // ── PDF Export ──
  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    // Build cutting list rows for PDF
    const cuttingRows = cuttingList.filter(i => i.description).map(i =>
      `<tr><td>${i.description}</td><td class="right">${fmtInt(i.quantity)} ${i.unit}</td><td class="right">$${fmt(i.unitPrice)}</td><td class="right bold">$${fmt(i.quantity * i.unitPrice)}</td></tr>`
    ).join('')

    // Build labour rows for PDF
    const labourRows = labourItems.filter(i => i.description).map(i =>
      `<tr><td>${i.description}</td><td class="right">${fmtInt(i.quantity)} ${i.unit}</td><td class="right">$${fmt(i.unitPrice)}</td><td class="right bold">$${fmt(i.quantity * i.unitPrice)}</td></tr>`
    ).join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Quote - ${projectName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; padding: 40px; max-width: 820px; margin: 0 auto; font-size: 13px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid ${brandPrimaryColour}; }
          .logo { display: flex; align-items: center; gap: 12px; }
          .logo-icon { width: 44px; height: 44px; background: ${brandPrimaryColour}; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #1e293b; font-weight: bold; font-size: 15px; }
          .logo-text { font-size: 22px; font-weight: 700; color: #1e293b; }
          .logo-sub { font-size: 12px; color: #64748b; }
          .quote-info { text-align: right; font-size: 12px; color: #64748b; }
          .quote-id { font-weight: 600; color: #1e293b; font-size: 14px; }
          .client-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 28px; }
          .client-box h3 { font-size: 10px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; margin-bottom: 6px; }
          .client-name { font-size: 17px; font-weight: 600; }
          .client-detail { font-size: 12px; color: #64748b; }
          h2 { font-size: 15px; font-weight: 600; margin: 28px 0 12px; padding-bottom: 8px; border-bottom: 2px solid #f1f5f9; }
          .measurement-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 24px; }
          .m-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
          .m-label { font-size: 10px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; margin-bottom: 4px; }
          .m-row { display: flex; justify-content: space-between; align-items: baseline; }
          .m-value { font-size: 22px; font-weight: 700; color: #1e293b; }
          .m-unit { font-size: 13px; font-weight: 500; color: #64748b; }
          .m-total { font-size: 13px; font-weight: 600; color: #1e293b; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
          th { text-align: left; font-size: 10px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; }
          th.right { text-align: right; }
          td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
          td.right { text-align: right; }
          td.bold { font-weight: 600; }
          .summary-box { background: #fffbeb; border: 2px solid ${brandPrimaryColour}; border-radius: 8px; padding: 20px; margin-top: 24px; }
          .summary-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
          .summary-row.sub { font-weight: 600; padding-top: 10px; margin-top: 6px; border-top: 1px solid #e2e8f0; }
          .summary-total { display: flex; justify-content: space-between; padding: 12px 0; margin-top: 8px; border-top: 3px solid #1e293b; font-size: 18px; font-weight: 700; }
          .terms { margin-top: 28px; padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
          .terms h3 { font-size: 11px; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 8px; }
          .terms ul { margin: 0; padding-left: 16px; font-size: 11px; color: #64748b; line-height: 1.7; }
          .ref-note { margin-top: 16px; padding: 10px 14px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; font-size: 11px; color: #0369a1; }
          .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
          @media print {
            body { padding: 20px; }
            .page-break { page-break-before: always; }
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div class="header">
          <div class="logo">
            ${brandLogoUrl ? `<img src="${brandLogoUrl}" alt="Logo" style="width: 44px; height: 44px; border-radius: 8px; object-fit: contain;" />` : `<div class="logo-icon">${brandCompanyName.split(' ').map(w => w[0]).join('').substring(0, 3)}</div>`}
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

        <!-- Client Info -->
        <div class="client-box">
          <h3>Prepared For</h3>
          <div class="client-name">${clientName}</div>
          <div class="client-detail">${address}</div>
          <div class="client-detail" style="margin-top: 8px; font-weight: 600; color: #1e293b;">${projectName}</div>
        </div>

        <!-- Per-Floor Measurement Cards -->
        <h2>Project Measurements</h2>
        <div class="measurement-grid">
          <div class="m-card">
            <div class="m-label">Ground Floor Walls</div>
            <div class="m-row">
              <div><span class="m-value">${fmtInt(m.groundFloorWallLM)}</span> <span class="m-unit">LM</span></div>
              <div class="m-total">$${fmt(groundWallTotal)}</div>
            </div>
          </div>
          <div class="m-card">
            <div class="m-label">First Floor Walls</div>
            <div class="m-row">
              <div><span class="m-value">${fmtInt(m.firstFloorWallLM)}</span> <span class="m-unit">LM</span></div>
              <div class="m-total">$${fmt(firstWallTotal)}</div>
            </div>
          </div>
          <div class="m-card">
            <div class="m-label">Ground Floor Area</div>
            <div class="m-row">
              <div><span class="m-value">${fmtInt(m.groundFloorAreaM2)}</span> <span class="m-unit">m&sup2;</span></div>
              <div class="m-total">$${fmt(groundFloorTotal)}</div>
            </div>
          </div>
          <div class="m-card">
            <div class="m-label">First Floor Area</div>
            <div class="m-row">
              <div><span class="m-value">${fmtInt(m.firstFloorAreaM2)}</span> <span class="m-unit">m&sup2;</span></div>
              <div class="m-total">$${fmt(firstFloorTotal)}</div>
            </div>
          </div>
          <div class="m-card">
            <div class="m-label">Roof Area</div>
            <div class="m-row">
              <div><span class="m-value">${fmtInt(m.roofSqMetres)}</span> <span class="m-unit">m&sup2;</span></div>
              <div class="m-total">$${fmt(roofTotal)}</div>
            </div>
          </div>
          <div class="m-card">
            <div class="m-label">Steel</div>
            <div class="m-row">
              <div><span class="m-value">${fmtInt(m.steelTonnage)}</span> <span class="m-unit">T</span></div>
              <div class="m-total">$${fmt(steelTotal)}</div>
            </div>
          </div>
        </div>

        ${cuttingRows ? `
        <div class="page-break"></div>
        <h2>Cutting List (Internal Reference)</h2>
        <table>
          <thead><tr><th>Description</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th></tr></thead>
          <tbody>${cuttingRows}</tbody>
          <tfoot><tr><td colspan="3" style="text-align:right;font-weight:600;padding-top:10px;">Cutting List Total</td><td class="right bold" style="padding-top:10px;">$${fmt(cuttingListTotal)}</td></tr></tfoot>
        </table>
        ` : ''}

        ${labourRows ? `
        <h2>Labour</h2>
        <table>
          <thead><tr><th>Description</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th></tr></thead>
          <tbody>${labourRows}</tbody>
          <tfoot><tr><td colspan="3" style="text-align:right;font-weight:600;padding-top:10px;">Labour Total</td><td class="right bold" style="padding-top:10px;">$${fmt(labourTotal)}</td></tr></tfoot>
        </table>
        ` : ''}

        <!-- Financial Summary -->
        <div class="summary-box">
          <h2 style="border: none; margin-top: 0; padding-bottom: 10px;">Quote Summary</h2>
          <div class="summary-row"><span>Measurements Subtotal</span><span>$${fmt(measurementsSubtotal)}</span></div>
          <div class="summary-row"><span>Labour</span><span>$${fmt(labourTotal)}</span></div>
          <div class="summary-row sub"><span>Subtotal (ex GST)</span><span>$${fmt(subtotalExGST)}</span></div>
          <div class="summary-row"><span>GST (10%)</span><span>$${fmt(gst)}</span></div>
          <div class="summary-total"><span>TOTAL (inc GST)</span><span>$${fmt(totalIncGST)}</span></div>
        </div>

        ${cuttingListTotal > 0 ? `<div class="ref-note">Cutting list total: $${fmt(cuttingListTotal)} (internal reference only, not included in quote total)</div>` : ''}

        <!-- Terms -->
        <div class="terms">
          <h3>Terms & Conditions</h3>
          <ul>
            <li>Quote valid for 30 days from date of issue</li>
            <li>50% deposit required prior to commencement</li>
            <li>All framing compliant with AS 1684.2</li>
            <li>Variations to be agreed in writing prior to execution</li>
          </ul>
        </div>

        <!-- Footer -->
        <div class="footer">
          ${brandCompanyName}${brandPhone ? ` | ${brandPhone}` : ''}${brandEmail ? ` | ${brandEmail}` : ''}${brandWebsite ? ` | ${brandWebsite}` : ''}
          ${brandAbn ? `<br/>ABN: ${brandAbn}` : ''}
          ${brandAddress ? `<br/>${brandAddress}` : ''}
          <br/><br/>Quote generated by IntelliQuote &mdash; AI-Powered Construction Quoting
        </div>
      </body>
      </html>
    `)
    printWindow.document.close()
    setTimeout(() => printWindow.print(), 500)
  }

  // ── No quote guard ──
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
              <button onClick={saveDetails} className="text-xs text-amber-600 font-medium hover:text-amber-700">Done editing</button>
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

          {/* ════════════════════════════════════════════════════════════════
              TAB 1: PROJECT MEASUREMENTS
              ════════════════════════════════════════════════════════════ */}
          {activeTab === 'measurements' && (
            <div className="space-y-6">
              <p className="text-sm text-slate-500">Measurements extracted from your plans. Edit values and rates to recalculate totals.</p>

              {/* Ground Floor */}
              <div className="bg-slate-50 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-amber-500 rounded-full" />
                  Ground Floor
                </h3>
                <MeasurementRow
                  label="Wall Lineal Metres"
                  value={m.groundFloorWallLM}
                  onValueChange={v => setM('groundFloorWallLM', v)}
                  unit="LM"
                  rate={m.wallRatePerLM}
                  onRateChange={v => setM('wallRatePerLM', v)}
                  rateUnit="$/LM"
                />
                <MeasurementRow
                  label="Floor Area"
                  value={m.groundFloorAreaM2}
                  onValueChange={v => setM('groundFloorAreaM2', v)}
                  unit="m²"
                  rate={m.floorRatePerM2}
                  onRateChange={v => setM('floorRatePerM2', v)}
                  rateUnit="$/m²"
                />
              </div>

              {/* First Floor */}
              <div className="bg-slate-50 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  First Floor
                </h3>
                <MeasurementRow
                  label="Wall Lineal Metres"
                  value={m.firstFloorWallLM}
                  onValueChange={v => setM('firstFloorWallLM', v)}
                  unit="LM"
                  rate={m.wallRatePerLM}
                  onRateChange={v => setM('wallRatePerLM', v)}
                  rateUnit="$/LM"
                />
                <MeasurementRow
                  label="Floor Area"
                  value={m.firstFloorAreaM2}
                  onValueChange={v => setM('firstFloorAreaM2', v)}
                  unit="m²"
                  rate={m.floorRatePerM2}
                  onRateChange={v => setM('floorRatePerM2', v)}
                  rateUnit="$/m²"
                />
              </div>

              {/* Totals row (auto-calculated, read-only) */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-amber-900 uppercase tracking-wider mb-3">Totals (Auto-calculated)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-amber-800">Total Wall LM</span>
                    <span className="font-bold text-amber-900 text-lg">{fmtInt(m.wallLinealMetres)} LM</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-amber-800">Total Floor Area</span>
                    <span className="font-bold text-amber-900 text-lg">{fmtInt(m.floorSqMetres)} m²</span>
                  </div>
                </div>
              </div>

              {/* Roof */}
              <div className="bg-slate-50 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                  Roof
                </h3>
                <MeasurementRow
                  label="Roof Area"
                  value={m.roofSqMetres}
                  onValueChange={v => setM('roofSqMetres', v)}
                  unit="m²"
                  rate={m.roofRatePerM2}
                  onRateChange={v => setM('roofRatePerM2', v)}
                  rateUnit="$/m²"
                />
              </div>

              {/* Steel */}
              <div className="bg-slate-50 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-violet-500 rounded-full" />
                  Steel
                </h3>
                <MeasurementRow
                  label="Steel Tonnage"
                  value={m.steelTonnage}
                  onValueChange={v => setM('steelTonnage', v)}
                  unit="T"
                  rate={m.steelRatePerT}
                  onRateChange={v => setM('steelRatePerT', v)}
                  rateUnit="$/T"
                />
              </div>

              {/* Grand measurement total */}
              <div className="bg-slate-900 text-white rounded-xl p-5 flex justify-between items-center">
                <span className="text-sm font-semibold uppercase tracking-wider">Measurements Grand Total</span>
                <span className="text-2xl font-bold">${fmt(measurementsSubtotal)}</span>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              TAB 2: CUTTING LIST
              ════════════════════════════════════════════════════════════ */}
          {activeTab === 'cutting-list' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <p className="text-sm text-slate-500">Material cutting list for internal use.</p>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                    <AlertTriangle className="w-3 h-3" />
                    Not included in client quote total
                  </span>
                </div>
                <button onClick={addCuttingItem} className="px-3 py-1.5 bg-amber-500 text-slate-900 font-medium text-xs rounded-lg hover:bg-amber-400 transition-colors flex items-center gap-1.5">
                  <Plus className="w-3 h-3" /> Add Item
                </button>
              </div>

              {cuttingList.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No cutting list items yet.</p>
                  <button onClick={addCuttingItem} className="mt-3 text-amber-600 text-sm font-medium hover:text-amber-700">Add your first item</button>
                </div>
              ) : (
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
                        <td colSpan={4} className="px-3 py-3 text-right text-sm font-medium text-slate-500">Cutting List Subtotal (internal only)</td>
                        <td className="px-3 py-3 text-right font-semibold text-slate-400">${fmt(cuttingListTotal)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              TAB 3: LABOUR
              ════════════════════════════════════════════════════════════ */}
          {activeTab === 'labour' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-500">Labour line items. Add carpenters, crane hire, subcontractors, etc.</p>
                <button onClick={addLabourItem} className="px-3 py-1.5 bg-amber-500 text-slate-900 font-medium text-xs rounded-lg hover:bg-amber-400 transition-colors flex items-center gap-1.5">
                  <Plus className="w-3 h-3" /> Add Item
                </button>
              </div>

              {labourItems.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Hammer className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No labour items yet.</p>
                  <button onClick={addLabourItem} className="mt-3 text-amber-600 text-sm font-medium hover:text-amber-700">Add your first item</button>
                </div>
              ) : (
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
                        <td colSpan={4} className="px-3 py-3 text-right text-sm font-medium text-slate-700">Labour Subtotal</td>
                        <td className="px-3 py-3 text-right font-semibold text-slate-900">${fmt(labourTotal)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              TAB 4: SUMMARY
              ════════════════════════════════════════════════════════════ */}
          {activeTab === 'summary' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <p className="text-sm text-slate-500">Professional financial summary. All figures calculated from your measurements and labour items.</p>

              {/* Section 1: Measurement-Based Pricing */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3">Measurement-Based Pricing</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-slate-200">
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Line Item</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">Qty</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">Rate</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-100">
                        <td className="px-3 py-2.5 text-sm text-slate-700">Ground Floor Walls</td>
                        <td className="px-3 py-2.5 text-sm text-right text-slate-600">{fmtInt(m.groundFloorWallLM)} LM</td>
                        <td className="px-3 py-2.5 text-sm text-right text-slate-600">${fmtInt(m.wallRatePerLM)}/LM</td>
                        <td className="px-3 py-2.5 text-sm text-right font-medium text-slate-900">${fmt(groundWallTotal)}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="px-3 py-2.5 text-sm text-slate-700">First Floor Walls</td>
                        <td className="px-3 py-2.5 text-sm text-right text-slate-600">{fmtInt(m.firstFloorWallLM)} LM</td>
                        <td className="px-3 py-2.5 text-sm text-right text-slate-600">${fmtInt(m.wallRatePerLM)}/LM</td>
                        <td className="px-3 py-2.5 text-sm text-right font-medium text-slate-900">${fmt(firstWallTotal)}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="px-3 py-2.5 text-sm text-slate-700">Ground Floor Area</td>
                        <td className="px-3 py-2.5 text-sm text-right text-slate-600">{fmtInt(m.groundFloorAreaM2)} m²</td>
                        <td className="px-3 py-2.5 text-sm text-right text-slate-600">${fmtInt(m.floorRatePerM2)}/m²</td>
                        <td className="px-3 py-2.5 text-sm text-right font-medium text-slate-900">${fmt(groundFloorTotal)}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="px-3 py-2.5 text-sm text-slate-700">First Floor Area</td>
                        <td className="px-3 py-2.5 text-sm text-right text-slate-600">{fmtInt(m.firstFloorAreaM2)} m²</td>
                        <td className="px-3 py-2.5 text-sm text-right text-slate-600">${fmtInt(m.floorRatePerM2)}/m²</td>
                        <td className="px-3 py-2.5 text-sm text-right font-medium text-slate-900">${fmt(firstFloorTotal)}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="px-3 py-2.5 text-sm text-slate-700">Roof Area</td>
                        <td className="px-3 py-2.5 text-sm text-right text-slate-600">{fmtInt(m.roofSqMetres)} m²</td>
                        <td className="px-3 py-2.5 text-sm text-right text-slate-600">${fmtInt(m.roofRatePerM2)}/m²</td>
                        <td className="px-3 py-2.5 text-sm text-right font-medium text-slate-900">${fmt(roofTotal)}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="px-3 py-2.5 text-sm text-slate-700">Steel</td>
                        <td className="px-3 py-2.5 text-sm text-right text-slate-600">{fmtInt(m.steelTonnage)} T</td>
                        <td className="px-3 py-2.5 text-sm text-right text-slate-600">${fmtInt(m.steelRatePerT)}/T</td>
                        <td className="px-3 py-2.5 text-sm text-right font-medium text-slate-900">${fmt(steelTotal)}</td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-300">
                        <td colSpan={3} className="px-3 py-3 text-right text-sm font-bold text-slate-900">Measurements Subtotal</td>
                        <td className="px-3 py-3 text-right font-bold text-slate-900">${fmt(measurementsSubtotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Section 2: Labour */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3">Labour</h3>
                {labourItems.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">No labour items added.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b-2 border-slate-200">
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Item</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">Qty x Rate</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {labourItems.filter(i => i.description).map(item => (
                          <tr key={item.id} className="border-b border-slate-100">
                            <td className="px-3 py-2.5 text-sm text-slate-700">{item.description}</td>
                            <td className="px-3 py-2.5 text-sm text-right text-slate-600">{fmtInt(item.quantity)} {item.unit} x ${fmt(item.unitPrice)}</td>
                            <td className="px-3 py-2.5 text-sm text-right font-medium text-slate-900">${fmt(item.quantity * item.unitPrice)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-300">
                          <td colSpan={2} className="px-3 py-3 text-right text-sm font-bold text-slate-900">Labour Subtotal</td>
                          <td className="px-3 py-3 text-right font-bold text-slate-900">${fmt(labourTotal)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Section 3: Grand Total */}
              <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-6 space-y-3">
                <h3 className="text-sm font-semibold text-amber-900 uppercase tracking-wider mb-4">Grand Total</h3>
                <div className="flex justify-between py-2">
                  <span className="text-slate-700">Measurements</span>
                  <span className="font-medium text-slate-900">${fmt(measurementsSubtotal)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-700">Labour</span>
                  <span className="font-medium text-slate-900">${fmt(labourTotal)}</span>
                </div>
                <div className="flex justify-between py-3 border-t border-amber-300">
                  <span className="font-bold text-slate-900">Subtotal (ex GST)</span>
                  <span className="font-bold text-slate-900">${fmt(subtotalExGST)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-600">GST (10%)</span>
                  <span className="text-slate-600">${fmt(gst)}</span>
                </div>
                <div className="flex justify-between py-4 border-t-2 border-slate-900 mt-2">
                  <span className="text-xl font-bold text-slate-900">TOTAL (inc GST)</span>
                  <span className="text-xl font-bold text-slate-900">${fmt(totalIncGST)}</span>
                </div>
              </div>

              {/* Reference note for cutting list */}
              {cuttingListTotal > 0 && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                  <strong>Reference:</strong> Cutting list total: ${fmt(cuttingListTotal)} (internal reference only, not included in client quote)
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              TAB 5: BRANDING
              ════════════════════════════════════════════════════════════ */}
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
        </div>
      </div>
    </div>
  )
}

// ─── Logo Upload Component ──────────────────────────────────────────────────

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
