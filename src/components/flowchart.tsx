'use client'

import React, { useState, useRef, useCallback } from 'react'
import {
  useAppContext,
  FlowchartStep,
  Quote,
  ExtractedMeasurements,
  WizardPreferences,
  LineItem,
} from './context'
import { CheckCircle, Upload, FileText, X, Loader2, Pencil, ChevronDown, ChevronUp } from 'lucide-react'
import { uploadPlan } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Wizard step definitions
// ---------------------------------------------------------------------------

const STEPS: FlowchartStep[] = [
  {
    id: 'stud-spacing',
    question: 'What is the spacing of timber studs?',
    description: 'Standard stud spacing for the frame',
    type: 'single-select',
    options: [
      { id: '300', label: '300mm', value: '300', description: 'Heavy load / double storey' },
      { id: '450', label: '450mm', value: '450', description: 'Standard residential' },
      { id: '500', label: '500mm', value: '500' },
      { id: '600', label: '600mm', value: '600', description: 'Light load / internal walls' },
    ],
  },
  {
    id: 'fibro-eaves',
    question: 'Include fibro eaves in this quote?',
    type: 'single-select',
    options: [
      { id: 'yes', label: 'Yes', value: 'yes', description: 'Include fibro eave installation' },
      { id: 'no', label: 'No', value: 'no', description: 'Eaves handled separately' },
    ],
  },
  {
    id: 'steel-beams',
    question: 'Include steel beams in this quotation?',
    type: 'single-select',
    options: [
      { id: 'yes', label: 'Yes', value: 'yes', description: 'Steel beams, posts, and lintels included' },
      { id: 'no', label: 'No', value: 'no', description: 'Steel supplied by others' },
    ],
  },
  {
    id: 'travel-expenses',
    question: 'Is travel expenses required for this quotation?',
    description: 'If the job is far and needs to be factored in pricing',
    type: 'single-select',
    options: [
      { id: 'yes', label: 'Yes', value: 'yes', description: 'Include travel/transport costs' },
      { id: 'no', label: 'No', value: 'no', description: 'Local job, no travel needed' },
    ],
  },
  {
    id: 'window-install',
    question: 'Include installation of windows in your quotation?',
    type: 'single-select',
    options: [
      { id: 'yes', label: 'Yes', value: 'yes', description: 'Window install included in scope' },
      { id: 'no', label: 'No', value: 'no', description: 'Windows installed by others' },
    ],
  },
  {
    id: 'upload-plans',
    question: 'Upload your plans',
    description:
      'Upload architectural and structural PDFs. IntelliQuote will extract key measurements. All other data can be provided in the context box on the next screen.',
    type: 'file-upload',
    validation: { required: true },
  },
]

// ---------------------------------------------------------------------------
// Plan file local state type
// ---------------------------------------------------------------------------

interface PlanFile {
  id: string
  file: File
  type: 'architectural' | 'structural'
  uploading: boolean
  extracting: boolean
  uploaded: boolean
  storagePath: string | null
  extractedData: Record<string, number | string> | null
  confidence: string | null
  error: string | null
}

// ---------------------------------------------------------------------------
// Cutting list generation
// ---------------------------------------------------------------------------

