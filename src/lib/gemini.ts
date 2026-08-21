
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function callGeminiWithRetry(fn: () => Promise<any>, maxRetries = 8, initialDelay = 3000) {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      return await fn();
    } catch (error: any) {
      console.error("Gemini API Error details:", JSON.stringify(error, null, 2));
      // Robust detection of 429 Quota Exceeded errors
      const errorString = typeof error === 'string' ? error : (error?.message || JSON.stringify(error));
      const hasQuotaKeywords = errorString.includes('429') || 
                               errorString.includes('RESOURCE_EXHAUSTED') || 
                               errorString.includes('quota') ||
                               errorString.includes('exhausted');
      
      const isQuotaError = hasQuotaKeywords || 
                           error?.status === 429 || 
                           error?.error?.code === 429 ||
                           error?.code === 429;
      
      if (isQuotaError && retries < maxRetries - 1) {
        retries++;
        // Exponential backoff with jitter: 3s, 6s, 12s, 24s, 48s, 96s, 192s, 384s
        const delay = initialDelay * Math.pow(2, retries - 1) + Math.random() * 2000;
        console.warn(`Gemini API 429 Quota Error. Retrying in ${Math.round(delay)}ms... (Attempt ${retries}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Better error message for quota
      if (isQuotaError) {
        throw new Error("LIMITE_CUOTA: Has alcanzado el límite de solicitudes de la API de Google. Por favor, espera al menos un minuto antes de intentar de nuevo.");
      }
      
      throw error;
    }
  }
}

// Helper to safely extract text from various Gemini response formats
function getResponseText(response: any): string {
  // Use the .text property recommended by the SDK guidelines
  if (response.text !== undefined && response.text !== null) {
    return typeof response.text === 'string' ? response.text : (typeof response.text === 'function' ? response.text() : String(response.text));
  }

  const candidate = response.candidates?.[0];
  if (!candidate) return "";

  // Manual part extraction as fallback
  const parts = candidate.content?.parts || [];
  const textPart = parts.find((p: any) => p.text);
  if (textPart) return textPart.text;

  // Check finish reason if text is missing
  if (candidate.finishReason === 'SAFETY') return "[RECHAZADO POR FILTRO DE SEGURIDAD]";
  if (candidate.finishReason === 'RECITATION') return "[RECHAZADO POR DERECHOS DE AUTOR]";
  if (candidate.finishReason === 'OTHER') return "[RECHAZADO POR RAZONES DESCONOCIDAS]";
  
  return "";
}

// Helper to extract image data
function extractImageData(response: any): string | null {
  const candidates = response.candidates || [];
  if (candidates.length === 0) return null;

  for (const candidate of candidates) {
    const parts = candidate.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
  }
  return null;
}

export async function translatePrompt(prompt: string, targetLanguage: string = "English") {
  if (!prompt.trim()) return prompt;
  
  const response = await callGeminiWithRetry(() => ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: `Translate the following image generation prompt to ${targetLanguage}. Return ONLY the translated text without any explanations or quotes: "${prompt}"`,
  }));
  
  return getResponseText(response) || prompt;
}

export type AnalysisType = 'full' | 'clothing' | 'location' | 'poses' | 'lighting' | 'participants' | 'clone_prompt';

export async function analyzeImage(base64Image: string, mimeType: string, type: AnalysisType = 'full', targetLanguage: string = "Spanish") {
  const prompts: Record<AnalysisType, string> = {
    full: `Realiza un análisis exhaustivo y detallado de esta imagen en ${targetLanguage}. Cubre todos los aspectos: composición, sujetos, entorno, colores, estilo y atmósfera.`,
    clothing: `Analiza detalladamente la vestimenta de todos los participantes en la imagen en ${targetLanguage}. Describe materiales, colores, estilos, marcas sugeridas y cómo encajan en el contexto.`,
    location: `Analiza el sitio o locación de la imagen en ${targetLanguage}. Describe el entorno, la arquitectura (si hay), la naturaleza, el clima sugerido y la profundidad de campo del fondo.`,
    poses: `Analiza las poses y el lenguaje corporal de los participantes en ${targetLanguage}. Describe la dirección de la mirada, la actitud, la interacción entre sujetos y la dinámica de la escena.`,
    lighting: `Analiza la iluminación de la imagen en ${targetLanguage}. Identifica las fuentes de luz, la dureza/suavidad de las sombras, la temperatura de color y cómo la luz afecta al volumen de los objetos.`,
    participants: `Analiza a los participantes de la imagen en ${targetLanguage}. Describe sus rasgos físicos, expresiones faciales, edad aparente, etnia y su rol dentro de la composición visual.`,
    clone_prompt: `Crea un prompt técnico extremadamente detallado (en inglés) que permita clonar o replicar exactamente esta imagen con IA. Incluye detalles de cámara, iluminación, estilo artístico y composición. Al final, añade una breve explicación en ${targetLanguage} sobre por qué usaste esos términos.`
  };

  const response = await callGeminiWithRetry(() => ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: {
      parts: [
        { inlineData: { data: base64Image, mimeType } },
        { text: prompts[type] }
      ]
    }
  }));

  return getResponseText(response) || "No se pudo generar el análisis.";
}


export async function generateImageAI(prompt: string, config: { aspectRatio?: string, imageSize?: string, highQuality?: boolean, flexOrientation?: boolean, referenceImages?: { data: string, mimeType: string }[] } = {}) {
  const primaryModel = config.highQuality ? "gemini-3.1-flash-image" : "gemini-2.5-flash-image";
  const fallbackModel = config.highQuality ? "gemini-2.5-flash-image" : "gemini-3.1-flash-image";
  
  const genConfig: any = {
    imageConfig: {
      aspectRatio: config.aspectRatio || "1:1"
    }
  };
  
  if (config.imageSize) {
    genConfig.imageConfig.imageSize = config.imageSize;
  }

  const parts: any[] = [{ text: prompt }];
  
  if (config.referenceImages && config.referenceImages.length > 0) {
    // Current image generation models typically support ONE source image for reference.
    // We take the first one to avoid "unsupported multimodal configuration" errors.
    const primaryImg = config.referenceImages[0];
    parts.unshift({
      inlineData: {
        data: primaryImg.data,
        mimeType: primaryImg.mimeType
      }
    });

    const identityInstruction = `Identity Guidance: Maintain the subject's exact facial features and identity from the provided Reference Image while applying the new context: "${prompt}".`;
    parts.push({ text: identityInstruction });
  }

  try {
    console.log(`[generateImageAI] Attempting with primary model: ${primaryModel}`);
    const response = await callGeminiWithRetry(() => ai.models.generateContent({
      model: primaryModel,
      contents: {
        parts: parts
      },
      config: genConfig
    }));

    const imageData = extractImageData(response);
    if (imageData) return imageData;
  } catch (error) {
    console.warn(`[generateImageAI] Primary model ${primaryModel} failed. Attempting fallback:`, error);
  }

  try {
    console.log(`[generateImageAI] Attempting with fallback model: ${fallbackModel}`);
    const response = await callGeminiWithRetry(() => ai.models.generateContent({
      model: fallbackModel,
      contents: {
        parts: parts
      },
      config: genConfig
    }));

    const imageData = extractImageData(response);
    if (imageData) return imageData;
  } catch (error: any) {
    console.error(`[generateImageAI] Fallback model ${fallbackModel} also failed:`, error);
    throw error;
  }
  
  throw new Error("No se generó ninguna imagen. Posible rechazo por seguridad o falta de respuesta visual.");
}

export async function editImageAI(base64Image: string, mimeType: string, instruction: string, config: { aspectRatio?: string, highQuality?: boolean } = {}) {
  const primaryModel = config.highQuality ? "gemini-3.1-flash-image" : "gemini-2.5-flash-image";
  const fallbackModel = config.highQuality ? "gemini-2.5-flash-image" : "gemini-3.1-flash-image";
  
  // Simplified and direct instructions to be more effective and less likely to trigger safety refusals
  const completeInstruction = `Professional Image Editor Mode.
TASK: Modify the attached photo, preserving its integrity and subject identity.
INSTRUCTION: "${instruction}".
CONSTRAINTS: Maintain subject identity, facial expression, and composition. Only apply changes described in the instruction.`;

  const genConfig: any = {
    imageConfig: {
      aspectRatio: config.aspectRatio || "1:1"
    }
  };

  try {
    console.log(`[editImageAI] Attempting with primary model: ${primaryModel}`);
    const response = await callGeminiWithRetry(() => ai.models.generateContent({
      model: primaryModel,
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType } },
          { text: completeInstruction }
        ]
      },
      config: genConfig
    }));

    const imageData = extractImageData(response);
    if (imageData) return imageData;
  } catch (error) {
    console.warn(`[editImageAI] Primary model ${primaryModel} failed. Attempting fallback:`, error);
  }

  try {
    console.log(`[editImageAI] Attempting with fallback model: ${fallbackModel}`);
    const response = await callGeminiWithRetry(() => ai.models.generateContent({
      model: fallbackModel,
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType } },
          { text: completeInstruction }
        ]
      },
      config: genConfig
    }));

    const imageData = extractImageData(response);
    if (imageData) return imageData;
  } catch (error: any) {
    console.error(`[editImageAI] Fallback model ${fallbackModel} also failed:`, error);
    throw error;
  }
  
  throw new Error("Fallo al editar la imagen. El modelo puede haber rechazado la solicitud por seguridad o devuelto texto.");
}

