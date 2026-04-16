'use client'

import React, { useState, useRef, useCallback } from 'react'
import { useAppContext, FlowchartStep, Quote } from './context'
import { CheckCircle, Upload, FileText, X, Loader2, Pencil } from 'lucide-react'
import { uploadPlan } from '@/lib/supabase'

const STEPS: FlowchartStep[] = [
  {
    id: 'project-type',
    question: 'What type of project is this?',
    description: 'Select the primary construction type',
    type: 'single-select',
    options: [
      { id: 'new-build', label: 'New Build', value: 'new-build', description: 'Complete new construction' },
      { id: 'extension', label: 'Extension', value: 'extension', description: 'Adding to existing structure' },
      { id: 'renovation', label: 'Renovation', value: 'renovation', description: 'Modifying existing structure' },
      { id: 'granny-flat', label: 'Granny Flat', value: 'granny-flat', description: 'Secondary dwelling' },
    ],
  },
  {
    id: 'storeys',
    question: 'How many storeys?',
    type: 'single-select',
    options: [
      { id: '1', label: 'Single Storey', value: '1', description: 'Ground floor only' },
      { id: '2', label: 'Double Storey', value: '2', description: 'Two levels' },
    ],
  },
  {
    id: 'upload-plans',
    question: 'Upload your plans',
    description: 'Upload architectural and structural PDFs. IntelliQuote will extract key measurements.',
    type: 'file-upload',
    validation: { required: true },
  },
]

// The editable measurements that come from extraction
interface ExtractedMeasurements {
  wallLinealMetres: number
  floorSqMetres: number
  roofSqMetres: number
  steelTonnage: number
}

interface PlanFile {
  id: string
  file: File
  type: 'architectural' | 'structural'
  uploading: boolean
  extracting: boolean
  uploaded: boolean
  storagePath: string | null
  extractedData: Record<string, number | string> | null
  error: string | null
}