function generateCuttingList(
  measurements: ExtractedMeasurements,
  preferences: WizardPreferences,
): LineItem[] {
  const items: LineItem[] = []
  const wallLM = measurements.wallLinealMetres
  const floorM2 = measurements.floorSqMetres
  const roofM2 = measurements.roofSqMetres
  const steelT = measurements.steelTonnage
  const spacing = preferences.studSpacing

  // Wall Studs: qty = wallLM / (spacing/1000) * 2.4
  items.push({
    id: `cl-${Date.now()}-studs`,
    description: `90x35 MGP10 Wall Studs @ ${spacing}mm centres`,
    quantity: Math.round(wallLM / (spacing / 1000) * 2.4),
    unit: 'LM',
    unitPrice: 8.5,
  })

  // Top Plates: qty = wallLM * 2
  items.push({
    id: `cl-${Date.now()}-topplate`,
    description: '90x45 MGP10 Top Plates (double)',
    quantity: Math.round(wallLM * 2),
    unit: 'LM',
    unitPrice: 12.0,
  })

  // Bottom Plates: qty = wallLM
  items.push({
    id: `cl-${Date.now()}-botplate`,
    description: '90x45 MGP10 Bottom Plates',
    quantity: Math.round(wallLM),
    unit: 'LM',
    unitPrice: 12.0,
  })

  // Noggins: qty = wallLM * 1 (one row)
  items.push({
    id: `cl-${Date.now()}-noggins`,
    description: '90x35 MGP10 Noggins (1 row)',
    quantity: Math.round(wallLM),
    unit: 'LM',
    unitPrice: 8.5,
  })

  // Floor Joists: qty = floorM2 * 2.2
  items.push({
    id: `cl-${Date.now()}-floorjoist`,
    description: '240x45 MGP12 Floor Joists',
    quantity: Math.round(floorM2 * 2.2),
    unit: 'LM',
    unitPrice: 42.0,
  })

  // Roof Rafters: qty = roofM2 * 1.5
  items.push({
    id: `cl-${Date.now()}-rafters`,
    description: '190x45 MGP12 Roof Rafters',
    quantity: Math.round(roofM2 * 1.5),
    unit: 'LM',
    unitPrice: 32.0,
  })

  // Ceiling Joists: qty = floorM2 * 1.2
  items.push({
    id: `cl-${Date.now()}-ceilingjoist`,
    description: '190x35 MGP10 Ceiling Joists',
    quantity: Math.round(floorM2 * 1.2),
    unit: 'LM',
    unitPrice: 24.0,
  })

  // Bracing Ply: qty = ceil(wallLM / 6)
  items.push({
    id: `cl-${Date.now()}-bracing`,
    description: 'Structural Ply Bracing 2400x1200x7mm',
    quantity: Math.ceil(wallLM / 6),
    unit: 'EA',
    unitPrice: 85.0,
  })

  // Hardware Pack: qty 1
  items.push({
    id: `cl-${Date.now()}-hardware`,
    description: 'Framing Brackets & Connectors Pack',
    quantity: 1,
    unit: 'EA',
    unitPrice: 2450,
  })

  // Nails & Fixings: qty 1
  items.push({
    id: `cl-${Date.now()}-nails`,
    description: 'Nails, Screws & Fixings Bulk Pack',
    quantity: 1,
    unit: 'EA',
    unitPrice: 1890,
  })

  // Conditional: Fibro Eave Sheets
  if (preferences.fibroEaves) {
    items.push({
      id: `cl-${Date.now()}-fibro`,
      description: 'Fibro Eave Sheets',
      quantity: Math.round(roofM2 * 0.3),
      unit: 'M2',
      unitPrice: 45,
    })
  }

  // Conditional: Steel Beams
  if (preferences.steelBeams) {
    items.push({
      id: `cl-${Date.now()}-steel`,
      description: 'Steel Beams (UB/UC)',
      quantity: Number(steelT.toFixed(2)),
      unit: 'T',
      unitPrice: measurements.steelRatePerT,
    })
  }

  // Conditional: Window Install
  if (preferences.windowInstall) {
    items.push({
      id: `cl-${Date.now()}-windows`,
      description: 'Window Installation',
      quantity: 8,
      unit: 'EA',
      unitPrice: 350,
    })
  }

  return items
}

// ---------------------------------------------------------------------------
// Labour generation
// ---------------------------------------------------------------------------

function generateLabourItems(
  measurements: ExtractedMeasurements,
  preferences: WizardPreferences,
): LineItem[] {
  const items: LineItem[] = []
  const floorM2 = measurements.floorSqMetres

  // Framing Labour: qty = floorM2 * 0.4 hrs
  items.push({
    id: `lb-${Date.now()}-framing`,
    description: 'Framing Labour - 2 Carpenters + Apprentice',
    quantity: Math.round(floorM2 * 0.4),
    unit: 'HR',
    unitPrice: 185,
  })

  // Crane Hire: qty = 1
  items.push({
    id: `lb-${Date.now()}-crane`,
    description: 'Crane Hire - Frame Lift',
    quantity: 1,
    unit: 'EA',
    unitPrice: 1650,
  })

  // Site Setup: qty = 1
  items.push({
    id: `lb-${Date.now()}-setup`,
    description: 'Site Setup & Temporary Bracing',
    quantity: 1,
    unit: 'EA',
    unitPrice: 4200,
  })

  // Conditional: Travel
  if (preferences.travelExpenses) {
    items.push({
      id: `lb-${Date.now()}-travel`,
      description: 'Travel & Transport Expenses',
      quantity: 1,
      unit: 'EA',
      unitPrice: 1500,
    })
  }

  // Waste Removal: qty = ceil(floorM2/150)
  items.push({
    id: `lb-${Date.now()}-waste`,
    description: 'Waste Removal (Skip Bins)',
    quantity: Math.ceil(floorM2 / 150),
    unit: 'EA',
    unitPrice: 930,
  })

  return items
}

// ---------------------------------------------------------------------------
// Main wizard component
// ---------------------------------------------------------------------------

