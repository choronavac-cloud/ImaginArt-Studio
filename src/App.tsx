/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */


import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Plus, 
  Image as ImageIcon, 
  Settings as SettingsIcon, 
  BookOpen, 
  History, 
  Layout, 
  Sparkles,
  Users,
  Search,
  Menu,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import './lib/i18n';

import EditorContainer from './components/editor/EditorContainer';
import GalleryGrid from './components/gallery/GalleryGrid';
import StoryBoard from './components/history/StoryBoard';
import SettingsPanel from './components/settings/SettingsPanel';
import TutorialOverlay from './components/tutorial/TutorialOverlay';
import CollageBuilder from './components/collage/CollageBuilder';
import SwapView from './components/swap/SwapView';
import AnalysisView from './components/analysis/AnalysisView';
import DriveGalleryModal from './components/gallery/DriveGalleryModal';
import AboutDialog from './components/AboutDialog';
import WeatherWidget from './components/WeatherWidget';
import SignInButton from './components/auth/SignInButton';                
import { getSettings, AppSettings } from './services/storage';

type View = 'generate' | 'gallery' | 'history' | 'collage' | 'swap' | 'analyze' | 'settings' | 'tutorial';

export default function App() {
  const { t, i18n } = useTranslation();
  const [activeView, setActiveView] = useState<View>('generate');
  const [initialImageId, setInitialImageId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showDrive, setShowDrive] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);

  useEffect(() => {
    async function init() {
      const savedSettings = await getSettings();
      setSettings(savedSettings);
      if (savedSettings.language) {
        i18n.changeLanguage(savedSettings.language);
      }
    }
    init();

    const handleViewChange = (e: any) => {
      if (typeof e.detail === 'string') {
        setActiveView(e.detail);
        setInitialImageId(null);
      } else {
        setActiveView(e.detail.view);
        setInitialImageId(e.detail.imageId || null);
      }
    };
    
    // Simple way to react to settings changes
    const handleStorage = () => {
        init();
    };

    window.addEventListener('changeView', handleViewChange);
    window.addEventListener('storage', handleStorage);
    return () => {
        window.removeEventListener('changeView', handleViewChange);
        window.removeEventListener('storage', handleStorage);
    };
  }, [i18n]);

  const updateTaskbarPosition = async (pos: 'top' | 'bottom' | 'left' | 'right') => {
    if (!settings) return;
    const newSettings = { ...settings, taskbarPosition: pos };
    setSettings(newSettings);
    await import('./services/storage').then(m => m.saveSettings(newSettings));
  };

  const navItems = [
    { id: 'generate', icon: Sparkles, label: t('app.generate') },
    { id: 'analyze', icon: Search, label: t('app.analyze') },
    { id: 'swap', icon: Users, label: t('app.swap') },
    { id: 'gallery', icon: ImageIcon, label: t('app.gallery') },
    { id: 'history', icon: History, label: t('app.history') },
    { id: 'collage', icon: Layout, label: t('app.collage') },
    { id: 'settings', icon: SettingsIcon, label: t('app.settings') },
    { id: 'tutorial', icon: BookOpen, label: t('app.tutorial') },
  ];

  const pos = settings?.taskbarPosition || 'top';
  const isHorizontal = pos === 'top' || pos === 'bottom';

  return (
    <TooltipProvider>
      <div 
        className={cn("flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden", 
          isHorizontal ? (pos === 'bottom' ? "flex-col-reverse" : "flex-col") : pos === 'left' ? "flex-row" : "flex-row-reverse"
      )}
      onClick={() => setContextMenu(null)}
      >
        {/* Taskbar */}
        <motion.aside
          initial={false}
          className={cn(
            "border-slate-800 bg-slate-900/80 backdrop-blur-md flex items-center transition-all duration-300 z-10 m-2 rounded-2xl p-2",
            isHorizontal ? "flex-row" : "flex-col"
          )}
          onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY });
          }}
        >
          <div className={cn("flex items-center justify-center shrink-0", isHorizontal ? "px-2" : "py-2")}>
            <button 
              onClick={() => setShowAbout(true)}
              onDoubleClick={() => setShowAbout(true)}
              className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20 hover:scale-105 transition-transform cursor-pointer"
            >
              <Sparkles className="text-white w-5 h-5" />
            </button>
          </div>
    
          <div className={cn("flex-1 overflow-auto flex items-center", isHorizontal ? "gap-1.5 px-2" : "flex-col gap-1.5 py-2")}>
            <nav className={cn("flex", isHorizontal ? "flex-row gap-1.5" : "flex-col gap-1.5")}>
              {navItems.map((item) => (
                <Button
                  key={item.id}
                  variant={activeView === item.id ? "secondary" : "ghost"}
                  className={cn(
                    "justify-start gap-2 px-3 h-9 rounded-xl transition-all",
                    activeView === item.id 
                      ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" 
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  )}
                  onClick={() => setActiveView(item.id as View)}
                >
                  <item.icon size={16} />
                  {isHorizontal && <span className="text-xs font-medium">{item.label}</span>}
                </Button>
              ))}
            </nav>
          </div>
          
          <WeatherWidget isHorizontal={isHorizontal} />
    
          <div className={cn("border-slate-800/50 flex items-center justify-center", isHorizontal ? "px-2 border-l" : "py-2 border-t")}>
             <SignInButton />
          </div>
        </motion.aside>

        <AboutDialog open={showAbout} onOpenChange={setShowAbout} />
        <DriveGalleryModal open={showDrive} onOpenChange={setShowDrive} />

        {contextMenu && (
            <div 
              className="fixed bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-1 z-50 text-[10px] uppercase font-bold"
              style={{ top: contextMenu.y, left: contextMenu.x }}
            >
                {['top', 'bottom', 'left', 'right'].map((p) => (
                    <button key={p} className="block w-full text-left px-4 py-2 hover:bg-slate-800 rounded" onClick={(e) => { e.stopPropagation(); updateTaskbarPosition(p as any); }}>
                        {p}
                    </button>
                ))}
            </div>
        )}

        {/* Main Content */}
        <main className="flex-1 relative flex flex-col overflow-hidden">
           <AnimatePresence mode="wait">
             <motion.div
               key={activeView}
               initial={{ opacity: 0, scale: 0.98 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 1.02 }}
               className="flex-1 min-h-0 rounded-3xl overflow-hidden p-2"
             >
               <div className="h-full w-full">
                 {activeView === 'generate' && <EditorContainer />}
                 {activeView === 'gallery' && <GalleryGrid />}
                 {activeView === 'history' && <StoryBoard initialImageId={initialImageId} onStoryCreated={() => setInitialImageId(null)} />}
                 {activeView === 'collage' && <CollageBuilder />}
                 {activeView === 'swap' && <SwapView />}
                 {activeView === 'analyze' && <AnalysisView />}
                 {activeView === 'settings' && <SettingsPanel />}
                 {activeView === 'tutorial' && <TutorialOverlay onClose={() => setActiveView('generate')} />}
               </div>
             </motion.div>
           </AnimatePresence>
        </main>
        
        <Toaster closeButton position="bottom-right" richColors theme="dark" />
      </div>
    </TooltipProvider>
  );
}