export async function enhanceImage(base64Image: string, mimeType: string) {
  const textPrompt = "Enhance this image to look professional. Increase sharpness, optimize contrast and brightness, and balance colors without changing the core content. Return the updated version.";
  
  try {
    console.log("[enhanceImage] Attempting with primary model: gemini-2.5-flash-image");
    const response = await callGeminiWithRetry(() => ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType } },
          { text: textPrompt }
        ]
      },
      config: {}
    }));

    const imageData = extractImageData(response);
    if (imageData) return imageData;
  } catch (error) {
    console.warn("[enhanceImage] Primary model failed. Attempting fallback:", error);
  }

  try {
    console.log("[enhanceImage] Attempting with fallback model: gemini-3.1-flash-image");
    const response = await callGeminiWithRetry(() => ai.models.generateContent({
      model: "gemini-3.1-flash-image",
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType } },
          { text: textPrompt }
        ]
      },
      config: {}
    }));

    const imageData = extractImageData(response);
    if (imageData) return imageData;
  } catch (error: any) {
    console.error("[enhanceImage] Fallback model also failed:", error);
    throw error;
  }
  
  throw new Error("Fallo al mejorar la imagen. El modelo puede haber rechazado la solicitud.");
}

export async function removeBackgroundAI(base64Image: string, mimeType: string) {
  const textPrompt = "Remove the background of this image. Preserve only the main subject. The background must be solid #000000 black.";
  
  try {
    console.log("[removeBackgroundAI] Attempting with primary model: gemini-2.5-flash-image");
    const response = await callGeminiWithRetry(() => ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType } },
          { text: textPrompt }
        ]
      },
      config: {}
    }));

    const imageData = extractImageData(response);
    if (imageData) return imageData;
  } catch (error) {
    console.warn("[removeBackgroundAI] Primary model failed. Attempting fallback:", error);
  }

  try {
    console.log("[removeBackgroundAI] Attempting with fallback model: gemini-3.1-flash-image");
    const response = await callGeminiWithRetry(() => ai.models.generateContent({
      model: "gemini-3.1-flash-image",
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType } },
          { text: textPrompt }
        ]
      },
      config: {}
    }));

    const imageData = extractImageData(response);
    if (imageData) return imageData;
  } catch (error: any) {
    console.error("[removeBackgroundAI] Fallback model also failed:", error);
    throw error;
  }
  
  throw new Error("Fallo al eliminar el fondo.");
}

