'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export interface Quote {
  id: string
  projectName: string
  clientName: string
  clientEmail?: string
  clientPhone?: string
  address: string
  createdAt: string
  updatedAt: string
  status: 'draft' | 'pending' | 'approved' | 'exported' | 'archived'
  totalAmount: number
  currency: 'AUD'
  items: QuoteLineItem[]
  metadata: QuoteMetadata
}

export interface QuoteLineItem {
  id: string
  category: 'framing' | 'bracing' | 'hardware' | 'labour' | 'other'
  description: string
  quantity: number
  unit: 'LM' | 'M2' | 'M3' | 'EA' | 'HR' | 'KG'
  unitPrice: number
  total: number
  as1684Reference?: string
  notes?: string
}

export interface QuoteMetadata {
  windClass: string | null
  soilType: string | null
  roofMaterial: string | null
  buildingClass: string | null
  totalFloorArea?: number
  storeys: 1 | 2
  planSource?: string
  extractedAt?: string
}

export interface ExtractedMeasurements {
  groundFloorWallLM: number
  firstFloorWallLM: number
  wallLinealMetres: number  // ground + first (computed)
  groundFloorAreaM2: number
  firstFloorAreaM2: number
  floorSqMetres: number     // ground + first (computed)
  roofSqMetres: number
  steelTonnage: number
  steelPosts: number          // number of steel posts
  // Editable rates
  wallRatePerLM: number      // default 85
  floorRatePerM2: number     // default 95
  roofRatePerM2: number      // default 65
  steelRatePerT: number      // default 3500
  steelPostRate: number      // default 450 per post
}

export interface WizardPreferences {
  studSpacing: number       // 300, 450, 500, 600
  fibroEaves: boolean
  steelBeams: boolean
  travelExpenses: boolean
  windowInstall: boolean
}

export interface LineItem {
  id: string
  description: string
  quantity: number
  unit: string
  unitPrice: number
}

export interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  status: 'uploading' | 'processing' | 'extracted' | 'error'
  progress: number
  extractedData?: {
    walls: number
    openings: number
    pageCount: number
    scale?: string
  }
  error?: string
}

export interface FlowchartStep {
  id: string
  question: string
  description?: string
  type: 'single-select' | 'multi-select' | 'text' | 'number' | 'file-upload'
  options?: { id: string; label: string; value: string; description?: string }[]
  validation?: { required?: boolean; min?: number; max?: number }
}

export interface FlowchartAnswer {
  stepId: string
  value: string | string[] | number
  answeredAt: string
}

interface AppContextType {
  currentPage: string
  setCurrentPage: (page: string) => void
  currentQuote: Quote | null
  setCurrentQuote: (quote: Quote | null) => void
  extractedMeasurements: ExtractedMeasurements
  setExtractedMeasurements: (m: ExtractedMeasurements | ((prev: ExtractedMeasurements) => ExtractedMeasurements)) => void
  quotes: Quote[]
  addQuote: (quote: Quote) => void
  uploadedFiles: UploadedFile[]
  addUploadedFile: (file: UploadedFile) => void
  updateUploadedFile: (id: string, updates: Partial<UploadedFile>) => void
  removeUploadedFile: (id: string) => void
  currentStep: number
  answers: FlowchartAnswer[]
  setCurrentStep: (step: number) => void
  addAnswer: (answer: FlowchartAnswer) => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  wizardPreferences: WizardPreferences
  setWizardPreferences: (prefs: WizardPreferences | ((prev: WizardPreferences) => WizardPreferences)) => void
  wizardPhase: 'wizard' | 'review' | 'generating' | 'done'
  setWizardPhase: (phase: 'wizard' | 'review' | 'generating' | 'done') => void
  cuttingList: LineItem[]
  setCuttingList: (items: LineItem[] | ((prev: LineItem[]) => LineItem[])) => void
  labourItems: LineItem[]
  setLabourItems: (items: LineItem[] | ((prev: LineItem[]) => LineItem[])) => void
  extractionNotes: string
  setExtractionNotes: (notes: string) => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function useAppContext() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useAppContext must be used within AppProvider')
  return context
}

// Default measurements with rates
const DEFAULT_MEASUREMENTS: ExtractedMeasurements = {
  groundFloorWallLM: 0,
  firstFloorWallLM: 0,
  wallLinealMetres: 0,
  groundFloorAreaM2: 0,
  firstFloorAreaM2: 0,
  floorSqMetres: 0,
  roofSqMetres: 0,
  steelTonnage: 0,
  steelPosts: 0,
  wallRatePerLM: 85,
  floorRatePerM2: 95,
  roofRatePerM2: 65,
  steelRatePerT: 3500,
  steelPostRate: 450,
}

const DEFAULT_WIZARD_PREFERENCES: WizardPreferences = {
  studSpacing: 450,
  fibroEaves: false,
  steelBeams: false,
  travelExpenses: false,
  windowInstall: false,
}

