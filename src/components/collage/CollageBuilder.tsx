
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Layout, 
  Square, 
  Grid2X2, 
  Grid3X3, 
  Download,
  Save,
  Plus,
  Shuffle,
  Maximize,
  Columns,
  Rows,
  RefreshCw
} from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { getGalleryItems, GalleryItem, GalleryCategory } from '@/services/storage';

import { cn, sanitizeHtml2CanvasDoc, sanitizedHtml2Canvas } from '@/lib/utils';

export default function CollageBuilder() {
  const { t } = useTranslation();
  const [images, setImages] = useState<GalleryItem[]>([]);
  const [selectedImages, setSelectedImages] = useState<GalleryItem[]>([]);
  const [layout, setLayout] = useState<'grid-2' | 'grid-4' | 'horizontal' | 'vertical' | 'mosaic'>('grid-4');
  const collageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    const categories: GalleryCategory[] = ['generation', 'analysis', 'swap', 'history', 'collage'];
    let allItems: GalleryItem[] = [];
    for (const cat of categories) {
      const items = await getGalleryItems(cat);
      allItems = [...allItems, ...items];
    }
    setImages(allItems);
  };

  const toggleImage = (img: GalleryItem) => {
    const exists = selectedImages.some(i => i.id === img.id);
    if (exists) {
      setSelectedImages(selectedImages.filter(i => i.id !== img.id));
    } else {
      if (selectedImages.length >= 6) {
        toast.warning("Máximo 6 imágenes por collage");
        return;
      }
      setSelectedImages([...selectedImages, img]);
    }
  };

  const smartShuffle = () => {
    if (selectedImages.length < 2) return;
    const shuffled = [...selectedImages].sort(() => Math.random() - 0.5);
    setSelectedImages(shuffled);
    toast.info("Arreglo inteligente sugerido");
  };

  const [exporting, setExporting] = useState(false);
  const handleSaveCollage = async () => {
    if (!collageRef.current || selectedImages.length < 2) return;
    
    setExporting(true);
    try {
      // Small delay to ensure any layout transitions are finished
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const canvas = await sanitizedHtml2Canvas(collageRef.current, {
        useCORS: true,
        backgroundColor: '#000000',
        scale: 2, // Export at 2x resolution
        logging: true, // Enable logging to see more details in console if it fails
        onclone: (clonedDoc) => {
          // Additional cleanup for the cloned document if needed
          const element = clonedDoc.getElementById('collage-capture-area');
          if (element) {
            element.style.backgroundColor = '#000000';
          }
          sanitizeHtml2CanvasDoc(clonedDoc);
        }
      });

      const dataUrl = canvas.toDataURL('image/png');
      const blob = await (await fetch(dataUrl)).blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `collage-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      
      toast.success("Collage exportado exitosamente");
    } catch (error: any) {
      console.error("Export failed", error);
      toast.error(`Error al exportar el collage: ${error.message || 'Error desconocido'}`);
    } finally {
      setExporting(false);
    }
  };

  const getLayoutClass = () => {
    switch (layout) {
      case 'grid-4': return 'grid-cols-2 grid-rows-2';
      case 'grid-2': return selectedImages.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 grid-rows-2';
      case 'horizontal': return 'flex flex-row';
      case 'vertical': return 'flex flex-col';
      case 'mosaic': return 'grid grid-cols-3 gap-1';
      default: return 'grid-cols-2';
    }
  };

  return (
    <div className="flex h-full p-6 bg-slate-950 gap-6 overflow-hidden">
      {/* Sidebar - Gallery Selection */}
      <section className="w-80 bg-slate-900 border border-slate-800 rounded-3xl flex flex-col shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-800">
           <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">GALERÍA DISPONIBLE</h2>
           <p className="text-[10px] text-slate-600 mt-1 uppercase font-bold tracking-tighter">{selectedImages.length} SELECCIONADAS</p>
        </div>
        
        <ScrollArea className="flex-1 min-h-0">
           <div className="p-4 grid grid-cols-2 gap-2">
              {images.map(img => (
                <button 
                  key={img.id} 
                  onClick={() => toggleImage(img)}
                  className={cn(
                    "aspect-square rounded-xl overflow-hidden border-2 transition-all relative group",
                    selectedImages.some(i => i.id === img.id) ? "border-indigo-500 scale-95 shadow-inner" : "border-transparent opacity-60 hover:opacity-100"
                  )}
                >
                  <img src={img.url} className="w-full h-full object-cover" />
                  {selectedImages.some(i => i.id === img.id) && (
                    <div className="absolute inset-0 bg-indigo-500/20 flex items-center justify-center">
                       <Plus size={24} className="text-white drop-shadow-lg" />
                    </div>
                  )}
                </button>
              ))}
           </div>
        </ScrollArea>
      </section>

      {/* Main Builder Area */}
      <section className="flex-1 bg-slate-900 border border-slate-800 rounded-3xl flex flex-col shadow-2xl overflow-hidden">
        <div className="p-8 border-b border-slate-800 flex items-center justify-between">
           <div>
              <h2 className="text-3xl font-bold tracking-tight text-white uppercase">Collage Master</h2>
              <p className="text-xs text-slate-500 mt-1 font-bold tracking-widest uppercase">Diseño y Composición</p>
           </div>
           <div className="flex gap-3">
              <Button variant="outline" className="rounded-xl border-slate-800 bg-slate-950 hover:bg-slate-800 text-[10px] font-bold h-10 gap-2" onClick={() => setSelectedImages([])}>
                REINICIAR
              </Button>
              <Button 
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold h-10 gap-2 px-6 shadow-lg shadow-indigo-500/20" 
                onClick={handleSaveCollage} 
                disabled={selectedImages.length < 2 || exporting}
              >
                {exporting ? <RefreshCw className="animate-spin" size={14} /> : <Download size={14} />} 
                EXPORTAR 4K
              </Button>
           </div>
        </div>

        <div className="flex-1 flex gap-8 p-10 overflow-hidden">
           {/* Layout Controls */}
           <div className="w-48 space-y-6">
              <div className="space-y-4">
                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">PLANTILLAS</p>
                 <div className="grid grid-cols-1 gap-2">
                    {[
                      { id: 'grid-4', label: 'GRID 2x2', icon: Grid2X2 },
                      { id: 'mosaic', label: 'MOSAICO', icon: Grid3X3 },
                      { id: 'horizontal', label: 'STRIP H', icon: Rows },
                      { id: 'vertical', label: 'STRIP V', icon: Columns },
                    ].map(l => (
                      <button 
                        key={l.id}
                        onClick={() => setLayout(l.id as any)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl text-[10px] font-bold uppercase transition-all border",
                          layout === l.id ? "bg-slate-800 border-indigo-500 text-white" : "bg-slate-950 border-slate-800 text-slate-500 hover:bg-slate-900"
                        )}
                      >
                        <l.icon size={14} /> {l.label}
                      </button>
                    ))}
                 </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-slate-800">
                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">OPTIMIZACIÓN IA</p>
                 <Button 
                   variant="outline" 
                   className="w-full justify-start gap-3 h-12 rounded-xl bg-slate-950 border-slate-800 text-[10px] font-bold hover:bg-indigo-500/10 hover:border-indigo-500/30 text-slate-300"
                   onClick={smartShuffle}
                   disabled={selectedImages.length < 2}
                 >
                   <Shuffle size={14} className="text-indigo-400" /> SUGERIR ARRERGLO
                 </Button>
              </div>
           </div>

           {/* Preview Canvas */}
           <div className="flex-1 bg-black rounded-[2.5rem] overflow-hidden shadow-inner flex items-center justify-center p-8 relative ring-1 ring-slate-800">
              <div className="absolute top-6 left-6 text-[10px] font-mono text-slate-600 uppercase tracking-widest">
                 PREVIEW_RENDER_4K
              </div>
              
              <div ref={collageRef} id="collage-capture-area" className={cn("w-full aspect-square max-w-xl transition-all duration-500", getLayoutClass())}>
                {selectedImages.length === 0 ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-slate-800 border-2 border-dashed border-slate-900 rounded-3xl">
                     <Layout size={64} />
                     <p className="text-[10px] font-bold tracking-widest uppercase">CONSTRUYE TU COMPOSICIÓN</p>
                  </div>
                ) : (
                  selectedImages.map((img, i) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, scale: 0.9 }} 
                      animate={{ opacity: 1, scale: 1 }} 
                      key={img.id} 
                      className={cn(
                        "relative group overflow-hidden border border-black/20",
                        layout === 'mosaic' && (i === 0 ? "col-span-2 row-span-2" : "")
                      )}
                    >
                      <img src={img.url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </motion.div>
                  ))
                )}
              </div>

              {exporting && (
                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md flex flex-col items-center justify-center z-50">
                   <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
                   <h3 className="text-xl font-bold text-white uppercase tracking-widest animate-pulse">RENDERIZANDO...</h3>
                   <p className="text-[10px] font-bold text-slate-500 uppercase mt-2">Optimizando capas en alta resolución</p>
                </div>
              )}
           </div>
        </div>
      </section>
    </div>
  );
}
