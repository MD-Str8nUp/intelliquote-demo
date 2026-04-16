'use client'

import React from 'react'
import {
  TrendingUp,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  BarChart3,
  Zap,
  Receipt,
  Users,
  Fuel,
  Wrench,
  Phone,
  Calculator,
  Shield,
} from 'lucide-react'

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtPct(n: number): string {
  return n.toFixed(1) + '%'
}

// ─── Types for demo data ────────────────────────────────────────────────────

interface CostRow {
  label: string
  estimated: number
  actual: number | null
  inProgress?: boolean
}

interface ProjectCard {
  name: string
  status: 'completed' | 'in-progress' | 'loss'
  rows: CostRow[]
  quoteToClient: number
  progress?: number
}

// ─── Demo data ──────────────────────────────────────────────────────────────

const projects: ProjectCard[] = [
  {
    name: 'Duplex Build - Bankstown',
    status: 'completed',
    rows: [
      { label: 'Materials', estimated: 28500, actual: 31200 },
      { label: 'Labour', estimated: 22200, actual: 20800 },
      { label: 'Subcontractors', estimated: 4500, actual: 4500 },
      { label: 'Travel', estimated: 1200, actual: 1450 },
    ],
    quoteToClient: 67850,
  },
  {
    name: 'Granny Flat - Punchbowl',
    status: 'in-progress',
    rows: [
      { label: 'Materials', estimated: 12800, actual: 9200, inProgress: true },
      { label: 'Labour', estimated: 8880, actual: 5400, inProgress: true },
      { label: 'Subcontractors', estimated: 2500, actual: 1500, inProgress: true },
    ],
    quoteToClient: 28400,
    progress: 67,
  },
  {
    name: 'Extension - Lakemba',
    status: 'loss',
    rows: [
      { label: 'Materials', estimated: 18000, actual: 22400 },
      { label: 'Labour', estimated: 13320, actual: 16800 },
      { label: 'Subcontractors', estimated: 3200, actual: 3200 },
    ],
    quoteToClient: 42100,
  },
]

interface OverheadRow {
  label: string
  icon: React.ElementType
  monthly: number
}

const overheadRows: OverheadRow[] = [
  { label: 'Employee Super (11.5%)', icon: Users, monthly: 3200 },
  { label: 'Workers Comp', icon: Shield, monthly: 1800 },
  { label: 'Public Liability', icon: Shield, monthly: 450 },
  { label: 'Vehicle/Fuel', icon: Fuel, monthly: 2400 },
  { label: 'Tools & Equipment', icon: Wrench, monthly: 600 },
  { label: 'Accounting/Admin', icon: Calculator, monthly: 500 },
  { label: 'Phone/Software', icon: Phone, monthly: 350 },
]

// ─── Status badge helper ────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ProjectCard['status'] }) {
  const config = {
    'completed': { label: 'Completed', bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle2 },
    'in-progress': { label: 'In Progress', bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock },
    'loss': { label: 'Loss', bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
  }[status]

  const Icon = config.icon

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  )
}

// ─── Project card component ─────────────────────────────────────────────────

