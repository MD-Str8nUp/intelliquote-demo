import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

// Allow up to 300s (5 min) for large PDF download + Claude analysis
export const maxDuration = 300

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

const ARCHITECTURAL_PROMPT = `You are an expert Australian construction plan reader specialising in residential timber framing. You are analysing architectural PDF plans (floor plans, elevations, sections).

Your job is to extract precise measurements with a PER-FLOOR BREAKDOWN. Accuracy is critical — these numbers drive a real construction quote worth tens of thousands of dollars.

MEASUREMENT EXTRACTION RULES:
- Dimensions in mm: divide by 1000 for metres (6000mm = 6.0m)
- List EVERY wall dimension you can read before summing. Do not skip any.
- For each room, state dimensions and area, then sum for total floor area.
- If dimension chains exist on the drawings, follow them precisely end-to-end.
- If an area schedule exists on the plan, use those numbers as they are the architect's calculated values.
- External wall perimeter = sum of all external wall lengths around the building footprint.
- Internal walls = sum of all partition wall lengths shown on the floor plan.
- For roof area: account for pitch (typically 22.5-25 degrees for tile, 10-15 for metal) and add eave overhangs (typically 450-600mm each side). Roof area = floor area / cos(pitch angle) + eave additions.
- For multi-storey: measure EACH floor separately. Ground and first floor may have different footprints.
- IMPORTANT: show your working in workingNotes so the user can verify every number.

Return ONLY a valid JSON object with this EXACT structure:
{
  "groundFloor": {
    "perimeterWallLM": <external perimeter in metres>,
    "internalWallLM": <internal wall total in metres>,
    "totalWallLM": <perimeter + internal>,
    "areaM2": <ground floor area>,
    "wallBreakdown": "<list each wall: North 12.5m, South 12.5m, East 8.2m, West 8.2m, etc>"
  },
  "firstFloor": {
    "perimeterWallLM": <or 0 if single storey>,
    "internalWallLM": <or 0>,
    "totalWallLM": <or 0>,
    "areaM2": <or 0>,
    "wallBreakdown": "<or 'Single storey - no first floor'>"
  },
  "roofSqMetres": <roof area with pitch and eaves accounted for>,
  "storeys": <1 or 2>,
  "openings": <total number of doors + windows across all floors>,
  "scale": <drawing scale if found, e.g. "1:100">,
  "workingNotes": "<SHOW ALL YOUR ARITHMETIC: list every dimension found, how you summed perimeters, how you calculated areas, pitch factor used for roof. e.g. 'Ground floor perimeter: North wall 12.5m + South wall 12.5m + East wall 8.2m + West wall 8.2m = 41.4m. Internal walls: Bedroom 1/2 partition 3.6m + Kitchen/Living 4.1m + ... = 18.2m. Floor area: 12.5 x 8.2 = 102.5m2 (or sum of rooms: Living 4.5x5.2=23.4 + Bed1 3.6x4.0=14.4 + ...). Roof: 102.5 / cos(22.5°) + eaves = 118.3m2'>",
  "confidence": "high|medium|low",
  "notes": "<any limitations, unclear dimensions, assumptions made>"
}

Australian standards and conventions apply (AS 1684, NCC BCA). Be as precise as possible.`

