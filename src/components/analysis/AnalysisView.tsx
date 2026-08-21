/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle
} from 'react-resizable-panels';

import { 
  Search, 
  Upload, 
  Image as ImageIcon, 
  Shirt, 
  MapPin, 
  Accessibility, 
  Sun, 
  Users, 
  ClipboardCopy,
  Download,
  FileText,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { analyzeImage, AnalysisType } from '@/lib/gemini';
import Markdown from 'react-markdown';

const ANALYSIS_OPTIONS: { id: AnalysisType; icon: any; label: string; description: string }[] = [
  { id: 'full', icon: Search, label: 'Análisis Completo', description: 'Visión general detallada de toda la escena' },
  { id: 'clothing', icon: Shirt, label: 'Vestimenta', description: 'Detalle de ropa, estilos y accesorios' },
  { id: 'location', icon: MapPin, label: 'Sitio / Locación', description: 'Entorno, arquitectura y fondo' },
  { id: 'poses', icon: Accessibility, label: 'Poses / Actitud', description: 'Lenguaje corporal e interacción' },
  { id: 'lighting', icon: Sun, label: 'Iluminación', description: 'Fuentes de luz, sombras y color' },
  { id: 'participants', icon: Users, label: 'Participantes', description: 'Rasgos, expresiones e identidad' },
  { id: 'clone_prompt', icon: Sparkles, label: 'Prompt de Clonación', description: 'Genera el prompt técnico para replicar' },
];

export default function AnalysisView() {
  const { t } = useTranslation();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [analysisType, setAnalysisType] = useState<AnalysisType>('full');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSelectedImage(event.target?.result as string);
        setResult(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async (type?: AnalysisType) => {
    const typeToUse = type || analysisType;
    if (!selectedImage) return toast.error("Por favor, sube una imagen primero");
    
    setLoading(true);
    setAnalysisType(typeToUse);
    
    try {
      const sceneParts = selectedImage.split(';');
      const sceneBase64 = sceneParts[1].split(',')[1];
      const sceneMime = sceneParts[0].split(':')[1];
      
      const analysis = await analyzeImage(sceneBase64, sceneMime, typeToUse);
      setResult(analysis);
      toast.success("Análisis completado");
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    toast.success("Copiado al portapapeles");
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 p-4 lg:p-6 overflow-hidden">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl">
              <Search size={24} />
            </div>
            {t('app.analyze')}
          </h1>
          <p className="text-slate-400 text-sm mt-1">Análisis profundo de imágenes mediante visión artificial avanzada</p>
        </div>
      </div>

      <PanelGroup orientation="horizontal" className="flex-1 min-h-0 gap-6">
        {/* Left column: Image & Options */}
        <Panel defaultSize={40} minSize={30} className="flex flex-col gap-6 overflow-hidden">
          {/* Image Upload Area */}
          <Card 
            className={cn(
              "relative aspect-video lg:aspect-square bg-slate-900 border-slate-800 flex flex-col items-center justify-center p-4 cursor-pointer group overflow-hidden transition-all",
              selectedImage ? "ring-2 ring-indigo-500/20" : "hover:bg-slate-800/50"
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            {selectedImage ? (
              <>
                <img src={selectedImage} className="max-h-full max-w-full object-contain rounded-lg shadow-2xl" alt="To analyze" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-white text-xs font-bold uppercase tracking-wider">
                    <Upload size={14} /> Cambiar Imagen
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center text-center p-8">
                <div className="w-20 h-20 rounded-3xl bg-slate-800 flex items-center justify-center mb-6 text-slate-500 group-hover:scale-110 group-hover:bg-slate-700 transition-all duration-500">
                  <ImageIcon size={40} />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Subir imagen para analizar</h3>
                <p className="text-slate-500 text-sm max-w-xs">Arrastra o haz clic para subir una foto. Gemini analizará cada detalle por ti.</p>
              </div>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
          </Card>

          {/* Analysis Options Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto pr-2">
            {ANALYSIS_OPTIONS.map((opt) => (
              <Button
                key={opt.id}
                variant="outline"
                className={cn(
                  "h-auto flex flex-col items-start p-4 gap-2 rounded-2xl transition-all border-slate-800",
                  analysisType === opt.id && selectedImage ? "bg-indigo-600/10 border-indigo-500/50 text-white" : "bg-slate-900/50 text-slate-400 hover:bg-slate-800 hover:text-white"
                )}
                onClick={() => handleAnalyze(opt.id)}
                disabled={loading || !selectedImage}
              >
                <div className={cn(
                  "p-2 rounded-xl transition-colors",
                  analysisType === opt.id && selectedImage ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-500"
                )}>
                  <opt.icon size={18} />
                </div>
                <div className="text-left">
                  <div className="text-[11px] font-bold uppercase tracking-wider">{opt.label}</div>
                  <div className="text-[10px] opacity-60 leading-tight mt-0.5">{opt.description}</div>
                </div>
              </Button>
            ))}
          </div>
        </Panel>

        <PanelResizeHandle className="w-2 bg-slate-800 hover:bg-slate-700 transition rounded-lg" />

        {/* Right column: Results */}
        <Panel defaultSize={60} minSize={40} className="flex flex-col bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative">
          <div className="p-4 lg:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 backdrop-blur-md z-10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                <FileText size={18} />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">RESULTADO DEL ANÁLISIS</span>
                <span className="text-sm font-bold text-white uppercase">{ANALYSIS_OPTIONS.find(o => o.id === analysisType)?.label}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {result && (
                <>
                  <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white" onClick={copyToClipboard} title="Copiar">
                    <ClipboardCopy size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white" title="Descargar como PDF">
                    <Download size={16} />
                  </Button>
                </>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1 p-6 relative">
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center"
                >
                  <div className="relative mb-8">
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      className="w-32 h-32 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full" 
                    />
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: [0.8, 1.1, 1], opacity: 1 }}
                      transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-400 bg-indigo-500/10 p-6 rounded-3xl backdrop-blur-sm border border-indigo-500/20 shadow-[0_0_30px_rgba(99,102,241,0.2)]"
                    >
                      {React.createElement(ANALYSIS_OPTIONS.find(o => o.id === analysisType)?.icon || Search, { size: 40 })}
                    </motion.div>
                    
                    {/* Scanning rays effect */}
                    <motion.div 
                      animate={{ 
                        opacity: [0.2, 0.5, 0.2],
                        scale: [1, 1.2, 1]
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute -inset-4 bg-indigo-500/5 rounded-full blur-2xl"
                    />
                  </div>
                  
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <h3 className="text-white font-bold text-xl mb-2 flex items-center justify-center gap-2">
                      Procesando {ANALYSIS_OPTIONS.find(o => o.id === analysisType)?.label} 
                      <span className="flex gap-1">
                        <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" />
                      </span>
                    </h3>
                    <p className="text-slate-500 text-sm max-w-sm mx-auto leading-relaxed">
                      Utilizando modelos de visión profunda para examinar cada píxel y generar un informe {analysisType === 'full' ? 'omnicomprensivo' : 'especializado'}.
                    </p>
                  </motion.div>

                  {/* Progress info */}
                  <div className="mt-12 flex flex-col items-center gap-2 w-full max-w-xs">
                    <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ x: "-100%" }}
                        animate={{ x: "100%" }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                        className="w-1/2 h-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent"
                      />
                    </div>
                    <div className="flex justify-between w-full text-[10px] font-bold text-slate-600 uppercase tracking-widest px-1">
                      <span>Neural Scan</span>
                      <span>Vision AI v3.0</span>
                    </div>
                  </div>
                </motion.div>
              ) : result ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="prose prose-invert prose-slate max-w-none prose-p:text-slate-300 prose-p:leading-relaxed prose-headings:text-white prose-headings:font-bold prose-strong:text-indigo-400 w-full h-full overflow-y-auto"
                >
                  <div className="markdown-body w-full">
                    <Markdown>{result}</Markdown>
                  </div>
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-20">
                  <Search size={48} className="text-slate-600 mb-6" />
                  <p className="text-slate-500 font-medium italic max-w-xs">
                    {selectedImage 
                      ? "Selecciona una categoría a la izquierda para iniciar el análisis profundo." 
                      : "Sube una imagen para desbloquear las herramientas de análisis."}
                  </p>
                </div>
              )}
            </AnimatePresence>
          </ScrollArea>
          
          {/* Decorative scanner effect */}
          {loading && (
            <div className="absolute top-0 left-0 w-full h-[2px] bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)] z-20 animate-scan pointer-events-none" />
          )}
        </Panel>
      </PanelGroup>
    </div>
  );
}
