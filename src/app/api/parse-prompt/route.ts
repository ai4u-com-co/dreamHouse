import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import * as EC from '@/modules/exterior/constants';
import * as IC from '@/modules/interior/constants';
import * as SC from '@/modules/shared/constants';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { textPrompt, mode } = await req.json();

    if (!textPrompt) {
      return NextResponse.json({ message: 'Missing textPrompt' }, { status: 400 });
    }

    const openaiApiKey = req.headers.get('x-openai-api-key') || process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        { message: 'OpenAI API Key is missing.' },
        { status: 401 }
      );
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });

    let systemInstruction = "";

    if (mode === 'exterior') {
      systemInstruction = `
You are an expert architect assistant. Parse the user's natural language request describing an exterior house rendering and map it to the structured parameter fields.
Return a JSON object with any of the following keys if they are mentioned or inferred in the text:

- "projectType" (string) - MUST be one of: ${JSON.stringify(EC.PROJECT_TYPES)}
- "mood" (string) - MUST be one of: ${JSON.stringify(SC.MOODS)}
- "architecturalStyles" (array of strings, max 2) - MUST match elements of: ${JSON.stringify(SC.STYLES)}
- "architect" (array of strings, max 2) - MUST match elements of: ${JSON.stringify(SC.ARCHITECTS)}
- "city" (string) - Free text region/city (e.g. "Kyoto", "Oslo")
- "environment" (string) - MUST be one of: ${JSON.stringify(EC.ENVIRONMENTS)}
- "climate" (string) - MUST be one of: ${JSON.stringify(EC.CLIMATES)}
- "waterBody" (string) - MUST be one of: ${JSON.stringify(EC.WATER_BODIES)}
- "weatherCondition" (string) - MUST be one of: ${JSON.stringify(EC.WEATHER_CONDITIONS)}
- "size" (string) - The size of the building in square meters as numeric digits only (e.g., "250", "150"). If the user mentions "grande" or "pequeña", estimate a representative number (e.g. "400" or "100").
- "levels" (number) - Number of floors/levels (inferred or specified)
- "roofType" (string) - MUST be one of: ${JSON.stringify(EC.ROOF_TYPES)}
- "layoutType" (string) - MUST be one of: ${JSON.stringify(EC.LAYOUT_TYPES)}
- "parkingType" (string) - MUST be one of: ${JSON.stringify(EC.PARKING_TYPES)}
- "socialAreas" (array of strings) - MUST match elements of: ${JSON.stringify(EC.SOCIAL_AREAS)}
- "vegetation" (array of strings, max 3) - MUST match elements of: ${JSON.stringify(EC.VEGETATION)}
- "exteriorElements" (array of strings, max 5) - MUST match elements of: ${JSON.stringify(EC.EXTERIOR_ELEMENTS)}
- "materials" (array of strings, max 3) - MUST match elements of: ${JSON.stringify(EC.MATERIALS)}
- "finishLevel" (string) - MUST be one of: ${JSON.stringify(EC.FINISH_LEVELS)}
- "colorPalette" (array of strings, max 2) - MUST match elements of: ${JSON.stringify(SC.COLORS)}
- "architecturalDetails" (array of strings) - MUST match elements of: ${JSON.stringify(EC.ARCHITECTURAL_DETAILS)}
- "cameraAngle" (string) - MUST be one of: ${JSON.stringify(SC.ANGLES)}
- "composition" (string) - MUST be one of: ${JSON.stringify(SC.COMPOSITIONS)}
- "timeOfDay" (string) - MUST be one of: ${JSON.stringify(SC.TIMES_OF_DAY)}
- "season" (string) - MUST be one of: ${JSON.stringify(SC.SEASONS)}
- "lighting" (string) - MUST be one of: ${JSON.stringify(SC.LIGHTING_TYPES)}

Rules:
1. ONLY return a valid JSON object matching the keys above.
2. If a key is not mentioned or cannot be reasonably inferred, DO NOT include it in the JSON.
3. Be highly accurate when matching option values to the lists provided. If a value is similar but not exact, map it to the exact string in the allowed lists (e.g. "hormigón" or "concreto" maps to "Concreto" or "Concreto expuesto").
`;
    } else {
      systemInstruction = `
You are an expert interior designer assistant. Parse the user's natural language request describing an interior room rendering and map it to the structured parameter fields.
Return a JSON object with any of the following keys if they are mentioned or inferred in the text:

- "roomType" (string) - MUST be one of: ${JSON.stringify(IC.ROOM_TYPES)}
- "projectType" (string) - The kind of building the room belongs to. MUST be one of: ${JSON.stringify(EC.PROJECT_TYPES)}
- "city" (string) - Free text region/city (e.g. "Kyoto", "Oslo")
- "environment" (string) - Natural surroundings seen from the room. MUST be one of: ${JSON.stringify(EC.ENVIRONMENTS)}
- "climate" (string) - MUST be one of: ${JSON.stringify(EC.CLIMATES)}
- "waterBody" (string) - MUST be one of: ${JSON.stringify(EC.WATER_BODIES)}
- "weatherCondition" (string) - MUST be one of: ${JSON.stringify(EC.WEATHER_CONDITIONS)}
- "humanContext" (string) - MUST be one of: ${JSON.stringify(SC.HUMAN_CONTEXT)}
- "furnitureStyle" (array of strings, max 2) - MUST match elements of: ${JSON.stringify(IC.FURNITURE_STYLES)}
- "interiorLighting" (array of strings, max 2) - MUST match elements of: ${JSON.stringify(IC.INTERIOR_LIGHTING_TYPES)}
- "flooringMaterial" (string) - MUST be one of: ${JSON.stringify(IC.FLOORING_MATERIALS)}
- "ceilingDetail" (string) - MUST be one of: ${JSON.stringify(IC.CEILING_DETAILS)}
- "bedrooms" (number)
- "bathrooms" (number)
- "kitchenType" (string) - MUST be one of: ${JSON.stringify(IC.KITCHEN_TYPES)}
- "livingAreaType" (string) - MUST be one of: ${JSON.stringify(IC.LIVING_AREA_TYPES)}
- "mood" (string) - MUST be one of: ${JSON.stringify(SC.MOODS)}
- "architecturalStyles" (array of strings, max 2) - MUST match elements of: ${JSON.stringify(SC.STYLES)}
- "architect" (array of strings, max 2) - MUST match elements of: ${JSON.stringify(SC.ARCHITECTS)}
- "materials" (array of strings, max 3) - MUST match elements of: ${JSON.stringify(EC.MATERIALS)}
- "finishLevel" (string) - MUST be one of: ${JSON.stringify(EC.FINISH_LEVELS)}
- "colorPalette" (array of strings, max 2) - MUST match elements of: ${JSON.stringify(SC.COLORS)}
- "cameraAngle" (string) - MUST be one of: ${JSON.stringify(SC.ANGLES)}
- "composition" (string) - MUST be one of: ${JSON.stringify(SC.COMPOSITIONS)}
- "timeOfDay" (string) - MUST be one of: ${JSON.stringify(SC.TIMES_OF_DAY)}
- "season" (string) - MUST be one of: ${JSON.stringify(SC.SEASONS)}
- "lighting" (string) - MUST be one of: ${JSON.stringify(SC.LIGHTING_TYPES)}

Rules:
1. ONLY return a valid JSON object matching the keys above.
2. If a key is not mentioned or cannot be reasonably inferred, DO NOT include it in the JSON.
3. Be highly accurate when matching option values to the lists provided. If a value is similar but not exact, map it to the exact string in the allowed lists.
`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: `Parse this: "${textPrompt}"` }
      ],
      response_format: { type: "json_object" }
    });

    const outputText = response.choices[0]?.message?.content;
    if (!outputText) {
      throw new Error("Empty response from OpenAI parser");
    }

    const parsedParams = JSON.parse(outputText.trim());
    return NextResponse.json(parsedParams);

  } catch (error: unknown) {
    console.error("Parse API Error:", error);
    const message = error instanceof Error ? error.message : "Failed to parse text prompt";
    return NextResponse.json(
      { message },
      { status: 500 }
    );
  }
}