const STRUCTURAL_PROMPT = `You are an expert Australian structural engineer reading structural PDF plans (bracing layouts, tie-down schedules, lintel schedules, member sizes, steel beam details).

Extract the following from the structural drawings and schedules with maximum precision.

STEEL EXTRACTION RULES:
- Look for ALL steel member designations: UB (Universal Beam), UC (Universal Column), PFC (Parallel Flange Channel), SHS (Square Hollow Section), RHS (Rectangular Hollow Section), CHS (Circular Hollow Section), EA (Equal Angle).
- For each steel member: note the designation, length/span, and calculate weight. e.g. 200UB25 means ~25kg/m, so a 4.2m beam = 25 x 4.2 = 105kg.
- Sum ALL steel members for total tonnage (convert kg to tonnes: divide by 1000).
- Include lintels if they are steel (e.g. steel angle lintels, not timber).
- Include steel posts, columns, and connectors if specified.

Return ONLY a valid JSON object with these fields:
{
  "bracingZones": <number of distinct bracing zones or bracing walls marked>,
  "bracingWallLM": <total lineal metres of bracing walls if measurable>,
  "lintels": <number of lintels shown in schedule or on drawings>,
  "tieDowns": <number of tie-down points marked>,
  "steelTonnage": <total steel tonnage in metric tonnes, calculated from member schedules>,
  "steelBreakdown": "<list each steel member with calculation: '200UB25 x 4.2m = 105kg, 150PFC x 3.0m = 54kg, 90x90x6 SHS post x 2.7m x 2 = 27.4kg, ...' then state total>",
  "maxLintelSpan": <longest lintel opening span in mm if identifiable>,
  "windClassification": <wind class if stated anywhere, e.g. "N2">,
  "confidence": "high|medium|low",
  "notes": "<limitations, assumptions, anything unclear>"
}

Rules:
- Look for bracing schedules (often tabulated), tie-down schedules, lintel schedules
- Bracing walls often marked B1, B2 etc. or with kN/m ratings
- Tie-downs noted as TD1, TD2 or specific connector types (MultiGrip, etc.)
- Lintels noted with spans and member sizes (e.g. "2/90x45 MGP10 over 1800")
- Common steel weights: 150UB14=14kg/m, 200UB18=18kg/m, 200UB25=25kg/m, 250UB26=26kg/m, 310UB32=32kg/m, 150PFC=17.7kg/m, 200PFC=22.9kg/m, 250PFC=35.5kg/m
- Australian standards: AS 1684.2, AS 4055 (wind), AS 2870 (footings), AS 4100 (steel)`

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
      max_tokens: 4096,
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

    // Extract JSON from response (handle potential markdown code fences)
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

    const rawData = JSON.parse(jsonMatch[0])

    // 5. Map the nested response to our flat interface for the frontend
    if (planType === 'architectural') {
      // Map per-floor breakdown to the expanded ExtractedMeasurements shape
      const groundFloor = rawData.groundFloor || {}
      const firstFloor = rawData.firstFloor || {}

      const groundFloorWallLM = groundFloor.totalWallLM || 0
      const firstFloorWallLM = firstFloor.totalWallLM || 0
      const groundFloorAreaM2 = groundFloor.areaM2 || 0
      const firstFloorAreaM2 = firstFloor.areaM2 || 0

      const extractedData = {
        groundFloorWallLM,
        firstFloorWallLM,
        wallLinealMetres: groundFloorWallLM + firstFloorWallLM,
        groundFloorAreaM2,
        firstFloorAreaM2,
        floorSqMetres: groundFloorAreaM2 + firstFloorAreaM2,
        roofSqMetres: rawData.roofSqMetres || 0,
        storeys: rawData.storeys || 1,
        openings: rawData.openings || 0,
        scale: rawData.scale || null,
        confidence: rawData.confidence || 'low',
        notes: rawData.notes || '',
        workingNotes: rawData.workingNotes || '',
        // Pass through per-floor breakdowns for the review UI
        groundFloorBreakdown: {
          perimeterWallLM: groundFloor.perimeterWallLM || 0,
          internalWallLM: groundFloor.internalWallLM || 0,
          totalWallLM: groundFloorWallLM,
          areaM2: groundFloorAreaM2,
          wallBreakdown: groundFloor.wallBreakdown || '',
        },
        firstFloorBreakdown: {
          perimeterWallLM: firstFloor.perimeterWallLM || 0,
          internalWallLM: firstFloor.internalWallLM || 0,
          totalWallLM: firstFloorWallLM,
          areaM2: firstFloorAreaM2,
          wallBreakdown: firstFloor.wallBreakdown || '',
        },
      }

      return NextResponse.json({
        success: true,
        method: 'claude-pdf-vision',
        planType: 'architectural',
        extractedData,
        tokensUsed: {
          input: message.usage.input_tokens,
          output: message.usage.output_tokens,
        },
      })
    }

    // Structural plan response - pass through with steel breakdown
    const extractedData = {
      ...rawData,
      steelTonnage: rawData.steelTonnage || 0,
      steelBreakdown: rawData.steelBreakdown || '',
    }

    return NextResponse.json({
      success: true,
      method: 'claude-pdf-vision',
      planType: 'structural',
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