function ProjectCardView({ project }: { project: ProjectCard }) {
  const estTotal = project.rows.reduce((s, r) => s + r.estimated, 0)
  const actTotal = project.rows.reduce((s, r) => s + (r.actual || 0), 0)
  const isInProgress = project.status === 'in-progress'

  const estProfit = project.quoteToClient - estTotal
  const actProfit = isInProgress ? null : project.quoteToClient - actTotal
  const estMargin = (estProfit / project.quoteToClient) * 100
  const actMargin = actProfit !== null ? (actProfit / project.quoteToClient) * 100 : null

  const borderColour = {
    'completed': 'border-emerald-200',
    'in-progress': 'border-amber-200',
    'loss': 'border-red-200',
  }[project.status]

  return (
    <div className={`bg-white rounded-xl border-2 ${borderColour} overflow-hidden`}>
      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <h3 className="font-semibold text-slate-900">{project.name}</h3>
        <StatusBadge status={project.status} />
      </div>

      {/* Progress bar for in-progress */}
      {isInProgress && project.progress !== undefined && (
        <div className="px-5 pt-3">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Progress</span>
            <span className="font-medium text-amber-700">{project.progress}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${project.progress}%` }} />
          </div>
        </div>
      )}

      {/* Cost table */}
      <div className="px-5 py-3">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="py-2 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
              <th className="py-2 text-right text-xs font-medium text-slate-500 uppercase">Estimated</th>
              <th className="py-2 text-right text-xs font-medium text-slate-500 uppercase">Actual</th>
              <th className="py-2 text-right text-xs font-medium text-slate-500 uppercase">Variance</th>
            </tr>
          </thead>
          <tbody>
            {project.rows.map(row => {
              const variance = row.actual !== null ? row.estimated - row.actual : null
              const varianceColour = variance === null ? '' : variance > 0 ? 'text-emerald-600' : variance < 0 ? 'text-red-600' : 'text-slate-500'
              return (
                <tr key={row.label} className="border-b border-slate-50">
                  <td className="py-2 text-sm text-slate-700">{row.label}</td>
                  <td className="py-2 text-sm text-right text-slate-600">${fmt(row.estimated)}</td>
                  <td className="py-2 text-sm text-right text-slate-600">
                    ${fmt(row.actual || 0)}
                    {row.inProgress && <span className="text-amber-500 text-xs ml-1">(in progress)</span>}
                  </td>
                  <td className={`py-2 text-sm text-right font-medium ${varianceColour}`}>
                    {row.inProgress ? <span className="text-slate-300">&mdash;</span> : variance !== null ? (variance > 0 ? '+' : '') + '$' + fmt(variance) : ''}
                  </td>
                </tr>
              )
            })}
            {/* Direct cost total */}
            <tr className="border-t-2 border-slate-200">
              <td className="py-2.5 text-sm font-bold text-slate-900">Direct Job Cost</td>
              <td className="py-2.5 text-sm text-right font-bold text-slate-900">${fmt(estTotal)}</td>
              <td className="py-2.5 text-sm text-right font-bold text-slate-900">${fmt(actTotal)}</td>
              <td className={`py-2.5 text-sm text-right font-bold ${isInProgress ? 'text-slate-300' : (estTotal - actTotal) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {isInProgress ? <span>&mdash;</span> : (estTotal - actTotal > 0 ? '+' : '') + '$' + fmt(estTotal - actTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Profit footer */}
      <div className="px-5 py-4 bg-slate-50 border-t border-slate-100">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-slate-600">Quote to Client</span>
          <span className="font-semibold text-slate-900">${fmt(project.quoteToClient)}</span>
        </div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-slate-600">Gross Profit</span>
          <div className="text-right">
            <span className="text-slate-500">${fmt(estProfit)} est</span>
            {actProfit !== null && (
              <span className={`ml-2 font-semibold ${actProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                / ${fmt(actProfit)} actual
              </span>
            )}
            {isInProgress && <span className="ml-2 text-amber-500 text-xs">(projected: ${fmt(estProfit)})</span>}
          </div>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Margin</span>
          <div className="text-right">
            <span className="text-slate-500">{fmtPct(estMargin)} est</span>
            {actMargin !== null && (
              <span className={`ml-2 font-semibold ${actMargin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                / {fmtPct(actMargin)} actual
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Finance Page ──────────────────────────────────────────────────────

export function FinancePage() {
  const totalOverheadMonthly = overheadRows.reduce((s, r) => s + r.monthly, 0)
  const jobCount = 3
  const perJobOverhead = Math.round(totalOverheadMonthly / jobCount)

  // Summary stats
  const totalRevenue = 138350
  const totalCosts = 116450
  const netProfit = totalRevenue - totalCosts
  const avgMargin = 15.8

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-slate-900" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Job Profitability Tracker</h1>
            <p className="text-sm text-slate-500">Track costs, margins, and profitability per project</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
          <Zap className="w-3 h-3" />
          Coming Soon
        </span>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500 uppercase">Total Revenue</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">${fmt(totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500 uppercase">Total Costs</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">${fmt(totalCosts)}</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-medium text-slate-500 uppercase">Net Profit</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600">${fmt(netProfit)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500 uppercase">Avg Margin</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{fmtPct(avgMargin)}</p>
        </div>
      </div>

      {/* Project Cards */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Active & Recent Projects</h2>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {projects.map(project => (
            <ProjectCardView key={project.name} project={project} />
          ))}
        </div>
      </div>

      {/* Overhead Allocation */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Monthly Overhead Allocation</h2>
          <span className="text-xs text-slate-500">Distributed across {jobCount} active jobs</span>
        </div>
        <div className="p-5">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="py-2 text-left text-xs font-medium text-slate-500 uppercase">Overhead Item</th>
                <th className="py-2 text-right text-xs font-medium text-slate-500 uppercase">Monthly</th>
                <th className="py-2 text-right text-xs font-medium text-slate-500 uppercase">Per Job ({jobCount} jobs)</th>
              </tr>
            </thead>
            <tbody>
              {overheadRows.map(row => {
                const Icon = row.icon
                return (
                  <tr key={row.label} className="border-b border-slate-50">
                    <td className="py-2.5 text-sm text-slate-700 flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-slate-400" />
                      {row.label}
                    </td>
                    <td className="py-2.5 text-sm text-right text-slate-600">${fmt(row.monthly)}</td>
                    <td className="py-2.5 text-sm text-right text-slate-600">${fmt(Math.round(row.monthly / jobCount))}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300">
                <td className="py-3 text-sm font-bold text-slate-900">Total Overhead</td>
                <td className="py-3 text-sm text-right font-bold text-slate-900">${fmt(totalOverheadMonthly)}</td>
                <td className="py-3 text-sm text-right font-bold text-slate-900">${fmt(perJobOverhead)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Coming Soon overlay banner */}
      <div className="bg-gradient-to-br from-amber-50 to-slate-50 rounded-xl border-2 border-amber-200 p-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-7 h-7 text-amber-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Full Job Costing & Profitability Tracking</h3>
          <p className="text-slate-600 mb-6">Coming in the next release</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-lg mx-auto">
            {[
              'Real-time cost tracking per job',
              'Xero / MYOB integration',
              'Employee expense management',
              'Tax & super automation',
              'Per-project P&L statements',
              'Variance alerts & notifications',
            ].map(feature => (
              <div key={feature} className="flex items-center gap-2 text-sm text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