export function FlowchartWizard() {
  const { currentStep, setCurrentStep, answers, addAnswer, setCurrentQuote, setCurrentPage } = useAppContext()
  const [planFiles, setPlanFiles] = useState<PlanFile[]>([])
  const [extractionComplete, setExtractionComplete] = useState(false)

  // Phase: 'wizard' -> 'review' -> 'generating' -> 'done'
  const [phase, setPhase] = useState<'wizard' | 'review' | 'generating' | 'done'>('wizard')

  // Editable measurements (populated from extraction, user can override)
  const [measurements, setMeasurements] = useState<ExtractedMeasurements>({
    wallLinealMetres: 0, floorSqMetres: 0, roofSqMetres: 0, steelTonnage: 0,
  })

  // Additional context the user can inject to steer the AI
  const [additionalContext, setAdditionalContext] = useState('')

  const currentStepData = STEPS[currentStep]
  const progress = ((currentStep + 1) / STEPS.length) * 100
  const currentAnswer = answers.find(a => a.stepId === currentStepData?.id)

  const isStepAnswered = currentStepData?.id === 'upload-plans'
    ? extractionComplete
    : !!currentAnswer

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      // Go to review phase instead of generating immediately
      setPhase('review')
    }
  }

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1)
  }

  const handleAnswer = (value: string | number) => {
    addAnswer({ stepId: currentStepData.id, value, answeredAt: new Date().toISOString() })
  }

  const handleFileUpload = useCallback(async (file: File, planType: 'architectural' | 'structural') => {
    if (!file.type.includes('pdf')) return

    const fileId = `plan-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
    const newPlan: PlanFile = {
      id: fileId, file, type: planType,
      uploading: true, extracting: false, uploaded: false,
      storagePath: null, extractedData: null, error: null,
    }

    setPlanFiles(prev => [...prev.filter(p => p.type !== planType), newPlan])
    setExtractionComplete(false)

    try {
      const result = await uploadPlan(file)
      if (!result) {
        setPlanFiles(prev => prev.map(p => p.id === fileId ? { ...p, uploading: false, error: 'Upload failed' } : p))
        return
      }

      setPlanFiles(prev => prev.map(p => p.id === fileId ? { ...p, uploading: false, extracting: true, uploaded: true, storagePath: result.path } : p))

      const extractResponse = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath: result.path, planType }),
      })

      const extractResult = await extractResponse.json()

      let extractedData: Record<string, number | string> | null = null

      if (extractResult.success && extractResult.extractedData) {
        const d = extractResult.extractedData
        extractedData = { ...d }

        // Auto-populate editable measurements from architectural extraction
        if (planType === 'architectural') {
          setMeasurements(prev => ({
            ...prev,
            wallLinealMetres: Math.round(Number(d.wallLinealMetres) || prev.wallLinealMetres),
            floorSqMetres: Math.round(Number(d.floorSqMetres) || prev.floorSqMetres),
            roofSqMetres: Math.round(Number(d.roofSqMetres) || prev.roofSqMetres),
          }))
        }
        if (planType === 'structural') {
          setMeasurements(prev => ({
            ...prev,
            steelTonnage: Number(d.steelTonnage) ? Math.round(Number(d.steelTonnage) * 100) / 100 : prev.steelTonnage,
          }))
        }
      } else {
        setPlanFiles(prev => prev.map(p => p.id === fileId ? {
          ...p, extracting: false,
          error: extractResult.warning || extractResult.error || 'Could not extract data. Try a vector PDF.',
        } : p))
        return
      }

      setPlanFiles(prev => {
        const updated = prev.map(p => p.id === fileId ? { ...p, extracting: false, extractedData } : p)
        const allDone = updated.every(p => !p.uploading && !p.extracting && p.extractedData)
        if (allDone) {
          setExtractionComplete(true)
          addAnswer({ stepId: 'upload-plans', value: 'extracted', answeredAt: new Date().toISOString() })
        }
        return updated
      })
    } catch {
      setPlanFiles(prev => prev.map(p => p.id === fileId ? { ...p, uploading: false, extracting: false, error: 'Upload failed' } : p))
    }
  }, [addAnswer])

  const removePlanFile = useCallback((planType: 'architectural' | 'structural') => {
    setPlanFiles(prev => prev.filter(p => p.type !== planType))
    setExtractionComplete(false)
  }, [])

  const generateQuote = async () => {
    setPhase('generating')
    await new Promise(resolve => setTimeout(resolve, 2000))

    const storeys = Number(answers.find(a => a.stepId === 'storeys')?.value || 1) as 1 | 2
    const projectType = (answers.find(a => a.stepId === 'project-type')?.value as string) || 'new-build'

    const newQuote: Quote = {
      id: `quote-${Date.now()}`,
      projectName: `${projectType.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} - ${measurements.floorSqMetres}m\u00b2`,
      clientName: 'CCC Group',
      address: 'Sydney NSW',
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      status: 'draft',
      totalAmount: 0,
      currency: 'AUD',
      items: [],
      metadata: {
        windClass: null,
        soilType: null,
        roofMaterial: null,
        buildingClass: '1a',
        totalFloorArea: measurements.floorSqMetres,
        storeys,
      },
    }

    setCurrentQuote(newQuote)
    setPhase('done')
  }

  // === REVIEW PHASE: editable measurements before quote generation ===
  if (phase === 'review') {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Review Extracted Data</h1>
          <p className="text-slate-500 mt-1">Edit any values below before generating your quote. These measurements drive the entire quote.</p>
        </div>

        {/* Editable measurement cards */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Pencil className="w-4 h-4 text-amber-500" /> Key Measurements
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Wall Lineal Metres (LM)</label>
              <input
                type="number"
                value={measurements.wallLinealMetres || ''}
                onChange={e => setMeasurements(prev => ({ ...prev, wallLinealMetres: Number(e.target.value) || 0 }))}
                className="w-full px-4 py-3 text-lg font-semibold border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                placeholder="0"
              />
              <p className="text-xs text-slate-400 mt-1">Total lineal metres of all walls (external + internal)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Floor Area (m{'\u00b2'})</label>
              <input
                type="number"
                value={measurements.floorSqMetres || ''}
                onChange={e => setMeasurements(prev => ({ ...prev, floorSqMetres: Number(e.target.value) || 0 }))}
                className="w-full px-4 py-3 text-lg font-semibold border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                placeholder="0"
              />
              <p className="text-xs text-slate-400 mt-1">Total ground floor area</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Roof Area (m{'\u00b2'})</label>
              <input
                type="number"
                value={measurements.roofSqMetres || ''}
                onChange={e => setMeasurements(prev => ({ ...prev, roofSqMetres: Number(e.target.value) || 0 }))}
                className="w-full px-4 py-3 text-lg font-semibold border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                placeholder="0"
              />
              <p className="text-xs text-slate-400 mt-1">Including pitch and eaves</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Steel Tonnage (T)</label>
              <input
                type="number"
                step="0.01"
                value={measurements.steelTonnage || ''}
                onChange={e => setMeasurements(prev => ({ ...prev, steelTonnage: Number(e.target.value) || 0 }))}
                className="w-full px-4 py-3 text-lg font-semibold border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                placeholder="0"
              />
              <p className="text-xs text-slate-400 mt-1">Total steel required (beams, lintels, posts)</p>
            </div>
          </div>
        </div>

        {/* Additional context to steer the AI */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Additional Context</h2>
          <p className="text-sm text-slate-500 mb-3">Add any notes to steer the quote. Site conditions, specific requirements, material preferences, access issues, anything the AI should factor in.</p>
          <textarea
            value={additionalContext}
            onChange={e => setAdditionalContext(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm"
            placeholder="e.g. Difficult access - crane required. Tile roof, N2 wind zone. Client wants MGP12 throughout. Second floor has cathedral ceiling..."
          />
        </div>

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
                  {pf.extractedData?.confidence && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      pf.extractedData.confidence === 'high' ? 'bg-green-100 text-green-700' :
                      pf.extractedData.confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>{String(pf.extractedData.confidence)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button onClick={() => { setPhase('wizard'); setCurrentStep(STEPS.length - 1) }} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
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

  // === GENERATING PHASE ===
  if (phase === 'generating') {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
          <span className="text-3xl">&#9881;&#65039;</span>
        </div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">Generating Your Quote</h2>
        <p className="text-slate-500 mb-6">Using your measurements and context to build the quote...</p>
        <div className="max-w-xs mx-auto">
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full animate-loading" style={{ animationDuration: '2s', animationIterationCount: 'infinite' }} />
          </div>
        </div>
        <div className="mt-6 text-sm text-slate-400 space-y-1">
          <p>Walls: {measurements.wallLinealMetres} LM | Floor: {measurements.floorSqMetres} m{'\u00b2'} | Roof: {measurements.roofSqMetres} m{'\u00b2'} | Steel: {measurements.steelTonnage} T</p>
        </div>
      </div>
    )
  }

  // === DONE PHASE ===
  if (phase === 'done') {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">Quote Generated</h2>
        <p className="text-slate-500 mb-6">Your quote is ready for review.</p>
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => { setPhase('wizard'); setCurrentStep(0); setCurrentPage('view-quote') }} className="px-6 py-3 bg-amber-500 text-slate-900 font-semibold rounded-lg hover:bg-amber-400 transition-colors">
            View Quote
          </button>
          <button onClick={() => setCurrentPage('dashboard')} className="px-6 py-3 border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors">
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // === WIZARD PHASE (steps 1-3) ===
  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-sm text-slate-500 mb-2">
          <span>Step {currentStep + 1} of {STEPS.length}</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-amber-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((step, index) => (
          <button
            key={step.id}
            onClick={() => index <= currentStep && setCurrentStep(index)}
            className={`w-8 h-8 rounded-full text-sm font-medium transition-all duration-200 ${
              index === currentStep ? 'bg-amber-500 text-slate-900' :
              index < currentStep ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-400'
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
          {currentStepData.description && <p className="text-slate-500 mb-6">{currentStepData.description}</p>}

          {currentStepData.type === 'single-select' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentStepData.options?.map(option => (
                <button
                  key={option.id}
                  onClick={() => handleAnswer(option.value)}
                  className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                    currentAnswer?.value === option.value ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className="font-medium text-slate-900">{option.label}</p>
                  {option.description && <p className="text-sm text-slate-500 mt-1">{option.description}</p>}
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

        {/* Nav */}
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button onClick={handleBack} disabled={currentStep === 0} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${currentStep === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-200'}`}>
            &larr; Back
          </button>
          <button onClick={handleNext} disabled={!isStepAnswered} className={`px-6 py-2 font-medium text-sm rounded-lg transition-colors ${isStepAnswered ? 'bg-amber-500 text-slate-900 hover:bg-amber-400' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
            {currentStep === STEPS.length - 1 ? 'Review & Edit Measurements \u2192' : 'Continue \u2192'}
          </button>
        </div>
      </div>
    </div>
  )
}

// === PLAN UPLOAD STEP ===

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
        <PlanSlot label="Architectural Plans" description="Floor plans, elevations, sections" icon="A" colour="blue" planFile={archFile || null} inputRef={archRef} onFileSelect={(f) => onFileSelect(f, 'architectural')} onRemove={() => onRemove('architectural')} />
        <PlanSlot label="Structural Plans" description="Bracing, tie-downs, lintels, steel" icon="S" colour="purple" planFile={structFile || null} inputRef={structRef} onFileSelect={(f) => onFileSelect(f, 'structural')} onRemove={() => onRemove('structural')} />
      </div>

      {/* Show extracted summary */}
      {extractionComplete && (measurements.wallLinealMetres > 0 || measurements.floorSqMetres > 0) && (
        <div className="bg-green-50 rounded-xl border border-green-200 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-green-900 mb-3">Extraction Complete</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white rounded-lg p-3 border border-green-100">
                  <p className="text-xs text-green-600 mb-1">Walls</p>
                  <p className="text-xl font-bold text-slate-900">{measurements.wallLinealMetres} <span className="text-sm font-medium text-slate-500">LM</span></p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-green-100">
                  <p className="text-xs text-green-600 mb-1">Floor</p>
                  <p className="text-xl font-bold text-slate-900">{measurements.floorSqMetres} <span className="text-sm font-medium text-slate-500">m{'\u00b2'}</span></p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-green-100">
                  <p className="text-xs text-green-600 mb-1">Roof</p>
                  <p className="text-xl font-bold text-slate-900">{measurements.roofSqMetres} <span className="text-sm font-medium text-slate-500">m{'\u00b2'}</span></p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-green-100">
                  <p className="text-xs text-green-600 mb-1">Steel</p>
                  <p className="text-xl font-bold text-slate-900">{measurements.steelTonnage} <span className="text-sm font-medium text-slate-500">T</span></p>
                </div>
              </div>
              <p className="text-xs text-green-700 mt-3">You can edit these values on the next screen before generating your quote.</p>
            </div>
          </div>
        </div>
      )}

      {planFiles.some(p => p.extracting) && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <div className="space-y-2 text-sm text-amber-700">
            <p className="animate-pulse">Reading PDF and extracting measurements...</p>
            <p className="animate-pulse" style={{ animationDelay: '0.5s' }}>This may take 1-2 minutes for large plans...</p>
          </div>
        </div>
      )}

      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 text-sm mb-2">How it works</h4>
        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>Upload architectural plans (wall LM, floor m{'\u00b2'}, roof m{'\u00b2'})</li>
          <li>Upload structural plans (steel tonnage, bracing, lintels)</li>
          <li>Review and edit extracted measurements</li>
          <li>Add context to steer the quote</li>
        </ol>
      </div>
    </div>
  )
}

function PlanSlot({
  label, description, icon, colour, planFile, inputRef, onFileSelect, onRemove,
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
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', accent: 'bg-blue-100', dragBg: 'bg-blue-50 border-blue-400' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600', accent: 'bg-purple-100', dragBg: 'bg-purple-50 border-purple-400' },
  }
  const c = colourMap[colour]

  if (planFile) {
    const isProcessing = planFile.uploading || planFile.extracting
    return (
      <div className={`rounded-xl border-2 ${planFile.extractedData ? 'border-green-200 bg-green-50/30' : c.border} p-4`}>
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 ${c.accent} rounded-lg flex items-center justify-center flex-shrink-0`}>
            <span className={`font-bold text-sm ${c.text}`}>{icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-500 mb-0.5">{label}</p>
            <p className="font-medium text-slate-900 truncate text-sm">{planFile.file.name}</p>
            <div className="flex items-center gap-2 text-xs mt-1">
              <span className="text-slate-400">{(planFile.file.size / 1024 / 1024).toFixed(1)} MB</span>
              {planFile.uploading && <span className="text-blue-600 font-medium flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</span>}
              {planFile.extracting && <span className="text-amber-600 font-medium flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Extracting...</span>}
              {planFile.extractedData && <span className="text-green-600 font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Done</span>}
              {planFile.error && <span className="text-red-600 font-medium">{planFile.error}</span>}
            </div>
            {isProcessing && (
              <div className="h-1 bg-slate-100 rounded-full mt-2 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${planFile.uploading ? 'bg-blue-500 w-1/2' : 'bg-amber-500 animate-pulse w-full'}`} />
              </div>
            )}
          </div>
          {!isProcessing && (
            <button onClick={onRemove} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) onFileSelect(f) }}
      onClick={() => inputRef.current?.click()}
      className={`rounded-xl border-2 border-dashed p-6 cursor-pointer transition-all duration-200 text-center ${isDragging ? c.dragBg : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'}`}
    >
      <input ref={inputRef} type="file" accept=".pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelect(f) }} className="hidden" />
      <div className={`w-12 h-12 ${c.accent} rounded-lg flex items-center justify-center mx-auto mb-3`}>
        <span className={`font-bold text-lg ${c.text}`}>{icon}</span>
      </div>
      <p className="font-medium text-slate-900 text-sm mb-1">{label}</p>
      <p className="text-xs text-slate-500 mb-3">{description}</p>
      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${c.bg} ${c.text} text-xs font-medium`}>
        <Upload className="w-3 h-3" /> Upload PDF
      </div>
    </div>
  )
}