export function FlowchartWizard() {
  const {
    currentStep,
    setCurrentStep,
    answers,
    addAnswer,
    setCurrentQuote,
    setCurrentPage,
    extractedMeasurements,
    setExtractedMeasurements,
    wizardPreferences,
    setWizardPreferences,
    wizardPhase,
    setWizardPhase,
    setCuttingList,
    setLabourItems,
    extractionNotes,
    setExtractionNotes,
    addQuote,
  } = useAppContext()

  const [planFiles, setPlanFiles] = useState<PlanFile[]>([])
  const [extractionComplete, setExtractionComplete] = useState(false)
  const [additionalContext, setAdditionalContext] = useState('')
  const [notesExpanded, setNotesExpanded] = useState(false)

  const measurements = extractedMeasurements

  const currentStepData = STEPS[currentStep]
  const progress = ((currentStep + 1) / STEPS.length) * 100
  const currentAnswer = answers.find(a => a.stepId === currentStepData?.id)

  const isStepAnswered =
    currentStepData?.id === 'upload-plans' ? extractionComplete : !!currentAnswer

  // Navigation handlers
  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      setWizardPhase('review')
    }
  }

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1)
  }

  const handleAnswer = (value: string | number) => {
    addAnswer({ stepId: currentStepData.id, value, answeredAt: new Date().toISOString() })
  }

  // File upload handler
  const handleFileUpload = useCallback(
    async (file: File, planType: 'architectural' | 'structural') => {
      if (!file.type.includes('pdf')) return

      const fileId = `plan-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
      const newPlan: PlanFile = {
        id: fileId,
        file,
        type: planType,
        uploading: true,
        extracting: false,
        uploaded: false,
        storagePath: null,
        extractedData: null,
        confidence: null,
        error: null,
      }

      setPlanFiles(prev => [...prev.filter(p => p.type !== planType), newPlan])
      setExtractionComplete(false)

      try {
        const result = await uploadPlan(file)
        if (!result) {
          setPlanFiles(prev =>
            prev.map(p =>
              p.id === fileId ? { ...p, uploading: false, error: 'Upload failed' } : p,
            ),
          )
          return
        }

        setPlanFiles(prev =>
          prev.map(p =>
            p.id === fileId
              ? { ...p, uploading: false, extracting: true, uploaded: true, storagePath: result.path }
              : p,
          ),
        )

        const extractResponse = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storagePath: result.path, planType }),
        })

        const extractResult = await extractResponse.json()

        let extractedData: Record<string, number | string> | null = null
        let confidence: string | null = null

        if (extractResult.success && extractResult.extractedData) {
          const d = extractResult.extractedData
          extractedData = { ...d }
          confidence = d.confidence ?? null

          // Map API response to ExtractedMeasurements
          // API returns flat fields: groundFloorWallLM, firstFloorWallLM, groundFloorAreaM2, etc.
          if (planType === 'architectural') {
            const gfWall = Math.round(Number(d.groundFloorWallLM) || 0)
            const ffWall = Math.round(Number(d.firstFloorWallLM) || 0)
            const gfArea = Math.round(Number(d.groundFloorAreaM2) || 0)
            const ffArea = Math.round(Number(d.firstFloorAreaM2) || 0)
            const roof = Math.round(Number(d.roofSqMetres) || 0)

            setExtractedMeasurements(prev => ({
              ...prev,
              groundFloorWallLM: gfWall || prev.groundFloorWallLM,
              firstFloorWallLM: ffWall || prev.firstFloorWallLM,
              wallLinealMetres: (gfWall || prev.groundFloorWallLM) + (ffWall || prev.firstFloorWallLM),
              groundFloorAreaM2: gfArea || prev.groundFloorAreaM2,
              firstFloorAreaM2: ffArea || prev.firstFloorAreaM2,
              floorSqMetres: (gfArea || prev.groundFloorAreaM2) + (ffArea || prev.firstFloorAreaM2),
              roofSqMetres: roof || prev.roofSqMetres,
            }))

            // Save working notes
            if (d.workingNotes) {
              setExtractionNotes(String(d.workingNotes))
            }
          }

          if (planType === 'structural') {
            setExtractedMeasurements(prev => ({
              ...prev,
              steelTonnage: Number(d.steelTonnage)
                ? Math.round(Number(d.steelTonnage) * 100) / 100
                : prev.steelTonnage,
            }))

            if (d.steelBreakdown) {
              const currentNotes = extractionNotes
              setExtractionNotes(
                currentNotes ? currentNotes + '\n\n--- Steel Breakdown ---\n' + String(d.steelBreakdown) : String(d.steelBreakdown),
              )
            }
          }
        } else {
          setPlanFiles(prev =>
            prev.map(p =>
              p.id === fileId
                ? {
                    ...p,
                    extracting: false,
                    error:
                      extractResult.warning ||
                      extractResult.error ||
                      'Could not extract data. Try a vector PDF.',
                  }
                : p,
            ),
          )
          return
        }

        setPlanFiles(prev => {
          const updated = prev.map(p =>
            p.id === fileId ? { ...p, extracting: false, extractedData, confidence } : p,
          )
          const allDone = updated.every(p => !p.uploading && !p.extracting && p.extractedData)
          if (allDone) {
            setExtractionComplete(true)
            addAnswer({ stepId: 'upload-plans', value: 'extracted', answeredAt: new Date().toISOString() })
          }
          return updated
        })
      } catch {
        setPlanFiles(prev =>
          prev.map(p =>
            p.id === fileId
              ? { ...p, uploading: false, extracting: false, error: 'Upload failed' }
              : p,
          ),
        )
      }
    },
    [addAnswer, setExtractedMeasurements, setExtractionNotes],
  )

  const removePlanFile = useCallback((planType: 'architectural' | 'structural') => {
    setPlanFiles(prev => prev.filter(p => p.type !== planType))
    setExtractionComplete(false)
  }, [])

  // Generate quote from measurements + preferences
  const generateQuote = async () => {
    setWizardPhase('generating')
    await new Promise(resolve => setTimeout(resolve, 1500))

    // Populate preferences from wizard answers
    const studSpacing = Number(answers.find(a => a.stepId === 'stud-spacing')?.value) || 450
    const fibroEaves = (answers.find(a => a.stepId === 'fibro-eaves')?.value as string) === 'yes'
    const steelBeams = (answers.find(a => a.stepId === 'steel-beams')?.value as string) === 'yes'
    const travelExpenses = (answers.find(a => a.stepId === 'travel-expenses')?.value as string) === 'yes'
    const windowInstall = (answers.find(a => a.stepId === 'window-install')?.value as string) === 'yes'

    const prefs: WizardPreferences = {
      studSpacing,
      fibroEaves,
      steelBeams,
      travelExpenses,
      windowInstall,
    }
    setWizardPreferences(prefs)

    // Generate cutting list and labour items
    const cutting = generateCuttingList(measurements, prefs)
    const labour = generateLabourItems(measurements, prefs)
    setCuttingList(cutting)
    setLabourItems(labour)

    // Calculate totals
    const cuttingTotal = cutting.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    const labourTotal = labour.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)

    // Build Quote object
    const newQuote: Quote = {
      id: `quote-${Date.now()}`,
      projectName: `New Quote - ${measurements.floorSqMetres}m² @ ${studSpacing}mm`,
      clientName: 'CCC Group',
      address: 'Sydney NSW',
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      status: 'draft',
      totalAmount: Math.round(cuttingTotal + labourTotal),
      currency: 'AUD',
      items: [
        ...cutting.map(item => ({
          id: item.id,
          category: 'framing' as const,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit as 'LM' | 'M2' | 'M3' | 'EA' | 'HR' | 'KG',
          unitPrice: item.unitPrice,
          total: Math.round(item.quantity * item.unitPrice),
        })),
        ...labour.map(item => ({
          id: item.id,
          category: 'labour' as const,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit as 'LM' | 'M2' | 'M3' | 'EA' | 'HR' | 'KG',
          unitPrice: item.unitPrice,
          total: Math.round(item.quantity * item.unitPrice),
        })),
      ],
      metadata: {
        windClass: null,
        soilType: null,
        roofMaterial: null,
        buildingClass: null,
        totalFloorArea: measurements.floorSqMetres,
        storeys: measurements.firstFloorAreaM2 > 0 ? 2 : 1,
      },
    }

    setCurrentQuote(newQuote)
    addQuote(newQuote)
    setWizardPhase('done')
  }

  // Helper: update a single measurement field
  const updateMeasurement = (field: keyof ExtractedMeasurements, value: number) => {
    setExtractedMeasurements(prev => {
      const next = { ...prev, [field]: value }
      // Auto-recalculate totals when per-floor values change
      if (field === 'groundFloorWallLM' || field === 'firstFloorWallLM') {
        next.wallLinealMetres =
          (field === 'groundFloorWallLM' ? value : prev.groundFloorWallLM) +
          (field === 'firstFloorWallLM' ? value : prev.firstFloorWallLM)
      }
      if (field === 'groundFloorAreaM2' || field === 'firstFloorAreaM2') {
        next.floorSqMetres =
          (field === 'groundFloorAreaM2' ? value : prev.groundFloorAreaM2) +
          (field === 'firstFloorAreaM2' ? value : prev.firstFloorAreaM2)
      }
      return next
    })
  }

  // =========================================================================
  // REVIEW PHASE
  // =========================================================================
  if (wizardPhase === 'review') {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Review Extracted Data</h1>
          <p className="text-slate-500 mt-1">
            Edit any values below before generating your quote. These measurements drive the entire
            quote.
          </p>
        </div>

        {/* Ground Floor - measurements with rates side by side */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Pencil className="w-4 h-4 text-amber-500" /> Ground Floor
          </h2>
          {/* Walls row: measurement + rate */}
          <div className="flex items-center gap-3 py-2 border-b border-slate-100">
            <span className="text-sm font-medium text-slate-700 w-24">Walls</span>
            <input type="number" value={measurements.groundFloorWallLM || ''} onChange={e => updateMeasurement('groundFloorWallLM', Number(e.target.value) || 0)} className="w-24 px-3 py-2 text-right font-semibold border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 text-sm" placeholder="0" />
            <span className="text-xs text-slate-500">LM</span>
            <span className="text-slate-400 text-xs mx-1">x $</span>
            <input type="number" value={measurements.wallRatePerLM || ''} onChange={e => updateMeasurement('wallRatePerLM', Number(e.target.value) || 0)} className="w-20 px-2 py-2 text-right border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 text-sm" placeholder="85" />
            <span className="text-xs text-slate-500">/LM</span>
            <span className="text-slate-400 text-xs mx-1">=</span>
            <span className="font-semibold text-slate-900 text-sm">${((measurements.groundFloorWallLM || 0) * (measurements.wallRatePerLM || 0)).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
          </div>
          {/* Floor area row: measurement + rate */}
          <div className="flex items-center gap-3 py-2">
            <span className="text-sm font-medium text-slate-700 w-24">Floor Area</span>
            <input type="number" value={measurements.groundFloorAreaM2 || ''} onChange={e => updateMeasurement('groundFloorAreaM2', Number(e.target.value) || 0)} className="w-24 px-3 py-2 text-right font-semibold border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 text-sm" placeholder="0" />
            <span className="text-xs text-slate-500">m²</span>
            <span className="text-slate-400 text-xs mx-1">x $</span>
            <input type="number" value={measurements.floorRatePerM2 || ''} onChange={e => updateMeasurement('floorRatePerM2', Number(e.target.value) || 0)} className="w-20 px-2 py-2 text-right border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 text-sm" placeholder="95" />
            <span className="text-xs text-slate-500">/m²</span>
            <span className="text-slate-400 text-xs mx-1">=</span>
            <span className="font-semibold text-slate-900 text-sm">${((measurements.groundFloorAreaM2 || 0) * (measurements.floorRatePerM2 || 0)).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* First Floor - measurements with rates side by side */}
        <div className="bg-white rounded-xl border border-blue-100 p-6 space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Pencil className="w-4 h-4 text-blue-500" /> First Floor
          </h2>
          <div className="flex items-center gap-3 py-2 border-b border-slate-100">
            <span className="text-sm font-medium text-slate-700 w-24">Walls</span>
            <input type="number" value={measurements.firstFloorWallLM || ''} onChange={e => updateMeasurement('firstFloorWallLM', Number(e.target.value) || 0)} className="w-24 px-3 py-2 text-right font-semibold border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-sm" placeholder="0" />
            <span className="text-xs text-slate-500">LM</span>
            <span className="text-slate-400 text-xs mx-1">x $</span>
            <input type="number" value={measurements.wallRatePerLM || ''} onChange={e => updateMeasurement('wallRatePerLM', Number(e.target.value) || 0)} className="w-20 px-2 py-2 text-right border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-sm" placeholder="85" />
            <span className="text-xs text-slate-500">/LM</span>
            <span className="text-slate-400 text-xs mx-1">=</span>
            <span className="font-semibold text-slate-900 text-sm">${((measurements.firstFloorWallLM || 0) * (measurements.wallRatePerLM || 0)).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex items-center gap-3 py-2">
            <span className="text-sm font-medium text-slate-700 w-24">Floor Area</span>
            <input type="number" value={measurements.firstFloorAreaM2 || ''} onChange={e => updateMeasurement('firstFloorAreaM2', Number(e.target.value) || 0)} className="w-24 px-3 py-2 text-right font-semibold border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-sm" placeholder="0" />
            <span className="text-xs text-slate-500">m²</span>
            <span className="text-slate-400 text-xs mx-1">x $</span>
            <input type="number" value={measurements.floorRatePerM2 || ''} onChange={e => updateMeasurement('floorRatePerM2', Number(e.target.value) || 0)} className="w-20 px-2 py-2 text-right border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-sm" placeholder="95" />
            <span className="text-xs text-slate-500">/m²</span>
            <span className="text-slate-400 text-xs mx-1">=</span>
            <span className="font-semibold text-slate-900 text-sm">${((measurements.firstFloorAreaM2 || 0) * (measurements.floorRatePerM2 || 0)).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Totals row */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-3 border border-slate-100">
              <p className="text-xs text-slate-400 mb-1">Total Wall LM</p>
              <p className="text-xl font-bold text-slate-900">{measurements.wallLinealMetres} <span className="text-sm font-medium text-slate-400">LM</span></p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-slate-100">
              <p className="text-xs text-slate-400 mb-1">Total Floor Area</p>
              <p className="text-xl font-bold text-slate-900">{measurements.floorSqMetres} <span className="text-sm font-medium text-slate-400">m²</span></p>
            </div>
          </div>
        </div>

        {/* Roof + Steel with rates */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Roof & Steel</h2>
          <div className="flex items-center gap-3 py-2 border-b border-slate-100">
            <span className="text-sm font-medium text-slate-700 w-24">Roof Area</span>
            <input type="number" value={measurements.roofSqMetres || ''} onChange={e => updateMeasurement('roofSqMetres', Number(e.target.value) || 0)} className="w-24 px-3 py-2 text-right font-semibold border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 text-sm" placeholder="0" />
            <span className="text-xs text-slate-500">m²</span>
            <span className="text-slate-400 text-xs mx-1">x $</span>
            <input type="number" value={measurements.roofRatePerM2 || ''} onChange={e => updateMeasurement('roofRatePerM2', Number(e.target.value) || 0)} className="w-20 px-2 py-2 text-right border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 text-sm" placeholder="65" />
            <span className="text-xs text-slate-500">/m²</span>
            <span className="text-slate-400 text-xs mx-1">=</span>
            <span className="font-semibold text-slate-900 text-sm">${((measurements.roofSqMetres || 0) * (measurements.roofRatePerM2 || 0)).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex items-center gap-3 py-2">
            <span className="text-sm font-medium text-slate-700 w-24">Steel</span>
            <input type="number" step="0.01" value={measurements.steelTonnage || ''} onChange={e => updateMeasurement('steelTonnage', Number(e.target.value) || 0)} className="w-24 px-3 py-2 text-right font-semibold border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 text-sm" placeholder="0" />
            <span className="text-xs text-slate-500">T</span>
            <span className="text-slate-400 text-xs mx-1">x $</span>
            <input type="number" value={measurements.steelRatePerT || ''} onChange={e => updateMeasurement('steelRatePerT', Number(e.target.value) || 0)} className="w-20 px-2 py-2 text-right border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 text-sm" placeholder="3500" />
            <span className="text-xs text-slate-500">/T</span>
            <span className="text-slate-400 text-xs mx-1">=</span>
            <span className="font-semibold text-slate-900 text-sm">${((measurements.steelTonnage || 0) * (measurements.steelRatePerT || 0)).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Additional context */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Additional Context</h2>
          <p className="text-sm text-slate-500 mb-3">
            Add any notes to steer the quote. Site conditions, specific requirements, material
            preferences, access issues, anything the AI should factor in.
          </p>
          <textarea
            value={additionalContext}
            onChange={e => setAdditionalContext(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm"
            placeholder="e.g. Difficult access - crane required. Tile roof, N2 wind zone. Client wants MGP12 throughout. Second floor has cathedral ceiling..."
          />
        </div>

        {/* Extraction Working Notes - collapsible */}
        {extractionNotes && (
          <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setNotesExpanded(!notesExpanded)}
              className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-100 transition-colors"
            >
              <span className="text-sm font-semibold text-slate-700">
                Extraction Working Notes (AI Arithmetic)
              </span>
              {notesExpanded ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>
            {notesExpanded && (
              <div className="px-6 pb-4">
                <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono bg-white rounded-lg p-4 border border-slate-100">
                  {extractionNotes}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Uploaded plans summary */}
        {planFiles.length > 0 && (
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-medium text-slate-700 mb-2">Uploaded Plans</p>
            <div className="space-y-2">
              {planFiles.map(pf => (
                <div key={pf.id} className="flex items-center gap-3 text-sm">
                  <FileText className="w-4 h-4 text-red-500" />
                  <span className="text-slate-700">{pf.file.name}</span>
                  <span className="text-slate-400">({pf.type})</span>
                  {pf.confidence && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        pf.confidence === 'high'
                          ? 'bg-green-100 text-green-700'
                          : pf.confidence === 'medium'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {pf.confidence}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              setWizardPhase('wizard')
              setCurrentStep(STEPS.length - 1)
            }}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            &larr; Back to Upload
          </button>
          <button
            onClick={generateQuote}
            disabled={measurements.wallLinealMetres === 0 && measurements.floorSqMetres === 0}
            className={`px-8 py-3 font-semibold rounded-lg transition-colors ${
              measurements.wallLinealMetres > 0 || measurements.floorSqMetres > 0
                ? 'bg-amber-500 text-slate-900 hover:bg-amber-400'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            Generate Quote
          </button>
        </div>
      </div>
    )
  }

  // =========================================================================
  // GENERATING PHASE
  // =========================================================================
  if (wizardPhase === 'generating') {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
          <Loader2 className="w-10 h-10 text-amber-600 animate-spin" />
        </div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">Generating Your Quote</h2>
        <p className="text-slate-500 mb-6">
          Building cutting list, labour schedule, and pricing...
        </p>
        <div className="max-w-xs mx-auto">
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full animate-loading"
              style={{ animationDuration: '2s', animationIterationCount: 'infinite' }}
            />
          </div>
        </div>
        <div className="mt-6 text-sm text-slate-400 space-y-1">
          <p>
            Walls: {measurements.wallLinealMetres} LM | Floor: {measurements.floorSqMetres} m² |
            Roof: {measurements.roofSqMetres} m² | Steel: {measurements.steelTonnage} T
          </p>
        </div>
      </div>
    )
  }

  // =========================================================================
  // DONE PHASE
  // =========================================================================
  if (wizardPhase === 'done') {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">Quote Generated</h2>
        <p className="text-slate-500 mb-6">Your quote is ready for review.</p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setCurrentPage('view-quote')}
            className="px-6 py-3 bg-amber-500 text-slate-900 font-semibold rounded-lg hover:bg-amber-400 transition-colors"
          >
            View Quote
          </button>
          <button
            onClick={() => setCurrentPage('dashboard')}
            className="px-6 py-3 border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // =========================================================================
  // WIZARD PHASE (6 steps)
  // =========================================================================
  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-sm text-slate-500 mb-2">
          <span>
            Step {currentStep + 1} of {STEPS.length}
          </span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((step, index) => (
          <button
            key={step.id}
            onClick={() => index <= currentStep && setCurrentStep(index)}
            className={`w-8 h-8 rounded-full text-sm font-medium transition-all duration-200 ${
              index === currentStep
                ? 'bg-amber-500 text-slate-900'
                : index < currentStep
                  ? 'bg-green-500 text-white'
                  : 'bg-slate-200 text-slate-400'
            } ${index <= currentStep ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed'}`}
          >
            {index < currentStep ? '\u2713' : index + 1}
          </button>
        ))}
      </div>

      {/* Question card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8">
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">{currentStepData.question}</h2>
          {currentStepData.description && (
            <p className="text-slate-500 mb-6">{currentStepData.description}</p>
          )}

          {currentStepData.type === 'single-select' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentStepData.options?.map(option => (
                <button
                  key={option.id}
                  onClick={() => handleAnswer(option.value)}
                  className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                    currentAnswer?.value === option.value
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className="font-medium text-slate-900">{option.label}</p>
                  {option.description && (
                    <p className="text-sm text-slate-500 mt-1">{option.description}</p>
                  )}
                </button>
              ))}
            </div>
          )}

          {currentStepData.type === 'file-upload' && (
            <PlanUploadStep
              planFiles={planFiles}
              extractionComplete={extractionComplete}
              measurements={measurements}
              onFileSelect={handleFileUpload}
              onRemove={removePlanFile}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              currentStep === 0
                ? 'text-slate-300 cursor-not-allowed'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            &larr; Back
          </button>
          <button
            onClick={handleNext}
            disabled={!isStepAnswered}
            className={`px-6 py-2 font-medium text-sm rounded-lg transition-colors ${
              isStepAnswered
                ? 'bg-amber-500 text-slate-900 hover:bg-amber-400'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {currentStep === STEPS.length - 1
              ? 'Review & Edit Measurements \u2192'
              : 'Continue \u2192'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ===========================================================================
// Plan Upload Step (sub-component)
// ===========================================================================

function PlanUploadStep({
  planFiles,
  extractionComplete,
  measurements,
  onFileSelect,
  onRemove,
}: {
  planFiles: PlanFile[]
  extractionComplete: boolean
  measurements: ExtractedMeasurements
  onFileSelect: (file: File, type: 'architectural' | 'structural') => void
  onRemove: (type: 'architectural' | 'structural') => void
}) {
  const archRef = useRef<HTMLInputElement>(null)
  const structRef = useRef<HTMLInputElement>(null)

  const archFile = planFiles.find(p => p.type === 'architectural')
  const structFile = planFiles.find(p => p.type === 'structural')

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PlanSlot
          label="Architectural Plans"
          description="Floor plans, elevations, sections"
          icon="A"
          colour="blue"
          planFile={archFile || null}
          inputRef={archRef}
          onFileSelect={f => onFileSelect(f, 'architectural')}
          onRemove={() => onRemove('architectural')}
        />
        <PlanSlot
          label="Structural Plans"
          description="Bracing, tie-downs, lintels, steel"
          icon="S"
          colour="purple"
          planFile={structFile || null}
          inputRef={structRef}
          onFileSelect={f => onFileSelect(f, 'structural')}
          onRemove={() => onRemove('structural')}
        />
      </div>

      {/* Extraction summary */}
      {extractionComplete &&
        (measurements.wallLinealMetres > 0 || measurements.floorSqMetres > 0) && (
          <div className="bg-green-50 rounded-xl border border-green-200 p-5">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-green-900 mb-3">Extraction Complete</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-white rounded-lg p-3 border border-green-100">
                    <p className="text-xs text-green-600 mb-1">Walls</p>
                    <p className="text-xl font-bold text-slate-900">
                      {measurements.wallLinealMetres}{' '}
                      <span className="text-sm font-medium text-slate-500">LM</span>
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-green-100">
                    <p className="text-xs text-green-600 mb-1">Floor</p>
                    <p className="text-xl font-bold text-slate-900">
                      {measurements.floorSqMetres}{' '}
                      <span className="text-sm font-medium text-slate-500">m²</span>
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-green-100">
                    <p className="text-xs text-green-600 mb-1">Roof</p>
                    <p className="text-xl font-bold text-slate-900">
                      {measurements.roofSqMetres}{' '}
                      <span className="text-sm font-medium text-slate-500">m²</span>
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-green-100">
                    <p className="text-xs text-green-600 mb-1">Steel</p>
                    <p className="text-xl font-bold text-slate-900">
                      {measurements.steelTonnage}{' '}
                      <span className="text-sm font-medium text-slate-500">T</span>
                    </p>
                  </div>
                </div>
                <p className="text-xs text-green-700 mt-3">
                  You can edit these values on the next screen before generating your quote.
                </p>
              </div>
            </div>
          </div>
        )}

      {/* Processing indicator */}
      {planFiles.some(p => p.extracting) && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <div className="space-y-2 text-sm text-amber-700">
            <p className="animate-pulse">Reading PDF and extracting measurements...</p>
            <p className="animate-pulse" style={{ animationDelay: '0.5s' }}>
              This may take 1-2 minutes for large plans...
            </p>
          </div>
        </div>
      )}

      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 text-sm mb-2">How it works</h4>
        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>Upload architectural plans (wall LM, floor m², roof m²)</li>
          <li>Upload structural plans (steel tonnage, bracing, lintels)</li>
          <li>Review and edit extracted measurements</li>
          <li>Add context to steer the quote</li>
        </ol>
      </div>
    </div>
  )
}

