
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Download, 
  Trash2, 
  Search, 
  MoreVertical, 
  FileUp, 
  FileDown, 
  Share2,
  FolderPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle
} from 'react-resizable-panels';
import { toast } from 'sonner';
import DriveGalleryModal from './DriveGalleryModal';
import { getGalleryItems, deleteGalleryItem, exportGallery, importGallery, GalleryItem, GalleryCategory } from '@/services/storage';
import { cn } from '@/lib/utils';

export default function GalleryGrid() {
  const { t } = useTranslation();
  const [images, setImages] = useState<GalleryItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showDrive, setShowDrive] = useState(false);

  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    setLoading(true);
    try {
      const categories: GalleryCategory[] = ['generation', 'analysis', 'swap', 'history', 'collage'];
      let allItems: GalleryItem[] = [];
      for (const cat of categories) {
        const items = await getGalleryItems(cat);
        allItems = [...allItems, ...items];
      }
      setImages(allItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    } catch (e) {
      toast.error("Error al cargar galería");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (category: GalleryCategory, id: string) => {
    try {
      await deleteGalleryItem(category, id);
      setImages(prev => prev.filter(img => img.id !== id));
      toast.success(t('common.success'));
    } catch (e) {
      toast.error(t('common.error'));
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const imported = await importGallery(file);
        if (imported) {
          toast.success("Galería importada");
          loadImages();
        } else {
          toast.error("Archivo no contiene datos válidos");
        }
      } catch (err) {
        toast.error("Error al importar");
      }
    }
  };

  const filteredImages = images.filter(img => 
    img.prompt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PanelGroup orientation="horizontal" className="h-full bg-slate-950">
      <Panel defaultSize={20} minSize={15} className="bg-slate-900 border-r border-slate-800 p-6 flex flex-col gap-6">
         <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Filtros</h2>
         <Input 
           placeholder="Filtrar prompts..." 
           className="bg-slate-950 border-slate-800 rounded-xl"
           value={search}
           onChange={(e) => setSearch(e.target.value)}
        />
        <div className="mt-auto">
            <Button variant="outline" className="w-full rounded-xl border-slate-800 bg-slate-950 hover:bg-slate-800" onClick={() => setShowDrive(true)}>
               <ImageIcon size={16} className="mr-2" /> GOOGLE DRIVE
            </Button>
            <Button variant="outline" className="w-full mt-2 rounded-xl border-slate-800 bg-slate-950 hover:bg-slate-800" onClick={() => exportGallery()}>
              <FileDown size={16} className="mr-2" /> EXPORTAR
            </Button>
            <Button variant="outline" className="w-full mt-2 rounded-xl border-slate-800 bg-slate-950 hover:bg-slate-800" onClick={() => document.getElementById('import-input')?.click()}>
              <FileUp size={16} className="mr-2" /> IMPORTAR
            </Button>
            <input id="import-input" type="file" className="hidden" accept=".json" onChange={handleImport} />
        </div>
      </Panel>
      <PanelResizeHandle className="w-2 bg-slate-950 hover:bg-slate-800 transition" />
      <Panel defaultSize={80} minSize={50} className="p-4 lg:p-8 overflow-y-auto">
        <DriveGalleryModal open={showDrive} onOpenChange={setShowDrive} />
        <div className="max-w-[1600px] mx-auto space-y-8">
           <div className="flex items-end justify-between px-2">
             <div className="space-y-1">
               <h1 className="text-4xl font-bold tracking-tight text-white">{t('app.gallery')}</h1>
               <p className="text-slate-500 font-medium text-sm">
                  {images.length + ' activos'}
               </p>
             </div>
           </div>

           {loading ? (
             <div className="flex justify-center py-32">
                <div className="w-12 h-12 border-2 border-slate-800 border-t-indigo-500 rounded-full animate-spin" />
             </div>
           ) : filteredImages.length > 0 ? (
             ['generation', 'analysis', 'swap', 'history', 'collage'].map(cat => {
               const items = filteredImages.filter(i => i.category === cat);
               if (items.length === 0) return null;
               return (
                 <div key={cat} className="space-y-4">
                   <h3 className="text-white text-lg font-bold uppercase">{cat}</h3>
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 p-2">
                     {items.map((img) => (
                       <motion.div key={img.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="group relative">
                         <Card className="bg-slate-900 border-slate-800 overflow-hidden rounded-[2rem]">
                            <div className="aspect-square relative">
                              <img src={img.url} alt={img.prompt} className="object-contain w-full h-full" referrerPolicy="no-referrer" />
                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="sm" className="bg-black/50 text-white hover:bg-rose-500 rounded-full" onClick={() => handleDelete(img.category, img.id)}>
                                  <Trash2 size={16} />
                                </Button>
                              </div>
                            </div>
                         </Card>
                       </motion.div>
                      ))}
                   </div>
                 </div>
               );
             })
           ) : (
             <div className="text-center py-40 bg-slate-900/40 rounded-[3rem] border border-dashed border-slate-800">
                <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">VACÍO</p>
             </div>
           )}
        </div>
      </Panel>
    </PanelGroup>
  );
}

function ImageIcon({ className, size }: { className?: string; size?: number }) {
  return (
    <svg 
      className={className} 
      width={size || 24} 
      height={size || 24} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
      <circle cx="9" cy="9" r="2"/>
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
    </svg>
  );
}
