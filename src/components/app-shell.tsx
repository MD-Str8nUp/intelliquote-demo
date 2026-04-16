'use client'

import React from 'react'
import { useAppContext } from './context'
import { Dashboard } from './dashboard'
import { FlowchartWizard } from './flowchart'
import { QuoteGenerator } from './quote-generator'
import { QuoteHistory } from './quote-history'
import { DataUploadPage } from './upload'
import { SettingsPage } from './settings'
import { FinancePage } from './finance'
import {
  LayoutDashboard,
  FilePlus,
  FileStack,
  Upload,
  DollarSign,
  Settings,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Bell,
  Search,
  Zap,
} from 'lucide-react'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'new-quote', label: 'New Quote', icon: FilePlus },
  { id: 'quotes', label: 'Quote History', icon: FileStack },
  { id: 'upload', label: 'Upload Plans', icon: Upload },
  { id: 'price-lists', label: 'Price Lists', icon: DollarSign },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'finance', label: 'Finance', icon: TrendingUp },
]

const pageLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  'new-quote': 'New Quote',
  quotes: 'Quote History',
  upload: 'Upload Plans',
  'price-lists': 'Price Lists',
  settings: 'Settings',
  'view-quote': 'Quote Details',
  finance: 'Finance',
}

export function AppShell() {
  const { currentPage, setCurrentPage, sidebarCollapsed, toggleSidebar, currentQuote, isLoading } = useAppContext()

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full bg-slate-900 text-white transition-all duration-300 ease-in-out z-50 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-700">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-slate-900" />
              </div>
              <span className="font-semibold text-lg">IntelliQuote</span>
            </div>
          )}
          {sidebarCollapsed && (
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center mx-auto">
              <Zap className="w-4 h-4 text-slate-900" />
            </div>
          )}
          <button onClick={toggleSidebar} className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors">
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronLeft className="w-4 h-4 text-slate-400" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="p-2 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = currentPage === item.id
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                  isActive ? 'bg-amber-500 text-slate-900' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                } ${sidebarCollapsed ? 'justify-center' : ''}`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && <span className="text-sm font-medium">{item.label}</span>}
              </button>
            )
          })}
        </nav>

        {/* Current quote indicator */}
        {currentQuote && !sidebarCollapsed && (
          <div className="absolute bottom-20 left-0 right-0 px-4">
            <div className="bg-slate-800 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-1">Working on:</p>
              <p className="text-sm font-medium truncate">{currentQuote.projectName}</p>
              <p className="text-xs text-amber-400 mt-1">
                {currentQuote.items.length} items | ${currentQuote.totalAmount.toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* User area */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center">
                <span className="text-sm text-amber-400 font-semibold">MA</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">Mohamed Ali</p>
                <p className="text-xs text-slate-400 truncate">CCC Group</p>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 mx-auto bg-amber-500/20 rounded-full flex items-center justify-center">
              <span className="text-sm text-amber-400 font-semibold">MA</span>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className={`transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-40">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">IntelliQuote</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-medium">{pageLabels[currentPage] || currentPage}</span>
            {isLoading && <span className="ml-3 text-amber-600 text-xs animate-pulse">Processing...</span>}
          </div>

          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <input type="search" placeholder="Search quotes, clients..." className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 placeholder:text-slate-400" />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <button onClick={() => setCurrentPage('new-quote')} className="px-4 py-2 bg-amber-500 text-slate-900 font-medium text-sm rounded-lg hover:bg-amber-400 transition-colors">
              + New Quote
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          {currentPage === 'dashboard' && <Dashboard />}
          {currentPage === 'new-quote' && <FlowchartWizard />}
          {currentPage === 'quotes' && <QuoteHistory />}
          {currentPage === 'upload' && <DataUploadPage />}
          {currentPage === 'view-quote' && <QuoteGenerator />}
          {currentPage === 'settings' && <SettingsPage />}
          {currentPage === 'price-lists' && <PriceListsPlaceholder />}
          {currentPage === 'finance' && <FinancePage />}
        </main>
      </div>
    </div>
  )
}

function PriceListsPlaceholder() {
  return (
    <div className="max-w-3xl mx-auto text-center py-12">
      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <DollarSign className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-medium text-slate-900 mb-1">Price Lists</h3>
      <p className="text-slate-500 mb-4">Manage your material pricing, supplier rates, and labour costs.</p>
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Coming Soon</span>
    </div>
  )
}
