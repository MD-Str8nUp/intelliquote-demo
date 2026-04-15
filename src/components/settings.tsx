'use client'

import React, { useState } from 'react'

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'company' | 'pricing' | 'branding' | 'integrations'>('company')

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">Manage your company profile, pricing, and preferences</p>
      </div>

      <div className="border-b border-slate-200 mb-6">
        <nav className="flex gap-6">
          {([
            { id: 'company', label: 'Company Info' },
            { id: 'pricing', label: 'Price Lists' },
            { id: 'branding', label: 'Branding' },
            { id: 'integrations', label: 'Integrations' },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`pb-3 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === tab.id ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'company' && <CompanySettings />}
      {activeTab === 'pricing' && <PricingSettings />}
      {activeTab === 'branding' && <BrandingSettings />}
      {activeTab === 'integrations' && <IntegrationSettings />}
    </div>
  )
}

function CompanySettings() {
  return (
    <form className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Business Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
            <input type="text" defaultValue="CCC Group" className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ABN</label>
            <input type="text" defaultValue="XX XXX XXX XXX" className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Business Address</label>
            <input type="text" defaultValue="Sydney, NSW 2000" className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
            <input type="tel" defaultValue="0400 000 000" className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input type="email" defaultValue="info@cccgroup.com.au" className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Quote Defaults</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Default Markup (%)</label>
            <input type="number" defaultValue="20" className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quote Validity (days)</label>
            <input type="number" defaultValue="30" className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500" />
          </div>
          <div className="flex items-center">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-4 h-4 text-amber-500 rounded focus:ring-amber-500" />
              <span className="text-sm font-medium text-slate-700">Include GST in quotes</span>
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button" className="px-6 py-2 bg-amber-500 text-slate-900 font-medium rounded-lg hover:bg-amber-400 transition-colors">Save Changes</button>
      </div>
    </form>
  )
}

function PricingSettings() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Price Lists</h2>
          <button className="px-4 py-2 bg-amber-500 text-slate-900 font-medium text-sm rounded-lg hover:bg-amber-400 transition-colors">+ Add Item</button>
        </div>
        <div className="text-center py-8">
          <p className="text-slate-500 mb-4">Import your supplier price lists to get accurate material costs.</p>
          <button className="px-4 py-2 border border-slate-200 text-slate-700 font-medium text-sm rounded-lg hover:bg-slate-50 transition-colors">Import from CSV</button>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">AS 1684 Reference Tables</h2>
        <p className="text-slate-500 mb-4">These tables are used to calculate compliant timber specifications.</p>
        <span className="text-green-600 text-sm font-medium">&#10003; Tables loaded (Version 2010)</span>
      </div>
    </div>
  )
}

function BrandingSettings() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Logo</h2>
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 bg-slate-100 rounded-lg flex items-center justify-center">
            <span className="text-2xl font-bold text-slate-400">CCC</span>
          </div>
          <div>
            <button className="px-4 py-2 bg-slate-100 text-slate-700 font-medium text-sm rounded-lg hover:bg-slate-200 transition-colors">Upload Logo</button>
            <p className="text-sm text-slate-500 mt-2">PNG or SVG, max 2MB</p>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Colours</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Primary Colour</label>
            <div className="flex items-center gap-3">
              <input type="color" defaultValue="#f59e0b" className="w-10 h-10 rounded cursor-pointer" />
              <input type="text" defaultValue="#f59e0b" className="flex-1 px-4 py-2 border border-slate-200 rounded-lg font-mono text-sm" readOnly />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Accent Colour</label>
            <div className="flex items-center gap-3">
              <input type="color" defaultValue="#1e293b" className="w-10 h-10 rounded cursor-pointer" />
              <input type="text" defaultValue="#1e293b" className="flex-1 px-4 py-2 border border-slate-200 rounded-lg font-mono text-sm" readOnly />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function IntegrationSettings() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Connected Apps</h2>
      <div className="space-y-4">
        {[
          { name: 'Xero', description: 'Sync quotes and invoices', connected: false },
          { name: 'MYOB', description: 'Export to MYOB AccountRight', connected: false },
          { name: 'Buildxact', description: 'Import/export quotes', connected: false },
        ].map(integration => (
          <div key={integration.name} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-slate-500 text-sm">
                {integration.name.charAt(0)}
              </div>
              <div>
                <p className="font-medium text-slate-900">{integration.name}</p>
                <p className="text-sm text-slate-500">{integration.description}</p>
              </div>
            </div>
            <button className="px-4 py-2 border border-slate-200 text-slate-700 font-medium text-sm rounded-lg hover:bg-slate-50 transition-colors">Connect</button>
          </div>
        ))}
      </div>
    </div>
  )
}
