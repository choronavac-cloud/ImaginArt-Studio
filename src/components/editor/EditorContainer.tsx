
import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Send, 
  Image as ImageIcon, 
  RotateCcw, 
  Download, 
  Save, 
  Sparkles, 
  Languages, 
  Camera,
  Layers,
  Palette,
  Maximize2,
  Settings,
  Layout,
  History,
  Type,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { translatePrompt, generateImageAI, editImageAI, enhanceImage, removeBackgroundAI, detectObjectsAI } from '@/lib/gemini';
import { saveToDrive } from '@/services/drive';
import { googleSignIn, getAccessToken } from '@/services/auth';
import { saveGalleryItem, getSettings, getGalleryItems, GalleryItem } from '@/services/storage';
import { logError } from '@/lib/logger';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';


import { 
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle
} from 'react-resizable-panels';

const getUserImageReference = async (prompt: string): Promise<{data: string, mimeType: string} | null> => {
  const p = prompt.toLowerCase();
  if (p.includes(' self ') || p.includes(' me ') || p.startsWith('self ') || p.startsWith('me ') || 
      p.includes(' yo ') || p.includes(' nosotros ') || p.startsWith('yo ') || p.startsWith('nosotros ')) {
     const settings = await getSettings();
     if (settings.userPhotos && settings.userPhotos.length > 0) {
        const photo = settings.userPhotos[0];
        const [meta, data] = photo.split(',');
        const mimeType = meta.split(':')[1].split(';')[0];
        return { data, mimeType };
     }
  }
  return null;
};

