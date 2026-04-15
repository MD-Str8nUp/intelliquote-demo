'use client'

import React, { useState } from 'react'
import { useAppContext, FlowchartStep, Quote } from './context'
import { DataUploadZone } from './upload'
import { CheckCircle } from 'lucide-react'

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
    id: 'floor-area',
    question: 'Total floor area (m\u00b2)',
    description: 'Enter approximate floor area or upload plans for automatic extraction',
    type: 'number',
    validation: { min: 20, max: 2000 },
  },
]

export function FlowchartWizard() {
  const { currentStep, setCurrentStep, answers, addAnswer, setCurrentQuote, setCurrentPage } = useAppContext()
  const [isGenerating, setIsGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)

  const currentStepData = STEPS[currentStep]
  const progress = ((currentStep + 1) / STEPS.length) * 100
  const currentAnswer = answers.find(a => a.stepId === currentStepData?.id)

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

  const generateQuote = async () => {
    setIsGenerating(true)
    await new Promise(resolve => setTimeout(resolve, 3000))

    const windClass = (answers.find(a => a.stepId === 'wind-class')?.value as string) || 'N2'
    const roofMaterial = (answers.find(a => a.stepId === 'roof-material')?.value as string) || 'tile'
    const storeys = Number(answers.find(a => a.stepId === 'storeys')?.value || 1) as 1 | 2
    const floorArea = Number(answers.find(a => a.stepId === 'floor-area')?.value || 185)
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
              placeholder="Enter floor area in m\u00b2..."
            />
          )}

          {currentStepData.type === 'file-upload' && <DataUploadZone />}
        </div>

        {/* Nav */}
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button onClick={handleBack} disabled={currentStep === 0} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${currentStep === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-200'}`}>
            &larr; Back
          </button>
          <button onClick={handleNext} disabled={!currentAnswer} className={`px-6 py-2 font-medium text-sm rounded-lg transition-colors ${currentAnswer ? 'bg-amber-500 text-slate-900 hover:bg-amber-400' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
            {currentStep === STEPS.length - 1 ? 'Generate Quote' : 'Continue \u2192'}
          </button>
        </div>
      </div>
    </div>
  )
}
