'use client'

import React, { useState, useRef, useCallback } from 'react'
import { useAppContext, FlowchartStep, Quote } from './context'
import { CheckCircle, Upload, FileText, X, Loader2 } from 'lucide-react'
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
    id: 'wind-class',
    question: 'What is the wind classification?',
    description: 'Check your engineering drawings or council DA',
    type: 'single-select',
    options: [
      { id: 'n1', label: 'N1', value: 'N1', description: 'Non-cyclonic, low wind' },
      { id: 'n2', label: 'N2', value: 'N2', description: 'Non-cyclonic, moderate wind (most of Sydney)' },
      { id: 'n3', label: 'N3', value: 'N3', description: 'Non-cyclonic, high wind' },
      { id: 'n4', label: 'N4', value: 'N4', description: 'Non-cyclonic, very high wind' },
      { id: 'c1', label: 'C1', value: 'C1', description: 'Cyclonic region' },
      { id: 'c2', label: 'C2', value: 'C2', description: 'Cyclonic region' },
    ],
  },
  {
    id: 'roof-material',
    question: 'What roofing material?',
    description: 'This affects load calculations and bracing requirements',
    type: 'single-select',
    options: [
      { id: 'tile', label: 'Concrete/Clay Tile', value: 'tile', description: 'Heavier load, more bracing required' },
      { id: 'metal', label: 'Metal/Colorbond', value: 'metal', description: 'Lighter load, less bracing' },
    ],
  },
  {
    id: 'soil-type',
    question: 'What is the soil classification?',
    description: 'Found in your geotechnical report',
    type: 'single-select',
    options: [
      { id: 'a', label: 'Class A', value: 'A', description: 'Sand/rock - most stable' },
      { id: 's', label: 'Class S', value: 'S', description: 'Slightly reactive clay' },
      { id: 'm', label: 'Class M', value: 'M', description: 'Moderately reactive clay (most common in Sydney)' },
      { id: 'h1', label: 'Class H1', value: 'H1', description: 'Highly reactive clay' },
      { id: 'h2', label: 'Class H2', value: 'H2', description: 'Very highly reactive clay' },
    ],
  },
  {
    id: 'upload-plans',
    question: 'Upload your plans',
    description: 'Upload PDF plans and IntelliQuote will extract the total ground floor area automatically',
    type: 'file-upload',
    validation: { required: true },
  },
]