export async function detectObjectsAI(base64Image: string, mimeType: string) {
  const response = await callGeminiWithRetry(() => ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: {
      parts: [
        { inlineData: { data: base64Image, mimeType } },
        { 
          text: `Identify and locate objects in this image.
          Detect the most prominent items.
          Return a JSON array of objects, each with:
          - 'label': Name of the object (in English).
          - 'box_2d': [ymin, xmin, ymax, xmax] coordinates (0-1000).
          - 'confidence': 0-1 value.`
        }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            box_2d: { 
              type: Type.ARRAY,
              items: { type: Type.NUMBER }
            },
            confidence: { type: Type.NUMBER }
          },
          required: ["label", "box_2d", "confidence"]
        }
      }
    }
  }));

  try {
    const text = getResponseText(response) || "[]";
    return JSON.parse(text);
  } catch (e: any) {
    console.error("Failed to parse detection JSON", e);
    return [];
  }
}

export async function breakdownStoryIntoScenes(storyDescription: string, participants: { id: string, name: string }[], scenesCount: number = 4) {
  const participantsList = participants.map(p => `${p.name} (ID: ${p.id})`).join(", ");
  
  const response = await callGeminiWithRetry(() => ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: `Acting as a professional storyboard artist, break down the following story description into exactly ${scenesCount} distinct visual scenes.
    
    Story: "${storyDescription}"
    Available Characters: ${participantsList}
    
    For each scene, provide:
    1. A short narrative snippet (what happens).
    2. A technical image generation prompt (in English) describing the scene visuals.
    3. Which exact character IDs from the provided list are present in this scene.
    
    Return the result as a JSON array of scene objects.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            narrative: { type: Type.STRING },
            imagePrompt: { type: Type.STRING },
            participantIds: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["narrative", "imagePrompt", "participantIds"]
        }
      }
    }
  }));
  
  try {
    const text = getResponseText(response) || "[]";
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse story scenes JSON", e);
    return [];
  }
}

export async function generateNarrative(storyTitle: string, scenes: { prompt: string, participants: string[] }[]) {
  const sceneTexts = scenes.map((s, i) => `Scene ${i+1}: Image prompt "${s.prompt}". Featuring: ${s.participants.join(", ")}`).join("\n");
  
  const response = await callGeminiWithRetry(() => ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: `Write a short, cohesive narrative (in Spanish) for a story titled "${storyTitle}". 
The story is composed of the following visual sequence:
${sceneTexts}

Make it engaging and story-driven.`,
  }));
  
  return getResponseText(response) || "";
}

export async function swapAI(sceneImage: { data: string, mimeType: string }, participantsImage: { data: string, mimeType: string }, config: { aspectRatio?: string, highQuality?: boolean } = {}) {
  const primaryModel = config.highQuality ? "gemini-3.1-flash-image" : "gemini-2.5-flash-image";
  const fallbackModel = config.highQuality ? "gemini-2.5-flash-image" : "gemini-3.1-flash-image";
  
  const swapPrompt = `TASK: SWAP PARTICIPANTS. 
Use "Image 1" (Imagen 1) as the SOURCE for the environment, background, lighting, composition, and artistic style. 
Use "Image 2" (Imagen 2) as the SOURCE for the subjects/participants. 

RESULT: Recreate "Image 1" perfectly in every technical detail (set, backdrop, mood) but REPLACE all people in it with the specific individuals from "Image 2". 
The individuals from Image 2 must maintain their exact facial features and identity. 
The overall layout and vibe must come strictly from Image 1.`;

  const genConfig = {
    imageConfig: {
      aspectRatio: config.aspectRatio || "1:1"
    }
  };

  try {
    console.log(`[swapAI] Attempting with primary model: ${primaryModel}`);
    const response = await callGeminiWithRetry(() => ai.models.generateContent({
      model: primaryModel,
      contents: {
        parts: [
          { inlineData: { data: sceneImage.data, mimeType: sceneImage.mimeType } },
          { inlineData: { data: participantsImage.data, mimeType: participantsImage.mimeType } },
          { text: swapPrompt }
        ]
      },
      config: genConfig
    }));

    const imageData = extractImageData(response);
    if (imageData) return imageData;
  } catch (error) {
    console.warn(`[swapAI] Primary model ${primaryModel} failed. Attempting fallback:`, error);
  }

  try {
    console.log(`[swapAI] Attempting with fallback model: ${fallbackModel}`);
    const response = await callGeminiWithRetry(() => ai.models.generateContent({
      model: fallbackModel,
      contents: {
        parts: [
          { inlineData: { data: sceneImage.data, mimeType: sceneImage.mimeType } },
          { inlineData: { data: participantsImage.data, mimeType: participantsImage.mimeType } },
          { text: swapPrompt }
        ]
      },
      config: genConfig
    }));

    const imageData = extractImageData(response);
    if (imageData) return imageData;
  } catch (error: any) {
    console.error(`[swapAI] Fallback model ${fallbackModel} also failed:`, error);
    throw error;
  }

  throw new Error("Fallo en el SWAP. El modelo puede haber rechazado la solicitud.");
}

