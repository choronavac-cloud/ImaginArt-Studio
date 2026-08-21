/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Users, 
  Image as ImageIcon, 
  Upload, 
  Sparkles, 
  Download, 
  ArrowRight,
  Maximize2
} from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { swapAI } from '@/lib/gemini';
import { saveGalleryItem } from '@/services/storage';
import { logError } from '@/lib/logger';

export default function SwapView() {
  const { t } = useTranslation();
  const [sceneImage, setSceneImage] = useState<string | null>(null);
  const [participantsImage, setParticipantsImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const sceneInputRef = useRef<HTMLInputElement>(null);
  const participantsInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'scene' | 'participants') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (type === 'scene') setSceneImage(result);
        else setParticipantsImage(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSwap = async () => {
    if (!sceneImage || !participantsImage) {
      return toast.error(t('editor.swap_missing_images') || "Se requieren ambas imágenes");
    }

    setLoading(true);
    try {
      const sceneParts = sceneImage.split(';');
      const sceneBase64 = sceneParts[1].split(',')[1];
      const sceneMime = sceneParts[0].split(':')[1];
      
      const partParts = participantsImage.split(';');
      const partBase64 = partParts[1].split(',')[1];
      const partMime = partParts[0].split(':')[1];
      
      const result = await swapAI(
        { data: sceneBase64, mimeType: sceneMime },
        { data: partBase64, mimeType: partMime },
        { highQuality: true }
      );
      
      setResultImage(result);
      toast.success(t('common.success'));
      
      await saveGalleryItem('swap', {
        id: crypto.randomUUID(),
        url: result,
        prompt: "AI SWAP",
        timestamp: new Date().toISOString(),
        category: 'swap',
        metadata: {
          style: "swap",
          // Could save URLs of scene/part images if needed, but they are base64 strings (large)
        }
      });
    } catch (error: any) {
      logError(error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!resultImage) return;
    const link = document.createElement('a');
    link.href = resultImage;
    link.download = `swap-${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 p-4 lg:p-6 overflow-hidden">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl">
              <Users size={24} />
            </div>
            {t('app.swap')}
          </h1>
          <p className="text-slate-400 text-sm mt-1">Clona el estilo de una escena con nuevos participantes</p>
        </div>
        
        <div className="flex gap-2">
            <Button 
                variant="outline" 
                className="bg-slate-900 border-slate-800 text-slate-300 rounded-xl"
                onClick={() => {
                    setSceneImage(null);
                    setParticipantsImage(null);
                    setResultImage(null);
                }}
            >
                Limpiar todo
            </Button>
            <Button 
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-900/40"
                onClick={handleSwap}
                disabled={loading || !sceneImage || !participantsImage}
            >
                {loading ? "Procesando..." : "Ejecutar Swap"}
            </Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
        {/* Step 1: Scene */}
        <Card className="bg-slate-900/50 border-slate-800 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">1. ESCENA (FONDO/ESTILO)</span>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={() => sceneInputRef.current?.click()}>
                    <Upload size={14} />
                </Button>
            </div>
            <div 
                className={cn(
                    "flex-1 flex flex-col items-center justify-center p-4 cursor-pointer group relative",
                    !sceneImage && "hover:bg-slate-800/30 transition-colors"
                )}
                onClick={() => sceneInputRef.current?.click()}
            >
                {sceneImage ? (
                    <img src={sceneImage} className="max-h-full max-w-full object-contain rounded-lg shadow-2xl" alt="Scene" />
                ) : (
                    <div className="flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4 text-slate-500 group-hover:scale-110 transition-transform">
                            <ImageIcon size={32} />
                        </div>
                        <p className="text-sm font-medium text-slate-400">Sube la escena de referencia</p>
                        <p className="text-[10px] text-slate-500 mt-2">Esta imagen define el fondo y el look</p>
                    </div>
                )}
                <input type="file" ref={sceneInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'scene')} />
            </div>
        </Card>

        {/* Step 2: Participants */}
        <Card className="bg-slate-900/50 border-slate-800 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">2. NUEVOS PARTICIPANTES</span>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={() => participantsInputRef.current?.click()}>
                    <Upload size={14} />
                </Button>
            </div>
            <div 
                className={cn(
                    "flex-1 flex flex-col items-center justify-center p-4 cursor-pointer group relative",
                    !participantsImage && "hover:bg-slate-800/30 transition-colors"
                )}
                onClick={() => participantsInputRef.current?.click()}
            >
                {participantsImage ? (
                    <img src={participantsImage} className="max-h-full max-w-full object-contain rounded-lg shadow-2xl" alt="Participants" />
                ) : (
                    <div className="flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4 text-slate-500 group-hover:scale-110 transition-transform">
                            <Users size={32} />
                        </div>
                        <p className="text-sm font-medium text-slate-400">Sube los personajes</p>
                        <p className="text-[10px] text-slate-500 mt-2">Sus rostros serán transferidos a la escena</p>
                    </div>
                )}
                <input type="file" ref={participantsInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'participants')} />
            </div>
        </Card>

        {/* Result */}
        <Card className="bg-slate-900 border-indigo-500/20 flex flex-col overflow-hidden lg:shadow-2xl lg:shadow-indigo-900/10 relative">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                    <Sparkles size={12} /> RESULTADO FINAL
                </span>
                {resultImage && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-400" onClick={handleDownload}>
                        <Download size={14} />
                    </Button>
                )}
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden">
                {loading ? (
                    <div className="flex flex-col items-center">
                        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
                        <p className="text-sm text-slate-400 animate-pulse font-medium">Reconstruyendo escena con IA...</p>
                    </div>
                ) : resultImage ? (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full h-full flex items-center justify-center"
                    >
                         <img src={resultImage} className="max-h-full max-w-full object-contain rounded-lg shadow-2xl" alt="Result" />
                    </motion.div>
                ) : (
                    <div className="text-center p-8">
                        <div className="w-20 h-20 bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-700">
                             <ArrowRight size={40} />
                        </div>
                        <p className="text-slate-500 text-sm italic">Configura el swap y presiona el botón superior para ver la magia.</p>
                    </div>
                )}

                {/* Decorative particles for result */}
                {resultImage && !loading && (
                    <div className="absolute inset-0 pointer-events-none">
                         <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-indigo-400 rounded-full animate-ping" />
                         <div className="absolute bottom-1/4 right-1/4 w-1 h-1 bg-indigo-400 rounded-full animate-ping [animation-delay:1s]" />
                    </div>
                )}
            </div>
            
            {resultImage && !loading && (
                 <div className="p-4 bg-slate-950/50 border-t border-slate-800">
                    <Button 
                        variant="secondary" 
                        className="w-full justify-center gap-2 rounded-xl h-11 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                        onClick={handleDownload}
                    >
                        <Download size={16} />
                        DESCARGAR RESULTADO
                    </Button>
                 </div>
            )}
        </Card>
      </div>
    </div>
  );
}