export default function EditorContainer() {
  const { t, i18n } = useTranslation();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [lastGeneratedImageMetadata, setLastGeneratedImageMetadata] = useState<any>(null);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [resolution, setResolution] = useState("1024");
  const [style, setStyle] = useState("none");
  const [cameraPos, setCameraPos] = useState("front");
  const [cameraDistance, setCameraDistance] = useState("medium_shot");
  const [generationQuality, setGenerationQuality] = useState<"standard" | "high" | "ultra">("standard");
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [imageContextMenu, setImageContextMenu] = useState<{ x: number, y: number } | null>(null);
  const [recentImages, setRecentImages] = useState<GalleryItem[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [sessionVariations, setSessionVariations] = useState<string[]>([]);
  const [suggestedPrompts, setSuggestedPrompts] = useState<{ en: string, user: string }[]>([]);
  const [showVariationsModal, setShowVariationsModal] = useState(false);
  const [currentPromptPair, setCurrentPromptPair] = useState<{ en: string, user: string } | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [mobileTab, setMobileTab] = useState<"canvas" | "editor" | "tools" | "history">("canvas");
  const [detectedObjects, setDetectedObjects] = useState<any[]>([]);
  const [showObjects, setShowObjects] = useState(true);
  const [currentActivePrompt, setCurrentActivePrompt] = useState<string | null>(null);
  const [lastGenerationMetadata, setLastGenerationMetadata] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
            const file = items[i].getAsFile();
            if (file) {
              const reader = new FileReader();
              reader.onload = (event) => {
                const result = event.target?.result as string;
                setOriginalImage(result);
                setGeneratedImage(result);
                toast.success("Imagen pegada desde el portapapeles");
              };
              reader.readAsDataURL(file);
              return;
            }
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  React.useEffect(() => {
    loadRecentImages();
    loadSettings();

    const handleLoadDriveImage = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.data) {
        setOriginalImage(customEvent.detail.data);
        setGeneratedImage(customEvent.detail.data);
        toast.success("Imagen de Google Drive cargada con éxito!");
      }
    };
    window.addEventListener('loadDriveImage', handleLoadDriveImage as EventListener);
    return () => {
      window.removeEventListener('loadDriveImage', handleLoadDriveImage as EventListener);
    };
  }, []);

  const loadSettings = async () => {
    const s = await getSettings();
    setSettings(s);
  };

  const loadRecentImages = async () => {
    const images = await getGalleryItems('generation');
    // Get last 20 images
    setRecentImages(images.slice(-20).reverse());
  };

  const getBatchPrompts = (text: string) => {
    const batchRegex = /["«»“”]([^"«»“”]+)["«»“”]/g;
    const matches = Array.from(text.matchAll(batchRegex));
    if (!matches || matches.length === 0) return [];
    return matches.map(m => m[1].trim()).filter(p => p.length > 0);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return toast.error(t('common.error'));
    
    const batchPrompts = getBatchPrompts(prompt);
    const totalBatch = batchPrompts.length;
    const isBatchMode = totalBatch > 1;
    
    setLoading(true);
    setSessionVariations([]);
    setBatchProgress(null);
    
    try {
      const currentSettings = await getSettings();
      const promptsToProcess = isBatchMode ? batchPrompts : [prompt];
      const results: string[] = [];
      const totalToProcess = promptsToProcess.length;
      
      if (isBatchMode) {
        setBatchProgress({ current: 0, total: totalToProcess * (currentSettings.numVariations || 1) });
        toast.info(t('editor.batch_processing', { current: 1, total: totalToProcess * (currentSettings.numVariations || 1) }));
      }

      for (let pIndex = 0; pIndex < totalToProcess; pIndex++) {
        const p = promptsToProcess[pIndex];
        setCurrentActivePrompt(p);

        // Allow variations even in batch mode
        const variationsCount = (currentSettings.numVariations || 1);
        console.log(`Generating ${variationsCount} variations for prompt: ${p}`);
        for (let vIdx = 0; vIdx < variationsCount; vIdx++) {
            if (isBatchMode || variationsCount > 1) {
              setBatchProgress({ current: (pIndex * variationsCount) + vIdx + 1, total: totalToProcess * variationsCount });
            }
          try {
            let finalPrompt = p;

            // Auto-translate if needed
            if (currentSettings.defaultGenerationLanguage === 'en' && i18n.language === 'es') {
              if (currentPromptPair && currentPromptPair.user === p) {
                finalPrompt = currentPromptPair.en;
              } else {
                finalPrompt = await translatePrompt(p, "English");
              }
            }

            let enhancedPrompt = finalPrompt;
            if (style !== 'none') enhancedPrompt += `. Style: ${style}`;
            if (cameraPos !== 'front') enhancedPrompt += `. Camera position: ${cameraPos}`;
            if (cameraDistance !== 'medium_shot') enhancedPrompt += `. Shot type: ${cameraDistance.replace(/_/g, ' ')}`;

            if (currentSettings.autoAdjustPrompts) {
              if (!enhancedPrompt.toLowerCase().includes('detailed') && !enhancedPrompt.toLowerCase().includes('resolution')) {
                enhancedPrompt += ". High resolution, meticulous detail.";
              }
            }

            if (resolution === "2048") {
              enhancedPrompt += ", highly detailed 4k resolution";
            } else if (resolution === "4096") {
              enhancedPrompt += ", ultra high definition 8k resolution, hyper-realistic details";
            }
            
            let referenceImage = undefined;
            if (originalImage && originalImage.startsWith('data:')) {
              try {
                const parts = originalImage.split(';');
                const base64 = parts[1].split(',')[1];
                const mimeType = parts[0].split(':')[1];
                referenceImage = { data: base64, mimeType };
              } catch (e) {
                console.error("Failed to parse reference image", e);
              }
            }

            const userImageRef = await getUserImageReference(enhancedPrompt);
            const ref = referenceImage || userImageRef;
            
            const imageUrl = await generateImageAI(enhancedPrompt, { 
              aspectRatio, 
              highQuality: generationQuality !== "standard",
              imageSize: resolution === "4096" ? "large" : undefined,
              referenceImages: ref ? [ref] : undefined
            });
            
            results.push(imageUrl);
            const generationMetadata = {
                aspectRatio,
                quality: generationQuality,
                cameraPosition: cameraPos,
                cameraDistance,
                imageStyle: style,
                resolution,
                prompt: enhancedPrompt // Store the actual full prompt used
            };
            setGeneratedImage(imageUrl);
            setLastGeneratedImageMetadata(generationMetadata);
            
            await saveGalleryItem('generation', {
              id: crypto.randomUUID(),
              url: imageUrl,
              prompt: enhancedPrompt,
              timestamp: new Date().toISOString(),
              category: 'generation',
              metadata: generationMetadata
            });
            
            loadRecentImages();

            // Slightly longer delay for safer batching
            if (totalToProcess > 1 || variationsCount > 1) {
              await new Promise(r => setTimeout(r, 1200));
            }
          } catch (itemError: any) {
            console.error(`Error in item ${pIndex + 1}:`, itemError);
            const errorString = (typeof itemError === 'string' ? itemError : (itemError?.message || JSON.stringify(itemError))).toLowerCase();
            const isQuota = errorString.includes('429') || errorString.includes('quota') || errorString.includes('cuota') || errorString.includes('exhausted') || itemError?.status === 429 || itemError?.error?.code === 429;
            
            const msg = isQuota 
              ? `Límite de cuota alcanzado en ítem ${pIndex + 1}. Por favor, espera un minuto.`
              : `${pIndex + 1}: ${itemError.message || 'Error de generación'}`;
            toast.error(msg);

            // If it's a quota error, stop the batch early to avoid more failures
            if (isQuota) break;
          }
        }

        // Delay between prompts in batch
        if (totalToProcess > 1) {
          await new Promise(r => setTimeout(r, 3000));
        }
        setCurrentActivePrompt(null);
      }
      
      setCurrentActivePrompt(null);
      
      if (results.length > 1) {
        setSessionVariations(results);
        setShowVariationsModal(true);
      }
      
      if (results.length > 0) {
        if (totalToProcess > 1) {
          toast.success(`${t('editor.batch_ready')} (${results.length}/${totalToProcess})`);
        } else {
          toast.success(t('common.success'));
        }
      } else {
        toast.error("No se pudo generar ninguna imagen en este lote.");
      }

    } catch (error: any) {
      logError(error);
      const errorMessage = error?.message || "Error desconocido";
      toast.error(`Error crítico: ${errorMessage}`);
    } finally {
      setLoading(false);
      setBatchProgress(null);
      setCurrentActivePrompt(null);
    }
  };

  const handleExport = async () => {
    if (!generatedImage) return;
    
    try {
      // Create a blob from the data URL for better compatibility across browsers
      const response = await fetch(generatedImage);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `imagina-ia-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      
      toast.success("Imagen exportada");
    } catch (error) {
      console.error("Export failed", error);
      // Fallback to simple link method
      const link = document.createElement('a');
      link.href = generatedImage;
      link.download = `imagina-ia-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Imagen exportada");
    }
  };

  const handleSave = async () => {
    if (!generatedImage) return;
    try {
      const metadata = lastGeneratedImageMetadata || {
        aspectRatio,
        quality: generationQuality,
        cameraPosition: cameraPos,
        cameraDistance,
        imageStyle: style,
        resolution,
        prompt: prompt
      };
      
      await saveGalleryItem('generation', {
        id: crypto.randomUUID(),
        url: generatedImage,
        prompt: metadata.prompt || prompt,
        timestamp: new Date().toISOString(),
        category: 'generation',
        metadata: metadata
      });
      loadRecentImages();
      toast.success("Imagen guardada en galería");
    } catch (error) {
      logError(error);
      toast.error("Error al guardar");
    }
  };

  const handleSaveToDrive = async () => {
    if (!generatedImage) return;
    try {
        let accessToken = await getAccessToken();
        if (!accessToken) {
            const authResult = await googleSignIn();
            if (!authResult) return; // User cancelled
            accessToken = authResult.accessToken;
        }

        const response = await fetch(generatedImage);
        const blob = await response.blob();
        const currentSettings = await getSettings();
        const folderName = currentSettings.driveFolderPath || "ImaginArt Studio";

        await toast.promise(saveToDrive(blob, `imaginart_${Date.now()}.png`, folderName), {
            loading: 'Guardando en Drive...',
            success: 'Imagen guardada en Google Drive.',
            error: (e: any) => `Error guardando en Drive: ${e.message}`
        });
    } catch (e: any) {
        console.error(e);
        toast.error('Error al guardar en Drive: ' + e.message);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setOriginalImage(result);
        setGeneratedImage(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAutoEnhance = async () => {
    if (!generatedImage) return;
    setLoading(true);
    try {
       const base64 = generatedImage.split(',')[1];
       const mimeType = generatedImage.split(';')[0].split(':')[1];
       const result = await enhanceImage(base64, mimeType);
       setGeneratedImage(result);
       toast.success("Mejora automática aplicada");
    } catch (error: any) {
       logError(error);
       const errorMessage = error?.message || "Error desconocido";
       toast.error(`Error al mejorar la imagen: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveBackground = async () => {
    if (!generatedImage) return;
    setLoading(true);
    try {
      const base64 = generatedImage.split(',')[1];
      const mimeType = generatedImage.split(';')[0].split(':')[1];
      const result = await removeBackgroundAI(base64, mimeType);
      setGeneratedImage(result);
      toast.success("Fondo eliminado correctamente");
    } catch (error: any) {
      logError(error);
      toast.error(`Error al eliminar fondo: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDetectObjects = async () => {
    if (!generatedImage) return;

    if (detectedObjects.length > 0) {
      setShowObjects(prev => !prev);
      return;
    }

    setLoading(true);
    try {
      const base64 = generatedImage.split(',')[1];
      const mimeType = generatedImage.split(';')[0].split(':')[1];
      const objects = await detectObjectsAI(base64, mimeType);
      setDetectedObjects(objects || []);
      setShowObjects(true);
      if (objects && objects.length > 0) {
        toast.success(`Se detectaron ${objects.length} objetos`);
      } else {
        toast.info("No se detectaron objetos significativos");
      }
    } catch (error: any) {
      logError(error);
      toast.error(`Error en detección: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveObjectFromImage = async (obj: any) => {
    if (!generatedImage) return;
    setLoading(true);
    try {
      const base64 = generatedImage.split(',')[1];
      const mimeType = generatedImage.split(';')[0].split(':')[1];
      
      const instruction = `Erase and remove the "${obj.label}" located around coordinates [${obj.box_2d.join(", ")}] and fill in the space seamlessly back to match the surrounding background. The area must be completely restored.`;
      
      const result = await editImageAI(base64, mimeType, instruction, { 
        aspectRatio,
        highQuality: generationQuality !== "standard"
      });
      setGeneratedImage(result);
      
      // Filter out the deleted object from the visual overlays
      setDetectedObjects(prev => prev.filter(item => item !== obj));
      
      await saveGalleryItem('generation', {
        id: crypto.randomUUID(),
        url: result,
        prompt: `Eliminado objeto: ${obj.label}`,
        timestamp: new Date().toISOString(),
        category: 'generation',
        metadata: {
          action: 'object_removal',
          removedObject: obj.label,
          aspectRatio,
          quality: generationQuality,
          cameraPosition: cameraPos,
          cameraDistance,
          imageStyle: style,
          resolution,
        }
      });
      loadRecentImages();
      toast.success(`Objeto "${obj.label}" eliminado con éxito`);
    } catch (error: any) {
      logError(error);
      const errorMessage = error?.message || "Error desconocido";
      toast.error(`Error al eliminar el objeto: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditWithPrompt = async () => {
    if (!generatedImage || !prompt.trim()) return toast.error("Se requiere una imagen y un prompt");
    
    const batchPrompts = getBatchPrompts(prompt);
    const totalBatch = batchPrompts.length;
    const isBatchMode = totalBatch > 1;
    const promptsToProcess = isBatchMode ? batchPrompts : [prompt];
    const totalToProcess = promptsToProcess.length;

    setLoading(true);
    setSessionVariations([]);
    setBatchProgress(null);

    try {
      const base64 = generatedImage.split(',')[1];
      const mimeType = generatedImage.split(';')[0].split(':')[1];
      const currentSettings = await getSettings();
      const variationsCount = isBatchMode ? 1 : (currentSettings.numVariations || 1);
      const results: string[] = [];

      if (totalToProcess > 1) {
        setBatchProgress({ current: 0, total: totalToProcess * variationsCount });
        toast.info(t('editor.batch_processing', { current: 1, total: totalToProcess * variationsCount }));
      }

      for (let pIndex = 0; pIndex < totalToProcess; pIndex++) {
        const p = promptsToProcess[pIndex];
        setCurrentActivePrompt(p);
        
        for (let vIdx = 0; vIdx < variationsCount; vIdx++) {
            if (totalToProcess > 1 || variationsCount > 1) {
                const current = (pIndex * variationsCount) + vIdx + 1;
                const total = totalToProcess * variationsCount;
                setBatchProgress({ current, total });
            }

            try {
              console.log("Processing prompt:", p);
              let finalEditPrompt = p;
              
              if (resolution === "2048") {
                finalEditPrompt += ", high resolution 4k detail";
              } else if (resolution === "4096") {
                finalEditPrompt += ", ultra high definition 8k, extreme realism";
              }

              console.log("Calling editImageAI");
              const result = await editImageAI(base64, mimeType, finalEditPrompt, { 
                aspectRatio,
                highQuality: generationQuality !== "standard"
              });
              console.log("editImageAI result received");
              results.push(result);
              
              const generationMetadata = {
                  action: 'edit_prompt',
                  aspectRatio,
                  quality: generationQuality,
                  cameraPosition: cameraPos,
                  cameraDistance,
                  imageStyle: style,
                  resolution,
                  prompt: finalEditPrompt
              };
              
              setGeneratedImage(result);
              setLastGeneratedImageMetadata(generationMetadata);
              
              await saveGalleryItem('generation', {
                id: crypto.randomUUID(),
                url: result,
                prompt: finalEditPrompt,
                timestamp: new Date().toISOString(),
                category: 'generation',
                metadata: generationMetadata
              });
              
              loadRecentImages();

              if (totalToProcess > 1 || variationsCount > 1) {
                await new Promise(r => setTimeout(r, 1200));
              }
            } catch (itemError: any) {
              console.error(`Error in transform item ${pIndex + 1}:`, itemError);
              const errorString = (typeof itemError === 'string' ? itemError : (itemError?.message || JSON.stringify(itemError))).toLowerCase();
              const isQuota = errorString.includes('429') || errorString.includes('quota') || errorString.includes('cuota') || errorString.includes('exhausted') || itemError?.status === 429 || itemError?.error?.code === 429;
              
              const msg = isQuota 
                ? `Límite de cuota alcanzado. Deteniendo lote.`
                : `Error de transformación: ${itemError.message || 'Error desconocido'}`;
              toast.error(msg);
              
              if (isQuota) break;
            }
        }
        setCurrentActivePrompt(null);
      }

      if (results.length > 1) {
        setSessionVariations(results);
        setShowVariationsModal(true);
      }

      if (results.length > 0) {
        if (totalToProcess > 1) {
          toast.success(`${t('editor.batch_ready')} (${results.length}/${totalToProcess})`);
        } else {
          toast.success("Imagen transformada correctamente");
        }
      } else {
        toast.error("No se pudo transformar la imagen.");
      }

    } catch (error: any) {
       logError(error);
       const errorMessage = error?.message || "Error desconocido";
       toast.error(`Error crítico al transformar: ${errorMessage}`);
    } finally {
      setLoading(false);
      setBatchProgress(null);
      setCurrentActivePrompt(null);
    }
  };

  const handleEdit = async (action: string) => {
    if (!generatedImage) return;
    setLoading(true);
    try {
       const base64 = generatedImage.split(',')[1];
       const mimeType = generatedImage.split(';')[0].split(':')[1];
       const result = await editImageAI(base64, mimeType, action);
       setGeneratedImage(result);
       toast.success("Edición completada");
    } catch (error: any) {
       logError(error);
       const errorMessage = error?.message || "Error desconocido";
       toast.error(`Error al editar: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const canvasSection = (
    <section className={cn(
      "w-full h-full bg-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden flex flex-col lg:flex-row shadow-2xl min-h-[400px] lg:min-h-0",
      mobileTab !== "canvas" && "hidden lg:flex"
    )}>
              <div 
                className="flex-1 bg-[#050505] flex items-center justify-center relative overflow-hidden group border-2 border-transparent"
              >
                <AnimatePresence mode="wait">
                  {generatedImage ? (
                    <motion.div
                      key={generatedImage}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5 }}
                      className="w-full h-full flex items-center justify-center p-1"
                    >
                      <div 
                        className="relative max-w-full max-h-full flex items-center justify-center overflow-hidden shadow-2xl rounded-2xl border border-slate-800/40 bg-[#020202]"
                        style={{ aspectRatio: aspectRatio.replace(':', '/') }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setImageContextMenu({ x: e.clientX, y: e.clientY });
                        }}
                        onClick={() => setImageContextMenu(null)}
                      >
                        <img 
                          src={generatedImage} 
                          className="w-full h-full object-contain transition-all duration-200 ease-in-out"
                          style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
                          alt="Canvas"
                          referrerPolicy="no-referrer"
                        />
                        {imageContextMenu && (
                          <div
                            className="fixed bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-1 z-50 text-[10px] uppercase font-bold w-40"
                            style={{ top: imageContextMenu.y, left: imageContextMenu.x }}
                          >
                            <button className="block w-full text-left px-4 py-2 hover:bg-slate-800 rounded" onClick={(e) => { e.stopPropagation(); setImageContextMenu(null); handleAutoEnhance(); }}>Mejorar</button>
                            <button className="block w-full text-left px-4 py-2 hover:bg-slate-800 rounded" onClick={(e) => { e.stopPropagation(); setImageContextMenu(null); handleRemoveBackground(); }}>Quitar fondo</button>
                            <button className="block w-full text-left px-4 py-2 hover:bg-slate-800 rounded" onClick={(e) => { e.stopPropagation(); setImageContextMenu(null); handleDetectObjects(); }}>Detectar Objetos</button>
                            <button className="block w-full text-left px-4 py-2 hover:bg-slate-800 rounded" onClick={(e) => { e.stopPropagation(); setImageContextMenu(null); handleSaveToDrive(); }}>Guardar en Drive</button>
                            <button className="block w-full text-left px-4 py-2 hover:bg-slate-800 rounded" onClick={(e) => { e.stopPropagation(); setImageContextMenu(null); handleExport(); }}>Exportar</button>
                            <button className="block w-full text-left px-4 py-2 hover:bg-slate-800 rounded" onClick={(e) => { e.stopPropagation(); setImageContextMenu(null); handleExport(); }}>Descargar HD</button>
                          </div>
                        )}
                        <div className="absolute bottom-2 right-2 flex gap-1 bg-black/60 backdrop-blur-md rounded-lg p-1">
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-white" onClick={() => setZoom(prev => Math.max(0.5, prev - 0.1))}>-</Button>
                          <span className="text-[10px] text-white flex items-center">{Math.round(zoom * 100)}%</span>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-white" onClick={() => setZoom(prev => Math.min(3, prev + 0.1))}>+</Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-white text-[10px]" onClick={() => setZoom(1)}>Reset</Button>
                        </div>
                        {/* Object Detection Overlay */}
                        {showObjects && detectedObjects.length > 0 && (
                          <svg 
                            className="absolute inset-0 w-full h-full pointer-events-none select-none"
                            viewBox="0 0 1000 1000"
                            preserveAspectRatio="none"
                          >
                            {detectedObjects.map((obj, idx) => {
                              const [ymin, xmin, ymax, xmax] = obj.box_2d;
                              return (
                                <g key={idx}>
                                  <rect
                                    x={xmin}
                                    y={ymin}
                                    width={xmax - xmin}
                                    height={ymax - ymin}
                                    fill="none"
                                    stroke={idx % 2 === 0 ? "#818cf8" : "#fb7185"}
                                    strokeWidth="4"
                                    className="animate-pulse"
                                  />
                                  <rect 
                                    x={xmin}
                                    y={ymin - 25}
                                    width={obj.label.length * 12 + 15}
                                    height={25}
                                    fill={idx % 2 === 0 ? "#818cf8" : "#fb7185"}
                                    rx="4"
                                  />
                                  <text
                                    x={xmin + 5}
                                    y={ymin - 7}
                                    fill="white"
                                    fontSize="15"
                                    fontWeight="bold"
                                    className="font-mono"
                                  >
                                    {obj.label.toUpperCase()}
                                  </text>
                                </g>
                              );
                            })}
                          </svg>
                        )}
                      </div>

                      {/* Interactive Floating Object Panel directly over/inside Canvas Section */}
                      {showObjects && detectedObjects.length > 0 && (
                        <div className="absolute top-16 right-4 bg-slate-950/95 backdrop-blur-md border border-slate-800 p-3 rounded-xl max-w-xs z-30 space-y-2 max-h-56 overflow-y-auto w-52 shadow-2xl flex flex-col pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-300">
                           <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                             <div className="flex items-center gap-1">
                               <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                               <span className="text-[10px] font-bold text-indigo-400 font-mono uppercase tracking-wider block">
                                 Objetos ({detectedObjects.length})
                               </span>
                             </div>
                             <Button 
                               onClick={() => setShowObjects(false)} 
                               size="sm" 
                               variant="ghost" 
                               className="h-4 w-12 px-0 text-[9px] text-slate-500 hover:text-rose-400 font-bold uppercase hover:bg-slate-900"
                             >
                               Ocultar x
                             </Button>
                           </div>
                           <ScrollArea className="max-h-36 overflow-y-auto pr-1">
                             <div className="flex flex-col gap-1.5">
                               {detectedObjects.map((obj, idx) => (
                                 <div 
                                   key={idx}
                                   className="flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg bg-slate-900/60 border border-slate-850 text-[10px]"
                                 >
                                   <span className="font-semibold text-slate-300 truncate block max-w-[110px]" title={obj.label}>
                                     {obj.label}
                                   </span>
                                   <Button
                                     onClick={() => handleRemoveObjectFromImage(obj)}
                                     disabled={loading}
                                     size="sm"
                                     variant="ghost"
                                     className="h-5 px-2 text-indigo-400 hover:text-rose-400 hover:bg-rose-500/10 text-[9px] font-bold uppercase shrink-0 border border-indigo-500/10 hover:border-rose-500/20 bg-indigo-500/5 hover:bg-rose-500/5 transition-colors"
                                   >
                                     Quitar
                                   </Button>
                                 </div>
                               ))}
                             </div>
                           </ScrollArea>
                           <p className="text-[8px] text-slate-500 italic leading-tight">
                             Haz clic en "Quitar" para borrar un objeto usando IA de relleno.
                           </p>
                        </div>
                      )}
              <div className="absolute top-2 lg:top-4 left-2 lg:left-4 bg-black/60 backdrop-blur-md px-2 lg:px-3 py-1 lg:py-1.5 rounded-lg border border-white/10 text-[9px] lg:text-[10px] font-mono flex items-center gap-1 lg:gap-2">
                 <div className="w-1 lg:w-1.5 h-1 lg:h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-white/90">{aspectRatio}</span>
                 <span className="text-white/40">|</span>
                 <span className="text-indigo-400 font-bold">{cameraPos.toUpperCase()}</span>
                 <span className="text-white/40">|</span>
                 <span className="text-indigo-400 font-bold">{cameraDistance.toUpperCase().replace(/_/g, ' ')}</span>
                 <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] rounded-lg border border-white/20 hover:bg-white/20 ml-2" onClick={handleExport}>
                   <Download size={12} className="mr-1.5" /> DESCARGAR HD
                 </Button>
              </div>
            </motion.div>
          ) : (
            <div className="text-center space-y-4 lg:space-y-6">
               <div className="w-16 lg:w-20 h-16 lg:h-20 bg-slate-800 rounded-3xl flex items-center justify-center mx-auto text-slate-700 shadow-inner">
                  <ImageIcon size={32} />
               </div>
               <p className="text-slate-600 text-[10px] lg:text-xs font-medium tracking-wide uppercase">{t('canvas.empty', 'El lienzo está vacío')}</p>
            </div>
          )}
        </AnimatePresence>

        {loading && (
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] flex items-center justify-center z-50">
             <div className="flex flex-col items-center gap-3">
                <div className="w-8 lg:w-10 h-8 lg:h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-[9px] lg:text-[10px] font-bold text-indigo-400 tracking-widest animate-pulse px-4 text-center">
                  {batchProgress 
                    ? t('editor.batch_processing', { current: batchProgress.current, total: batchProgress.total }).toUpperCase()
                    : "PROCESANDO..."
                  }
                </span>
             </div>
          </div>
        )}
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 h-10 lg:h-12 border-t border-slate-800 flex items-center justify-end px-4 lg:px-6 bg-slate-900/50 z-20">
         <div className="flex items-center gap-3 lg:gap-4">
            {generatedImage && (
              <Button 
                variant="default" 
                size="sm" 
                className="h-7 px-3 lg:px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/20 transition-all text-[9px] font-bold uppercase tracking-wider"
                onClick={handleSaveToDrive}
              >
                <Save size={12} className="mr-1.5" /> Guardar en Drive
              </Button>
            )}
           {generatedImage && (
             <Button 
               variant="default" 
               size="sm" 
               className="h-7 px-3 lg:px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 transition-all text-[9px] font-bold uppercase tracking-wider"
               onClick={handleSave}
             >
               <Save size={12} className="mr-1.5" /> {t('common.save')}
             </Button>
           )}
           
           {sessionVariations.length > 0 && (
              <div className="flex gap-1.5 items-center">
                 {sessionVariations.map((v, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => setGeneratedImage(v)}
                      className={cn(
                        "w-8 h-8 rounded-lg overflow-hidden border-2 transition-all hover:scale-105",
                        generatedImage === v ? "border-indigo-500" : "border-slate-800"
                      )}
                    >
                        <img src={v} className="w-full h-full object-cover" alt={`Variación ${idx + 1}`} referrerPolicy="no-referrer" />
                    </button>
                 ))}
              </div>
           )}

           {generatedImage && (
             <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[9px] lg:text-[10px] text-slate-400 font-medium">IA ACTIVO</span>
             </div>
           )}
         </div>
      </div>
    </section>
  );

  const promptSection = (
    <section className={cn(
      "w-full h-full bg-slate-900 border border-slate-800 rounded-2xl p-4 lg:p-6 flex flex-col lg:flex-row gap-4 lg:gap-6 shadow-xl overflow-hidden",
      mobileTab !== "editor" && "hidden lg:flex"
    )}>
      <div className="flex-1 flex flex-col gap-3 lg:gap-4">
          <div className="flex justify-between items-center px-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('editor.prompt')}</label>
            {getBatchPrompts(prompt).length > 1 && (
              <span className="text-[9px] lg:text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded tracking-tighter border border-amber-500/20 uppercase">
                BCH ({getBatchPrompts(prompt).length})
              </span>
            )}
            <span className="hidden lg:block text-[10px] text-indigo-400 font-mono bg-indigo-500/10 px-2 py-0.5 rounded tracking-tighter border border-indigo-500/20 uppercase">AI READY</span>
          </div>
          <div className="flex-1 flex flex-col gap-3 min-h-0">
         <Textarea 
           className="flex-1 lg:min-h-0 min-h-[100px] bg-slate-950 border-slate-800 rounded-xl p-3 lg:p-4 text-sm lg:text-sm resize-none focus-visible:ring-indigo-500/30 text-slate-300"
             value={currentActivePrompt ? prompt.replace(new RegExp(currentActivePrompt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `<<${currentActivePrompt}>>`) : prompt}
             onChange={(e) => {
               const newValue = e.target.value.replace(/<</g, "").replace(/>>/g, "");
               setPrompt(newValue);
               if (currentPromptPair && newValue !== currentPromptPair.user) {
                 setCurrentPromptPair(null);
               }
             }}
             placeholder={t('editor.prompt_placeholder', 'Escribe tu visión aquí...')}
           />
           
           {suggestedPrompts.length > 0 && (
             <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
               {suggestedPrompts.map((pPair, idx) => (
                 <button
                   key={idx}
                   onClick={() => {
                     setPrompt(pPair.user);
                     setCurrentPromptPair(pPair);
                     toast.success("Prompt sugerido aplicado");
                   }}
                   className={cn(
                     "whitespace-nowrap px-3 py-1.5 rounded-lg text-[9px] lg:text-[10px] font-medium transition-all border shrink-0",
                     prompt === pPair.user 
                       ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20" 
                       : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750 hover:text-slate-200"
                   )}
                 >
                   {idx === 0 ? "Master" : `${t('editor.variation')} ${idx}`}
                 </button>
               ))}
             </div>
           )}
         </div>
      </div>

      <div className="w-full lg:w-64 flex flex-col gap-3 lg:gap-4 p-3 lg:p-4 border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-950/30 overflow-y-auto lg:h-full shrink-0">
         {detectedObjects.length > 0 && (
           <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl space-y-2 flex flex-col shrink-0">
             <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
               <span className="text-[9.5px] font-bold text-indigo-400 uppercase tracking-wider block">
                 Objetos Detectados
               </span>
               <Button
                 onClick={() => {
                   setDetectedObjects([]);
                   setShowObjects(false);
                   toast.info("Análisis de objetos limpiado");
                 }}
                 variant="ghost"
                 size="sm"
                 className="h-5 px-1.5 text-[8.5px] hover:bg-rose-500/15 hover:text-rose-400 font-bold text-slate-400 uppercase tracking-wider"
               >
                 Limpiar x
               </Button>
             </div>
             <ScrollArea className="max-h-36 overflow-y-auto pr-1">
               <div className="flex flex-col gap-1">
                 {detectedObjects.map((obj, idx) => (
                   <div 
                     key={idx}
                     className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-slate-900 border border-slate-800/40 text-[10px]"
                   >
                     <span className="font-medium text-slate-300 truncate block max-w-[120px]" title={obj.label}>
                       {obj.label}
                     </span>
                     <Button
                       onClick={() => handleRemoveObjectFromImage(obj)}
                       disabled={loading}
                       size="sm"
                       variant="ghost"
                       className="h-5 px-2 text-indigo-400 hover:text-rose-400 hover:bg-rose-500/10 text-[9px] font-bold uppercase shrink-0 border border-indigo-500/10 hover:border-rose-500/20 bg-indigo-500/5 hover:bg-rose-500/5 transition-colors"
                     >
                       Quitar
                     </Button>
                   </div>
                 ))}
               </div>
             </ScrollArea>
             <p className="text-[8px] text-slate-500 italic leading-tight">
               Haz clic en "Quitar" para borrar un objeto usando IA de relleno.
             </p>
           </div>
         )}

         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 mt-auto">
            <Button 
              variant="default"
              className={cn(
                "justify-start gap-2 h-12 rounded-xl text-[10px] font-bold tracking-widest transition-all",
                generatedImage 
                  ? "bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/20" 
                  : "bg-slate-950 border border-slate-800 hover:bg-slate-800"
              )}
              onClick={generatedImage ? handleEditWithPrompt : handleGenerate}
              disabled={loading}
            >
              {generatedImage ? (
                <RotateCcw size={14} className={cn("shrink-0", loading && "animate-spin")} />
              ) : (
                <Sparkles size={14} className={cn("text-indigo-400 shrink-0", loading && "animate-spin")} />
              )}
              <span className="truncate">{loading ? "PROCESANDO..." : (generatedImage ? "TRANSFORMAR" : "GENERAR IMAGEN")}</span>
            </Button>

            <Button variant="outline" className="justify-start gap-2 h-10 rounded-xl bg-slate-950 border-slate-800 text-[10px] hover:bg-slate-800" onClick={handleAutoEnhance} disabled={!generatedImage || loading}>
              <Sparkles size={12} className="text-indigo-400 shrink-0" />
              <span className="truncate">Mejorar</span>
            </Button>

            <Button variant="outline" className="justify-start gap-2 h-10 rounded-xl bg-slate-950 border-slate-800 text-[10px] hover:bg-slate-800" onClick={handleRemoveBackground} disabled={!generatedImage || loading}>
              <Layout size={12} className="text-indigo-400 shrink-0" />
              <span className="truncate">Quitar Fondo</span>
            </Button>

            <Button variant="outline" className="justify-start gap-2 h-10 rounded-xl bg-slate-950 border-slate-800 text-[10px] hover:bg-slate-800" onClick={handleDetectObjects} disabled={!generatedImage || loading}>
              <Maximize2 size={12} className="text-indigo-400 shrink-0" />
              <span className="truncate">
                {detectedObjects.length > 0 
                  ? (showObjects ? "Ocultar Marcadores" : "Mostrar Marcadores") 
                  : "Detectar Objetos"}
              </span>
            </Button>

            <Button variant="outline" className="justify-start gap-2 h-10 rounded-xl bg-slate-950 border-slate-800 text-[10px] hover:bg-slate-800" onClick={handleExport} disabled={!generatedImage}>
              <Download size={12} className="text-emerald-400 shrink-0" />
              <span className="truncate">Exportar</span>
            </Button>

         </div>
      </div>
    </section>
  );

  const toolsSection = (
    <section className={cn(
      "w-full h-full bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col shadow-xl overflow-hidden min-h-[300px] lg:min-h-0",
      mobileTab !== "tools" && "hidden lg:flex"
    )}>
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">HERRAMIENTAS</h2>
      </div>
      
      <ScrollArea className="flex-1 -mx-4 px-4 overflow-x-hidden">
        <div className="flex flex-col gap-6 pb-4">

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2 px-1">
                 <Sparkles size={12} className="text-indigo-400" /> CALIDAD
              </label>
              <Select value={generationQuality} onValueChange={(val: any) => setGenerationQuality(val)}>
                <SelectTrigger className="bg-slate-950 border-slate-800 rounded-xl text-slate-300 h-9">
                  <SelectValue placeholder="Calidad" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-300">
                  <SelectItem value="standard">ESTÁNDAR</SelectItem>
                  <SelectItem value="high">ALTA</SelectItem>
                  <SelectItem value="ultra">ULTRA</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2 px-1">
                 <Palette size={12} className="text-indigo-400" /> {t('editor.style')}
              </label>
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger className="bg-slate-950 border-slate-800 rounded-xl h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  <SelectItem value="none">{t('editor.realistic')}</SelectItem>
                  <SelectItem value="anime">{t('editor.anime')}</SelectItem>
                  <SelectItem value="pixar">{t('editor.pixar')}</SelectItem>
                  <SelectItem value="watercolor">{t('editor.watercolor')}</SelectItem>
                  <SelectItem value="cinematic">Cinemático</SelectItem>
                  <SelectItem value="cyberpunk">Cyberpunk</SelectItem>
                  <SelectItem value="sketch">Boceto</SelectItem>
                  <SelectItem value="oil_painting">Óleo</SelectItem>
                  <SelectItem value="3d_render">3D Render</SelectItem>
                  <SelectItem value="pop_art">Pop Art</SelectItem>
                  <SelectItem value="hyper_realistic">Hiperrealista</SelectItem>
                  <SelectItem value="pencil_drawing">Dibujo a Lápiz</SelectItem>
                  <SelectItem value="uprising">Uprising Style</SelectItem>
                  <SelectItem value="custom">ESTILO PERSONALIZADO</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {style === 'custom' && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2 px-1">
                   <Palette size={12} className="text-indigo-400" /> NOMBRE DEL ESTILO
                </label>
                <Input 
                  className="bg-slate-950 border-slate-800 rounded-xl h-9 text-xs text-slate-300" 
                  placeholder="Ej: Steampunk, Gótico..." 
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    setPrompt(prev => {
                      const styleMark = ". Style:";
                      if (prev.includes(styleMark)) {
                        return prev.replace(/\. Style:.*$/, `. Style: ${val}`);
                      }
                      return prev + `. Style: ${val}`;
                    });
                  }}
                />
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-1 gap-4 lg:gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2 px-1">
                   <Maximize2 size={12} /> {t('editor.aspect_ratio')}
                </label>
                <Select value={aspectRatio} onValueChange={setAspectRatio}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 rounded-xl h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="1:1">1:1</SelectItem>
                    <SelectItem value="16:9">16:9</SelectItem>
                    <SelectItem value="9:16">9:16</SelectItem>
                    <SelectItem value="4:3">4:3</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2 px-1">
                   <Maximize2 size={12} /> RESOLUCIÓN
                </label>
                <Select value={resolution} onValueChange={setResolution}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 rounded-xl h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="1024">ESTÁNDAR (HD)</SelectItem>
                    <SelectItem value="2048">ALTA (FHD)</SelectItem>
                    <SelectItem value="4096">ULTRA (4K)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2 px-1">
                   <Camera size={12} /> POSICIÓN
                </label>
                <Select value={cameraPos} onValueChange={setCameraPos}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 rounded-xl h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="front">FRENTE</SelectItem>
                    <SelectItem value="side">LATERAL</SelectItem>
                    <SelectItem value="top">CENITAL</SelectItem>
                    <SelectItem value="bottom">NADIR</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 col-span-2 lg:col-span-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2 px-1">
                   <Camera size={12} /> DISTANCIA
                </label>
                <Select value={cameraDistance} onValueChange={setCameraDistance}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 rounded-xl h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="close_up">PRIMER PLANO</SelectItem>
                    <SelectItem value="medium_shot">PLANO MEDIO</SelectItem>
                    <SelectItem value="long_shot">PLANO GENERAL</SelectItem>
                    <SelectItem value="macro">MACRO</SelectItem>
                    <SelectItem value="panoramic">PANORÁMICA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="mt-auto space-y-3">
            {originalImage && (
              <div className="relative aspect-square w-full rounded-xl overflow-hidden border border-indigo-500/50 bg-slate-950 group">
                <img src={originalImage} className="w-full h-full object-cover" alt="Referencia" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                   <Button 
                    variant="destructive" 
                    size="sm" 
                    className="h-8 text-[10px] uppercase font-bold"
                    onClick={() => {
                      setOriginalImage(null);
                      toast.info("Imagen de referencia eliminada");
                    }}
                  >
                    Eliminar
                  </Button>
                </div>
                <div className="absolute top-2 left-2 bg-indigo-600 text-white text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-widest">
                  REF ACTIVA
                </div>
              </div>
            )}
            <Button 
              variant="outline" 
              className={cn(
                "w-full border-slate-800 bg-slate-950 hover:bg-slate-800 text-[10px] h-12 lg:h-14 rounded-xl flex flex-col items-center justify-center gap-0.5",
                originalImage && "border-indigo-500/30"
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex items-center gap-2 font-bold">
                <ImageIcon size={14} /> 
                <span>{originalImage ? "CAMBIAR REF" : "REFERENCIA"}</span>
              </div>
            </Button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
          </div>
        </div>
      </ScrollArea>
    </section>
  );

  const historySection = (
    <section className={cn(
      "w-full h-full bg-slate-900 border border-slate-800 rounded-2xl p-4 lg:p-5 flex flex-col shadow-xl overflow-hidden",
      mobileTab !== "history" && "hidden lg:flex"
    )}>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
         <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">HISTORIAL</p>
         <div className="flex-1 min-h-0 overflow-hidden">
           <ScrollArea className="h-full pr-1">
              <div className="grid grid-cols-4 lg:grid-cols-2 gap-2 pb-16">
                 {recentImages.length > 0 ? (
                   recentImages.map(img => (
                     <button 
                       key={img.id} 
                       className="aspect-square bg-slate-950 rounded-xl border border-slate-800/50 overflow-hidden group/item relative shadow-inner"
                       onClick={() => {
                         setGeneratedImage(img.url);
                         setPrompt(img.prompt);
                       }}
                     >
                       <img src={img.url} className="w-full h-full object-cover group-hover/item:scale-110 transition-transform" />
                       <div className="absolute inset-0 bg-indigo-500/0 group-hover/item:bg-indigo-500/10 transition-colors" />
                     </button>
                   ))
                 ) : (
                   Array.from({ length: 4 }).map((_, i) => (
                     <div key={i} className="aspect-square bg-slate-950 rounded-xl border border-slate-800/50" />
                   ))
                 )}
              </div>
           </ScrollArea>
         </div>
      </div>

      <div className="hidden lg:flex space-y-3 pt-3 mt-auto border-t border-slate-800/50 flex-col">
         <div className="flex justify-between items-center text-[10px] font-mono">
            <span className="text-slate-500">GPU LOAD:</span>
            <span className="text-indigo-400">12%</span>
         </div>
         <div className="h-1 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div className="h-full bg-indigo-500 w-1/3 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
         </div>
      </div>

      <div className="pt-2 border-t border-slate-800/50 hidden lg:block">
         <Button variant="ghost" className="w-full text-[9px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-300 h-8" onClick={() => toast.info("Historial v3.1")}>
            SISTEMA ACTIVO
         </Button>
      </div>
    </section>
  );

  return (
    <div className="h-full min-h-screen lg:h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* Mobile view */}
      <div className="lg:hidden flex flex-col h-full overflow-y-auto pb-24 p-2 gap-2">
        {mobileTab === 'canvas' && canvasSection}
        {mobileTab === 'editor' && promptSection}
        {mobileTab === 'tools' && toolsSection}
        {mobileTab === 'history' && historySection}

        {/* Mobile Navigation Bar */}
        <div className="fixed bottom-4 left-4 right-4 bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl h-16 flex items-center justify-around px-2 z-[100] shadow-2xl">
          {[
            { id: 'canvas', icon: Layout, label: 'Lienzo' },
            { id: 'editor', icon: Type, label: 'Editor' },
            { id: 'tools', icon: Settings, label: 'Ajustes' },
            { id: 'history', icon: History, label: 'Flujo' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setMobileTab(tab.id as any)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 w-16 h-12 rounded-xl transition-all",
                mobileTab === tab.id 
                  ? "text-indigo-400 bg-indigo-500/10" 
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              <tab.icon size={20} />
              <span className="text-[9px] font-bold uppercase tracking-tighter">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Desktop view with Resizable Panels */}
      <div className="hidden lg:flex h-full p-2 lg:p-4 gap-2 lg:gap-4 overflow-hidden">
        <PanelGroup orientation="horizontal" className="h-full w-full">
          {/* Left Panel: Tools */}
          <Panel defaultSize={15} minSize={10} className="h-full">
            {toolsSection}
          </Panel>

          <PanelResizeHandle className="w-1.5 transition-colors hover:bg-indigo-500/30 rounded-full mx-1" />

          {/* Middle Panel: Canvas + Prompt */}
          <Panel defaultSize={65} minSize={30} className="h-full">
            <PanelGroup orientation="vertical" className="h-full">
              <Panel defaultSize={70} minSize={20} className="h-full">
                {canvasSection}
              </Panel>
              
              <PanelResizeHandle className="h-1.5 transition-colors hover:bg-indigo-500/30 rounded-full my-1" />
              
              <Panel defaultSize={30} minSize={15} className="h-full">
                {promptSection}
              </Panel>
            </PanelGroup>
          </Panel>

          <PanelResizeHandle className="w-1.5 transition-colors hover:bg-indigo-500/30 rounded-full mx-1" />

          {/* Right Panel: History */}
          <Panel defaultSize={20} minSize={15} className="h-full">
            {historySection}
          </Panel>
        </PanelGroup>
      </div>

      {/* Variations Selection Modal (Shared) */}
      <Dialog open={showVariationsModal} onOpenChange={setShowVariationsModal}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-2 text-indigo-400">
              <Sparkles size={20} /> {t('editor.variations_title')}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {t('editor.variations_desc', { count: sessionVariations.length })}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 p-6">
            <div className={cn(
              "grid gap-4",
              sessionVariations.length <= 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-2 md:grid-cols-3"
            )}>
              {sessionVariations.map((url, idx) => (
                <motion.button
                  key={idx}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="group relative aspect-square bg-black rounded-2xl overflow-hidden border border-slate-800 hover:border-indigo-500/50 transition-all shadow-lg"
                  onClick={() => {
                    setGeneratedImage(url);
                    setShowVariationsModal(false);
                  }}
                >
                  <img src={url} alt={`Variación ${idx + 1}`} className="w-full h-full object-contain" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 translate-y-full group-hover:translate-y-0 transition-transform">
                    <p className="text-[10px] font-bold text-white uppercase text-center">{t('editor.select_variation', { id: idx + 1 })}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </ScrollArea>
          
          <div className="p-6 border-t border-slate-800 flex justify-end">
            <Button variant="outline" className="bg-slate-800 border-slate-700 hover:bg-slate-700" onClick={() => setShowVariationsModal(false)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

}