// Sample data for demo
const SAMPLE_QUOTES: Quote[] = [
  {
    id: 'quote-001',
    projectName: 'Duplex Build - Bankstown',
    clientName: 'Tony Salameh',
    clientEmail: 'tony@salamehconstruction.com.au',
    address: '42 Chapel Road, Bankstown NSW 2200',
    createdAt: '2026-04-10',
    updatedAt: '2026-04-12',
    status: 'approved',
    totalAmount: 67850,
    currency: 'AUD',
    items: [
      { id: 'i1', category: 'framing', description: '90x35 MGP10 Wall Studs @ 450mm centres', quantity: 420, unit: 'LM', unitPrice: 8.50, total: 3570, as1684Reference: 'Table 8.18 - N2 Wind, Tile Roof' },
      { id: 'i2', category: 'framing', description: '90x45 MGP10 Top/Bottom Plates', quantity: 280, unit: 'LM', unitPrice: 12.00, total: 3360 },
      { id: 'i3', category: 'framing', description: '140x45 MGP12 Lintels', quantity: 48, unit: 'LM', unitPrice: 28.50, total: 1368, as1684Reference: 'Table 7.5 - Lintel Spans' },
      { id: 'i4', category: 'bracing', description: 'Structural Ply Bracing 2400x1200x7mm', quantity: 56, unit: 'EA', unitPrice: 85.00, total: 4760, as1684Reference: 'Table 8.18 - Bracing Requirements' },
      { id: 'i5', category: 'hardware', description: 'Framing Brackets & Connectors Pack', quantity: 1, unit: 'EA', unitPrice: 2450.00, total: 2450 },
      { id: 'i6', category: 'hardware', description: 'Nails, Screws & Fixings Bulk Pack', quantity: 1, unit: 'EA', unitPrice: 1890.00, total: 1890 },
      { id: 'i7', category: 'framing', description: '240x45 MGP12 Floor Joists @ 450mm', quantity: 185, unit: 'LM', unitPrice: 42.00, total: 7770, as1684Reference: 'Table 5.2 - Floor Joist Spans' },
      { id: 'i8', category: 'framing', description: '190x35 MGP10 Ceiling Joists @ 600mm', quantity: 160, unit: 'LM', unitPrice: 24.00, total: 3840, as1684Reference: 'Table 6.1 - Ceiling Joist Spans' },
      { id: 'i9', category: 'framing', description: '190x45 MGP12 Rafters @ 600mm', quantity: 140, unit: 'LM', unitPrice: 32.00, total: 4480, as1684Reference: 'Table 4.3 - Rafter Spans' },
      { id: 'i10', category: 'labour', description: 'Framing Labour - 2 Carpenters + Apprentice', quantity: 120, unit: 'HR', unitPrice: 185.00, total: 22200 },
      { id: 'i11', category: 'labour', description: 'Crane Hire - Frame Lift', quantity: 2, unit: 'EA', unitPrice: 1650.00, total: 3300 },
      { id: 'i12', category: 'other', description: 'Site Setup & Temporary Bracing', quantity: 1, unit: 'EA', unitPrice: 4200.00, total: 4200 },
      { id: 'i13', category: 'other', description: 'Engineering Certification', quantity: 1, unit: 'EA', unitPrice: 1800.00, total: 1800 },
      { id: 'i14', category: 'other', description: 'Waste Removal (2x Skips)', quantity: 2, unit: 'EA', unitPrice: 930.00, total: 1860 },
    ],
    metadata: { windClass: 'N2', soilType: 'M', roofMaterial: 'tile', buildingClass: '1a', totalFloorArea: 320, storeys: 2 }
  },
  {
    id: 'quote-002',
    projectName: 'Granny Flat - Punchbowl',
    clientName: 'Ahmed Khodr',
    clientEmail: 'ahmed.k@gmail.com',
    address: '15 Wattle Street, Punchbowl NSW 2196',
    createdAt: '2026-04-08',
    updatedAt: '2026-04-09',
    status: 'pending',
    totalAmount: 28400,
    currency: 'AUD',
    items: [
      { id: 'j1', category: 'framing', description: '90x35 MGP10 Wall Studs @ 450mm centres', quantity: 180, unit: 'LM', unitPrice: 8.50, total: 1530, as1684Reference: 'Table 8.18 - N2 Wind, Metal Roof' },
      { id: 'j2', category: 'framing', description: '90x45 MGP10 Top/Bottom Plates', quantity: 120, unit: 'LM', unitPrice: 12.00, total: 1440 },
      { id: 'j3', category: 'bracing', description: 'Structural Ply Bracing 2400x1200x7mm', quantity: 24, unit: 'EA', unitPrice: 85.00, total: 2040, as1684Reference: 'Table 8.18 - Bracing Requirements' },
      { id: 'j4', category: 'framing', description: '190x45 MGP12 Rafters @ 600mm', quantity: 65, unit: 'LM', unitPrice: 32.00, total: 2080 },
      { id: 'j5', category: 'hardware', description: 'Hardware Pack (brackets, connectors, fixings)', quantity: 1, unit: 'EA', unitPrice: 1850.00, total: 1850 },
      { id: 'j6', category: 'labour', description: 'Framing Labour - 2 Carpenters', quantity: 48, unit: 'HR', unitPrice: 185.00, total: 8880 },
      { id: 'j7', category: 'other', description: 'Site Prep & Engineering', quantity: 1, unit: 'EA', unitPrice: 3200.00, total: 3200 },
    ],
    metadata: { windClass: 'N2', soilType: 'M', roofMaterial: 'metal', buildingClass: '1a', totalFloorArea: 60, storeys: 1 }
  },
  {
    id: 'quote-003',
    projectName: 'Extension - Lakemba',
    clientName: 'Sam Abboud',
    clientEmail: 'sam@abboudbuilding.com.au',
    address: '88 Railway Parade, Lakemba NSW 2195',
    createdAt: '2026-04-05',
    updatedAt: '2026-04-06',
    status: 'exported',
    totalAmount: 42100,
    currency: 'AUD',
    items: [
      { id: 'k1', category: 'framing', description: '90x35 MGP10 Wall Studs @ 450mm centres', quantity: 240, unit: 'LM', unitPrice: 8.50, total: 2040 },
      { id: 'k2', category: 'framing', description: '90x45 MGP10 Top/Bottom Plates', quantity: 160, unit: 'LM', unitPrice: 12.00, total: 1920 },
      { id: 'k3', category: 'labour', description: 'Framing Labour', quantity: 72, unit: 'HR', unitPrice: 185.00, total: 13320 },
    ],
    metadata: { windClass: 'N2', soilType: 'S', roofMaterial: 'tile', buildingClass: '1a', totalFloorArea: 140, storeys: 1 }
  },
  {
    id: 'quote-004',
    projectName: 'New Build - Revesby',
    clientName: 'Joe Haddad',
    address: '22 Marco Avenue, Revesby NSW 2212',
    createdAt: '2026-03-28',
    updatedAt: '2026-03-30',
    status: 'approved',
    totalAmount: 89200,
    currency: 'AUD',
    items: [],
    metadata: { windClass: 'N3', soilType: 'H1', roofMaterial: 'tile', buildingClass: '1a', totalFloorArea: 380, storeys: 2 }
  },
  {
    id: 'quote-005',
    projectName: 'Renovation - Greenacre',
    clientName: 'Mark Tanios',
    address: '5 Boronia Road, Greenacre NSW 2190',
    createdAt: '2026-03-20',
    updatedAt: '2026-03-22',
    status: 'archived',
    totalAmount: 18750,
    currency: 'AUD',
    items: [],
    metadata: { windClass: 'N1', soilType: 'A', roofMaterial: 'metal', buildingClass: '1a', totalFloorArea: 85, storeys: 1 }
  },
]

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [currentQuote, setCurrentQuote] = useState<Quote | null>(null)
  const [extractedMeasurements, setExtractedMeasurements] = useState<ExtractedMeasurements>(DEFAULT_MEASUREMENTS)
  const [quotes, setQuotes] = useState<Quote[]>(SAMPLE_QUOTES)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<FlowchartAnswer[]>([])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [wizardPreferences, setWizardPreferences] = useState<WizardPreferences>(DEFAULT_WIZARD_PREFERENCES)
  const [wizardPhase, setWizardPhase] = useState<'wizard' | 'review' | 'generating' | 'done'>('wizard')
  const [cuttingList, setCuttingList] = useState<LineItem[]>([])
  const [labourItems, setLabourItems] = useState<LineItem[]>([])
  const [extractionNotes, setExtractionNotes] = useState('')

  const addQuote = useCallback((quote: Quote) => {
    setQuotes(prev => [quote, ...prev])
  }, [])

  const addUploadedFile = useCallback((file: UploadedFile) => {
    setUploadedFiles(prev => [...prev, file])
  }, [])

  const updateUploadedFile = useCallback((id: string, updates: Partial<UploadedFile>) => {
    setUploadedFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f))
  }, [])

  const removeUploadedFile = useCallback((id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id))
  }, [])

  const addAnswer = useCallback((answer: FlowchartAnswer) => {
    setAnswers(prev => {
      const existing = prev.findIndex(a => a.stepId === answer.stepId)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = answer
        return updated
      }
      return [...prev, answer]
    })
  }, [])

  const toggleSidebar = useCallback(() => setSidebarCollapsed(prev => !prev), [])

  return (
    <AppContext.Provider value={{
      currentPage, setCurrentPage,
      currentQuote, setCurrentQuote,
      extractedMeasurements, setExtractedMeasurements,
      quotes, addQuote,
      uploadedFiles, addUploadedFile, updateUploadedFile, removeUploadedFile,
      currentStep, answers, setCurrentStep, addAnswer,
      sidebarCollapsed, toggleSidebar,
      isLoading, setIsLoading,
      wizardPreferences, setWizardPreferences,
      wizardPhase, setWizardPhase,
      cuttingList, setCuttingList,
      labourItems, setLabourItems,
      extractionNotes, setExtractionNotes,
    }}>
      {children}
    </AppContext.Provider>
  )
}
