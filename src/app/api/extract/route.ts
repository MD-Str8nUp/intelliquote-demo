import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

// Allow up to 60s for PDF download + Claude analysis
export const maxDuration = 60

const SUPABASE_URL = 'https://inrzfybiqkdkmyflufci.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlucnpmeWJpcWtka215Zmx1ZmNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzMTI4NzksImV4cCI6MjA3NTg4ODg3OX0.WWIxW6So9pIwI2gnwtMNbYAGa9XLyxkB0wfJrdeb4Sc'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY
  )
}

function getAnthropic() {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })
}

const BUCKET = 'intelliquote-plans'

const ARCHITECTURAL_PROMPT = `You are an expert Australian construction plan reader. You are analysing an architectural PDF plan (floor plans, elevations, sections) for a residential timber framing project.

Extract the following measurements as accurately as possible from the plan drawings and annotations:

Return ONLY a valid JSON object with these fields:
{
  "wallLinealMetres": <total lineal metres of all external + internal walls - sum every wall length you can identify>,
  "floorSqMetres": <total ground floor area in square metres>,
  "roofSqMetres": <total roof area in square metres, accounting for pitch/eaves if visible>,
  "wallSegments": <number of distinct wall segments you can count>,
  "openings": <total number of doors + windows>,
  "scale": <drawing scale if found, e.g. "1:100">,
  "confidence": <"high" if dimensions are clearly annotated, "medium" if you had to estimate some values, "low" if mostly estimated>,
  "notes": <one sentence about what you found and any limitations>
}

Rules:
- Dimensions in mm: divide by 1000 for metres (6000mm = 6m)
- Wall lineal metres = sum of ALL wall lengths (external perimeter + internal walls)
- For floor area: use stated area if shown, otherwise calculate from room dimensions
- For roof area: typically 10-20% more than floor area due to pitch and eaves
- If you can identify individual room dimensions, sum them for total floor area
- Look for dimension chains, room labels with sizes, and area schedules
- Australian standards and conventions apply (AS 1684, NCC BCA)
- Be as precise as possible - these numbers drive a construction quote`

const STRUCTURAL_PROMPT = `You are an expert Australian structural engineer reading a structural PDF plan (bracing layouts, tie-down schedules, lintel schedules, member sizes).

Extract the following from the structural drawings and schedules:

Return ONLY a valid JSON object with these fields:
{
  "bracingZones": <number of distinct bracing zones or bracing walls marked>,
  "bracingWallLM": <total lineal metres of bracing walls if measurable>,
  "lintels": <number of lintels shown in schedule or on drawings>,
  "tieDowns": <number of tie-down points marked>,
  "maxLintelSpan": <longest lintel opening span in mm if identifiable>,
  "windClassification": <wind class if stated anywhere, e.g. "N2">,
  "confidence": <"high" if schedules are clear, "medium" if partially readable, "low" if estimated>,
  "notes": <one sentence about what you found and any limitations>
}

Rules:
- Look for bracing schedules (often tabulated), tie-down schedules, lintel schedules
- Bracing walls often marked B1, B2 etc. or with kN/m ratings
- Tie-downs noted as TD1, TD2 or specific connector types (MultiGrip, etc.)
- Lintels noted with spans and member sizes (e.g. "2/90x45 MGP10 over 1800")
- Australian standards: AS 1684.2, AS 4055 (wind), AS 2870 (footings)`

export async function POST(request: NextRequest) {
  try {
    const { storagePath, planType } = await request.json()

    if (!storagePath || !planType) {
      return NextResponse.json({ error: 'Missing storagePath or planType' }, { status: 400 })
    }

    // 1. Download PDF from Supabase storage
    const supabase = getSupabase()
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(storagePath)

    if (downloadError || !fileData) {
      return NextResponse.json({ error: 'Failed to download PDF from storage' }, { status: 500 })
    }

    // 2. Convert to base64 for Claude
    const buffer = Buffer.from(await fileData.arrayBuffer())
    const base64Pdf = buffer.toString('base64')

    // 3. Send PDF directly to Claude for analysis
    const prompt = planType === 'architectural' ? ARCHITECTURAL_PROMPT : STRUCTURAL_PROMPT

    const anthropic = getAnthropic()
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64Pdf,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    })

    // 4. Parse Claude's response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({
        success: true,
        method: 'claude-pdf-vision',
        warning: 'Could not parse structured data from plan analysis',
        extractedData: null,
        rawResponse: responseText,
      })
    }

    const extractedData = JSON.parse(jsonMatch[0])

    return NextResponse.json({
      success: true,
      method: 'claude-pdf-vision',
      extractedData,
      tokensUsed: {
        input: message.usage.input_tokens,
        output: message.usage.output_tokens,
      },
    })

  } catch (error: unknown) {
    console.error('Extraction error:', error)
    const errMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Extraction failed', details: errMessage }, { status: 500 })
  }
}