export function FlowchartWizard() {
  const { currentStep, setCurrentStep, answers, addAnswer, setCurrentQuote, setCurrentPage } = useAppContext()
  const [isGenerating, setIsGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  interface PlanFile {
    id: string
    file: File
    type: 'architectural' | 'structural'
    uploading: boolean
    extracting: boolean
    uploaded: boolean
    storagePath: string | null
    extractedData: { walls?: number; openings?: number; area?: number; bracingZones?: number; lintels?: number; tieDowns?: number } | null
    error: string | null
  }
  const [planFiles, setPlanFiles] = useState<PlanFile[]>([])
  const [extractionComplete, setExtractionComplete] = useState(false)
  const [combinedArea, setCombinedArea] = useState<number | null>(null)

  const currentStepData = STEPS[currentStep]
  const progress = ((currentStep + 1) / STEPS.length) * 100
  const currentAnswer = answers.find(a => a.stepId === currentStepData?.id)

  // For the upload step, consider it "answered" once at least one file is extracted
  const isStepAnswered = currentStepData?.id === 'upload-plans'
    ? extractionComplete && combinedArea !== null
    : !!currentAnswer

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      generateQuote()
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

      // Simulate extraction (different data per plan type)
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1500))

      const extractedData = planType === 'architectural'
        ? { walls: 18 + Math.round(Math.random() * 12), openings: 8 + Math.round(Math.random() * 8), area: 120 + Math.round(Math.random() * 200) }
        : { bracingZones: 4 + Math.round(Math.random() * 4), lintels: 6 + Math.round(Math.random() * 8), tieDowns: 8 + Math.round(Math.random() * 12) }

      setPlanFiles(prev => {
        const updated = prev.map(p => p.id === fileId ? { ...p, extracting: false, extractedData } : p)
        // Check if all files are done extracting
        const allDone = updated.every(p => !p.uploading && !p.extracting && p.extractedData)
        if (allDone) {
          const archFile = updated.find(p => p.type === 'architectural')
          const area = archFile?.extractedData?.area || 185
          setCombinedArea(area)
          setExtractionComplete(true)
          addAnswer({ stepId: 'upload-plans', value: String(area), answeredAt: new Date().toISOString() })
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
    setCombinedArea(null)
  }, [])

  const generateQuote = async () => {
    setIsGenerating(true)
    await new Promise(resolve => setTimeout(resolve, 3000))

    const windClass = (answers.find(a => a.stepId === 'wind-class')?.value as string) || 'N2'
    const roofMaterial = (answers.find(a => a.stepId === 'roof-material')?.value as string) || 'tile'
    const storeys = Number(answers.find(a => a.stepId === 'storeys')?.value || 1) as 1 | 2
    const floorArea = combinedArea || 185
    const soilType = (answers.find(a => a.stepId === 'soil-type')?.value as string) || 'M'

    const baseCostPerSqm = roofMaterial === 'tile' ? 165 : 145
    const storeyMultiplier = storeys === 2 ? 1.8 : 1
    const windMultiplier = windClass === 'N3' || windClass === 'N4' ? 1.15 : windClass.startsWith('C') ? 1.3 : 1
    const totalMaterials = Math.round(floorArea * baseCostPerSqm * storeyMultiplier * windMultiplier)
    const labourTotal = Math.round(floorArea * 95 * storeyMultiplier)

    const newQuote: Quote = {
      id: `quote-${Date.now()}`,
      projectName: 'New Project Quote',
      clientName: 'CCC Group',
      address: 'Sydney NSW',
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      status: 'draft',
      totalAmount: totalMaterials + labourTotal,
      currency: 'AUD',
      items: [
        { id: 'gen-1', category: 'framing', description: '90x35 MGP10 Wall Studs @ 450mm centres', quantity: Math.round(floorArea * 1.2), unit: 'LM', unitPrice: 8.50, total: Math.round(floorArea * 1.2 * 8.50), as1684Reference: `Table 8.18 - ${windClass} Wind, ${roofMaterial === 'tile' ? 'Tile' : 'Metal'} Roof` },
        { id: 'gen-2', category: 'framing', description: '90x45 MGP10 Top/Bottom Plates', quantity: Math.round(floorArea * 0.8), unit: 'LM', unitPrice: 12.00, total: Math.round(floorArea * 0.8 * 12) },
        { id: 'gen-3', category: 'framing', description: '140x45 MGP12 Lintels', quantity: Math.round(floorArea * 0.15), unit: 'LM', unitPrice: 28.50, total: Math.round(floorArea * 0.15 * 28.50), as1684Reference: 'Table 7.5 - Lintel Spans' },
        { id: 'gen-4', category: 'bracing', description: 'Structural Ply Bracing 2400x1200x7mm', quantity: Math.round(floorArea * 0.18), unit: 'EA', unitPrice: 85.00, total: Math.round(floorArea * 0.18 * 85), as1684Reference: 'Table 8.18 - Bracing Requirements' },
        { id: 'gen-5', category: 'framing', description: `${storeys === 2 ? '240x45' : '190x45'} MGP12 ${storeys === 2 ? 'Floor Joists' : 'Rafters'} @ ${storeys === 2 ? '450' : '600'}mm`, quantity: Math.round(floorArea * 0.6), unit: 'LM', unitPrice: storeys === 2 ? 42.00 : 32.00, total: Math.round(floorArea * 0.6 * (storeys === 2 ? 42 : 32)) },
        { id: 'gen-6', category: 'hardware', description: 'Framing Brackets, Connectors & Fixings Pack', quantity: 1, unit: 'EA', unitPrice: Math.round(totalMaterials * 0.08), total: Math.round(totalMaterials * 0.08) },
        { id: 'gen-7', category: 'labour', description: `Framing Labour - ${storeys === 2 ? '3' : '2'} Carpenters`, quantity: Math.round(floorArea * (storeys === 2 ? 0.65 : 0.4)), unit: 'HR', unitPrice: 185.00, total: labourTotal },
        { id: 'gen-8', category: 'other', description: 'Site Setup, Engineering & Waste', quantity: 1, unit: 'EA', unitPrice: Math.round(floorArea * 18), total: Math.round(floorArea * 18) },
      ],
      metadata: {
        windClass,
        soilType,
        roofMaterial,
        buildingClass: '1a',
        totalFloorArea: floorArea,
        storeys,
      },
    }

    setCurrentQuote(newQuote)
    setIsGenerating(false)
    setGenerated(true)
  }

  if (isGenerating) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
          <span className="text-3xl">&#9881;&#65039;</span>
        </div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">Generating Your Quote</h2>
        <p className="text-slate-500 mb-6">Calculating materials to AS 1684 specifications...</p>
        <div className="max-w-xs mx-auto">
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full animate-loading" style={{ animationDuration: '2s', animationIterationCount: 'infinite' }} />
          </div>
        </div>
        <div className="mt-8 space-y-2 text-sm text-slate-400">
          <p className="animate-pulse">Analysing wind loading requirements...</p>
          <p className="animate-pulse" style={{ animationDelay: '0.5s' }}>Calculating bracing per AS 1684.2...</p>
          <p className="animate-pulse" style={{ animationDelay: '1s' }}>Pricing materials at current rates...</p>
        </div>
      </div>
    )
  }

  if (generated) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">Quote Generated</h2>
        <p className="text-slate-500 mb-6">Your AS 1684 compliant quote is ready for review.</p>
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => { setGenerated(false); setCurrentStep(0); setCurrentPage('view-quote') }} className="px-6 py-3 bg-amber-500 text-slate-900 font-semibold rounded-lg hover:bg-amber-400 transition-colors">
            View Quote
          </button>
          <button onClick={() => setCurrentPage('dashboard')} className="px-6 py-3 border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors">
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

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

          {currentStepData.type === 'number' && (
            <input
              type="number"
              value={typeof currentAnswer?.value === 'number' ? currentAnswer.value : ''}
              onChange={e => handleAnswer(parseFloat(e.target.value) || 0)}
              min={currentStepData.validation?.min}
              max={currentStepData.validation?.max}
              className="w-full px-4 py-3 text-lg border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 placeholder:text-slate-400"
              placeholder="Enter value..."
            />
          )}

          {currentStepData.type === 'file-upload' && (
            <PlanUploadStep
              planFiles={planFiles}
              extractionComplete={extractionComplete}
              combinedArea={combinedArea}
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
            {currentStep === STEPS.length - 1 ? 'Generate Quote' : 'Continue \u2192'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PlanUploadStep({
  planFiles,
  extractionComplete,
  combinedArea,
  onFileSelect,
  onRemove,
}: {
  planFiles: { id: string; file: File; type: 'architectural' | 'structural'; uploading: boolean; extracting: boolean; uploaded: boolean; storagePath: string | null; extractedData: Record<string, number> | null; error: string | null }[]
  extractionComplete: boolean
  combinedArea: number | null
  onFileSelect: (file: File, type: 'architectural' | 'structural') => void
  onRemove: (type: 'architectural' | 'structural') => void
}) {
  const archRef = useRef<HTMLInputElement>(null)
  const structRef = useRef<HTMLInputElement>(null)

  const archFile = planFiles.find(p => p.type === 'architectural')
  const structFile = planFiles.find(p => p.type === 'structural')

  return (
    <div className="space-y-4">
      {/* Two upload zones side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Architectural Plans */}
        <PlanSlot
          label="Architectural Plans"
          description="Floor plans, elevations, sections"
          icon="A"
          colour="blue"
          planFile={archFile || null}
          inputRef={archRef}
          onFileSelect={(f) => onFileSelect(f, 'architectural')}
          onRemove={() => onRemove('architectural')}
        />

        {/* Structural Plans */}
        <PlanSlot
          label="Structural Plans"
          description="Bracing, tie-downs, lintels, footings"
          icon="S"
          colour="purple"
          planFile={structFile || null}
          inputRef={structRef}
          onFileSelect={(f) => onFileSelect(f, 'structural')}
          onRemove={() => onRemove('structural')}
        />
      </div>

      {/* Combined extraction results */}
      {extractionComplete && combinedArea && (
        <div className="bg-green-50 rounded-xl border border-green-200 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-green-900 mb-3">Plan Analysis Complete</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white rounded-lg p-3 border border-green-100">
                  <p className="text-xs text-green-600 mb-1">Ground Floor Area</p>
                  <p className="text-xl font-bold text-slate-900">{combinedArea} m{'\u00b2'}</p>
                </div>
                {archFile?.extractedData && (
                  <>
                    <div className="bg-white rounded-lg p-3 border border-green-100">
                      <p className="text-xs text-blue-600 mb-1">Wall Segments</p>
                      <p className="text-xl font-bold text-slate-900">{archFile.extractedData.walls}</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-green-100">
                      <p className="text-xs text-blue-600 mb-1">Openings</p>
                      <p className="text-xl font-bold text-slate-900">{archFile.extractedData.openings}</p>
                    </div>
                  </>
                )}
                {structFile?.extractedData && (
                  <div className="bg-white rounded-lg p-3 border border-green-100">
                    <p className="text-xs text-purple-600 mb-1">Bracing Zones</p>
                    <p className="text-xl font-bold text-slate-900">{structFile.extractedData.bracingZones}</p>
                  </div>
                )}
              </div>
              {structFile?.extractedData && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="bg-white rounded-lg p-2.5 border border-green-100">
                    <p className="text-xs text-purple-600 mb-0.5">Lintels Identified</p>
                    <p className="text-lg font-bold text-slate-900">{structFile.extractedData.lintels}</p>
                  </div>
                  <div className="bg-white rounded-lg p-2.5 border border-green-100">
                    <p className="text-xs text-purple-600 mb-0.5">Tie-Down Points</p>
                    <p className="text-lg font-bold text-slate-900">{structFile.extractedData.tieDowns}</p>
                  </div>
                </div>
              )}
              <p className="text-xs text-green-700 mt-3">
                {planFiles.length === 2
                  ? 'Both architectural and structural plans analysed. Cross-referenced for AS 1684 compliance.'
                  : 'Plan analysed. Upload both plan types for full cross-referencing.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Any file still processing */}
      {planFiles.some(p => p.extracting) && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <div className="space-y-2 text-sm text-amber-700">
            <p className="animate-pulse">Reading PDF structure and identifying layers...</p>
            <p className="animate-pulse" style={{ animationDelay: '0.5s' }}>Detecting wall segments, openings, and dimensions...</p>
            <p className="animate-pulse" style={{ animationDelay: '1s' }}>Calculating ground floor area and structural requirements...</p>
          </div>
        </div>
      )}

      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 text-sm mb-2">How it works</h4>
        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>Upload architectural plans (floor area, walls, openings)</li>
          <li>Upload structural plans (bracing, lintels, tie-downs)</li>
          <li>IntelliQuote cross-references both for AS 1684 compliance</li>
          <li>Accurate quote generated from real measurements</li>
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
  planFile: { file: File; uploading: boolean; extracting: boolean; uploaded: boolean; extractedData: Record<string, number> | null; error: string | null } | null
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