// ===========================================================================
// Plan Slot (individual upload slot)
// ===========================================================================

function PlanSlot({
  label,
  description,
  icon,
  colour,
  planFile,
  inputRef,
  onFileSelect,
  onRemove,
}: {
  label: string
  description: string
  icon: string
  colour: 'blue' | 'purple'
  planFile: PlanFile | null
  inputRef: React.RefObject<HTMLInputElement>
  onFileSelect: (file: File) => void
  onRemove: () => void
}) {
  const [isDragging, setIsDragging] = useState(false)

  const colourMap = {
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-600',
      accent: 'bg-blue-100',
      dragBg: 'bg-blue-50 border-blue-400',
    },
    purple: {
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      text: 'text-purple-600',
      accent: 'bg-purple-100',
      dragBg: 'bg-purple-50 border-purple-400',
    },
  }
  const c = colourMap[colour]

  // Uploaded file display
  if (planFile) {
    const isProcessing = planFile.uploading || planFile.extracting
    return (
      <div
        className={`rounded-xl border-2 ${planFile.extractedData ? 'border-green-200 bg-green-50/30' : c.border} p-4`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 ${c.accent} rounded-lg flex items-center justify-center flex-shrink-0`}
          >
            <span className={`font-bold text-sm ${c.text}`}>{icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-500 mb-0.5">{label}</p>
            <p className="font-medium text-slate-900 truncate text-sm">{planFile.file.name}</p>
            <div className="flex items-center gap-2 text-xs mt-1">
              <span className="text-slate-400">
                {(planFile.file.size / 1024 / 1024).toFixed(1)} MB
              </span>
              {planFile.uploading && (
                <span className="text-blue-600 font-medium flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Uploading...
                </span>
              )}
              {planFile.extracting && (
                <span className="text-amber-600 font-medium flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Extracting...
                </span>
              )}
              {planFile.extractedData && (
                <span className="text-green-600 font-medium flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Done
                </span>
              )}
              {planFile.error && (
                <span className="text-red-600 font-medium">{planFile.error}</span>
              )}
            </div>
            {isProcessing && (
              <div className="h-1 bg-slate-100 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${planFile.uploading ? 'bg-blue-500 w-1/2' : 'bg-amber-500 animate-pulse w-full'}`}
                />
              </div>
            )}
          </div>
          {!isProcessing && (
            <button
              onClick={onRemove}
              className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    )
  }

  // Empty upload slot
  return (
    <div
      onDragOver={e => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={e => {
        e.preventDefault()
        setIsDragging(false)
      }}
      onDrop={e => {
        e.preventDefault()
        setIsDragging(false)
        const f = e.dataTransfer.files[0]
        if (f) onFileSelect(f)
      }}
      onClick={() => inputRef.current?.click()}
      className={`rounded-xl border-2 border-dashed p-6 cursor-pointer transition-all duration-200 text-center ${
        isDragging ? c.dragBg : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) onFileSelect(f)
        }}
        className="hidden"
      />
      <div
        className={`w-12 h-12 ${c.accent} rounded-lg flex items-center justify-center mx-auto mb-3`}
      >
        <span className={`font-bold text-lg ${c.text}`}>{icon}</span>
      </div>
      <p className="font-medium text-slate-900 text-sm mb-1">{label}</p>
      <p className="text-xs text-slate-500 mb-3">{description}</p>
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${c.bg} ${c.text} text-xs font-medium`}
      >
        <Upload className="w-3 h-3" /> Upload PDF
      </div>
    </div>
  )
}
