
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Globe, 
  Eye, 
  ShieldCheck, 
  History, 
  AlertCircle,
  FileText,
  UserCog,
  Check,
  ChevronsUpDown,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Command, 
  CommandEmpty, 
  CommandGroup, 
  CommandInput, 
  CommandItem, 
  CommandList 
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getSettings, saveSettings, AppSettings, clearAllData, exportGallery, importGallery } from '@/services/storage';
import FolderSelectorModal from '../gallery/FolderSelectorModal';

export default function SettingsPanel() {
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showFolderSelector, setShowFolderSelector] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [logs, setLogs] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        updateSetting('userPhotos', [...(settings?.userPhotos || []), base64]);
      };
      reader.readAsDataURL(file);
    }
  };

  const variationOptions = [
    { value: "1", label: "1 Variación" },
    { value: "2", label: "2 Variaciones" },
    { value: "3", label: "3 Variaciones" },
    { value: "4", label: "4 Variaciones" },
  ];

  useEffect(() => {
    async function load() {
      const data = await getSettings();
      setSettings(data);
    }
    load();
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/logs');
      const data = await response.json();
      setLogs(data.logs || 'No hay logs disponibles.');
      setShowLogs(true);
    } catch (error) {
      toast.error("Error al cargar los logs");
    }
  };

  const handleDeleteAllData = async () => {
    try {
      await clearAllData();
      toast.success("Todos los datos han sido eliminados");
      setShowDeleteConfirm(false);
      // Reload to reset state
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      toast.error("Error al eliminar los datos");
    }
  };

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const success = await importGallery(file);
        if (success) {
          toast.success("Datos importados correctamente");
          setTimeout(() => window.location.reload(), 1000);
        } else {
          toast.info("No se importó ningún dato nuevo");
        }
      } catch (error) {
        toast.error("Error al importar los datos");
      }
    }
  };

  const updateSetting = async (key: keyof AppSettings, value: any) => {
    if (!settings) return;
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await saveSettings(newSettings);
    
    if (key === 'language') {
      i18n.changeLanguage(value);
    }
    
    toast.success("Ajustes guardados");
  };

  if (!settings) return null;

  return (
    <ScrollArea className="h-full w-full">
      <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">{t('app.settings')}</h1>
        <p className="text-zinc-400">Personaliza tu experiencia y gestiona tu privacidad.</p>
      </div>

      <div className="grid gap-6">
        {/* Interface Settings */}
        <Card className="bg-zinc-900 border-zinc-800 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
               <Globe size={20} className="text-indigo-400" /> Interfaz
            </CardTitle>
            <CardDescription>Ajusta el idioma y disposición.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <span>Idioma de Interfaz</span>
              <Select value={settings.language} onValueChange={(val) => updateSetting('language', val)}>
                <SelectTrigger className="w-40 bg-zinc-800 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center justify-between">
              <span>Posición del Taskbar</span>
              <Select value={settings.taskbarPosition} onValueChange={(val) => updateSetting('taskbarPosition', val)}>
                <SelectTrigger className="w-40 bg-zinc-800 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="top">Arriba</SelectItem>
                  <SelectItem value="bottom">Abajo</SelectItem>
                  <SelectItem value="left">Izquierda</SelectItem>
                  <SelectItem value="right">Derecha</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center justify-between">
              <span>Idioma de Generación (Prompts)</span>
              <Select value={settings.defaultGenerationLanguage} onValueChange={(val) => updateSetting('defaultGenerationLanguage', val)}>
                <SelectTrigger className="w-40 bg-zinc-800 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="es">Español (Original)</SelectItem>
                  <SelectItem value="en">English (Traducido)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center justify-between">
              <span>Unidad de Temperatura</span>
              <Select value={settings.temperatureUnit} onValueChange={(val) => updateSetting('temperatureUnit', val)}>
                <SelectTrigger className="w-40 bg-zinc-800 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="C">Celsius (°C)</SelectItem>
                  <SelectItem value="F">Fahrenheit (°F)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
              <div className="space-y-0.5">
                  <span className="block">Ruta de Google Drive</span>
                  <p className="text-xs text-zinc-500">Carpeta donde se guardan tus imágenes.</p>
              </div>
              <Button 
                variant="outline" 
                className="w-40 bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white" 
                onClick={() => setShowFolderSelector(true)}
              >
                  {settings.driveFolderPath || 'Seleccionar...'}
              </Button>
              <FolderSelectorModal 
                  open={showFolderSelector} 
                  onOpenChange={setShowFolderSelector} 
                  onSelect={(path) => updateSetting('driveFolderPath', path)}
              />
            </div>
          </CardContent>
        </Card>

        {/* AI Behavior */}
        <Card className="bg-zinc-900 border-zinc-800 text-white border-l-4 border-l-indigo-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
               <ShieldCheck size={20} className="text-green-400" /> Configuración de IA
            </CardTitle>
            <CardDescription>Ajusta el comportamiento de los modelos de generación y post-procesamiento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-10">
            <div className="space-y-6">
              <div className="flex items-center justify-between p-6 bg-indigo-500/5 rounded-3xl border border-indigo-500/10 shadow-inner">
                <div className="space-y-1.5">
                  <span className="font-black text-xl text-indigo-100 block tracking-tight">Variaciones por Generación</span>
                  <p className="text-sm text-zinc-400 max-w-[280px]">Selecciona cuántas versiones de una imagen quieres crear simultáneamente.</p>
                </div>
                
                <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={comboboxOpen}
                        className="w-32 h-16 bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400/30 rounded-2xl text-2xl font-black shadow-lg justify-between px-4 transition-all"
                      />
                    }
                  >
                    {settings.numVariations}
                    <ChevronsUpDown className="ml-2 h-6 w-6 shrink-0 opacity-50" />
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-0 bg-zinc-900 border-zinc-800">
                    <Command className="bg-transparent">
                      <CommandInput placeholder="Buscar..." className="text-white border-none focus:ring-0" />
                      <CommandList>
                        <CommandEmpty>No se encontró.</CommandEmpty>
                        <CommandGroup>
                          {variationOptions.map((option) => (
                            <CommandItem
                              key={option.value}
                              value={option.value}
                              onSelect={(currentValue) => {
                                updateSetting('numVariations', parseInt(currentValue) || 1);
                                setComboboxOpen(false);
                              }}
                              className="text-zinc-300 hover:bg-indigo-500 hover:text-white cursor-pointer"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  (settings.numVariations || 1).toString() === option.value ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {option.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-zinc-800 pt-6">
              <div className="space-y-0.5">
                <span className="font-medium">Ajuste automático de prompts</span>
                <p className="text-xs text-zinc-500">Mejora tus prompts automáticamente antes de enviar.</p>
              </div>
              <Switch 
                checked={settings.autoAdjustPrompts} 
                onCheckedChange={(val) => updateSetting('autoAdjustPrompts', val)}
              />
            </div>

            <div className="flex items-center justify-between border-t border-zinc-800 pt-6">
              <div className="space-y-0.5">
                <span className="font-medium">Escenas en una historia</span>
                <p className="text-xs text-zinc-500">Número de escenas / viñetas generadas al crear una nueva historia.</p>
              </div>
              <Select value={(settings.storyScenesCount || 4).toString()} onValueChange={(val) => updateSetting('storyScenesCount', parseInt(val) || 4)}>
                <SelectTrigger className="w-40 bg-zinc-800 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                  <SelectItem value="2">2 Escenas</SelectItem>
                  <SelectItem value="3">3 Escenas</SelectItem>
                  <SelectItem value="4">4 Escenas</SelectItem>
                  <SelectItem value="5">5 Escenas</SelectItem>
                  <SelectItem value="6">6 Escenas</SelectItem>
                  <SelectItem value="7">7 Escenas</SelectItem>
                  <SelectItem value="8">8 Escenas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Maintenance */}
        <Card className="bg-zinc-900 border-zinc-800 text-white shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
               <UserCog size={20} className="text-amber-400" /> {t('settings.user_management')}
            </CardTitle>
            <CardDescription className="text-zinc-400">Gestiona tu identidad y revisa la actividad del sistema.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              variant="outline" 
              className="w-full justify-start gap-3 border-zinc-800 hover:bg-zinc-800 text-zinc-100 bg-zinc-950/50"
              onClick={() => setShowProfile(true)}
            >
               <UserCog size={18} className="text-indigo-400" /> {t('settings.manage_profile')}
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start gap-3 border-zinc-800 hover:bg-zinc-800 text-zinc-100 bg-zinc-950/50"
              onClick={fetchLogs}
            >
               <FileText size={18} className="text-teal-400" /> {t('settings.view_error_logs')}
            </Button>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1 justify-start gap-3 border-zinc-800 hover:bg-zinc-800 text-zinc-100 bg-zinc-950/50"
                onClick={exportGallery}
              >
                 <FileText size={18} className="text-blue-400" /> Exportar
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 justify-start gap-3 border-zinc-800 hover:bg-zinc-800 text-zinc-100 bg-zinc-950/50"
                onClick={() => importInputRef.current?.click()}
              >
                 <FileText size={18} className="text-purple-400" /> Importar
              </Button>
              <input type="file" ref={importInputRef} className="hidden" accept=".json" onChange={handleImportData} />
            </div>
            
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-3 text-red-500 hover:bg-red-500/10 border-transparent transition-colors group"
              onClick={() => setShowDeleteConfirm(true)}
            >
               <AlertCircle size={18} className="group-hover:animate-pulse" /> {t('settings.clear_data')}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Profile Dialog */}
      <Dialog open={showProfile} onOpenChange={setShowProfile}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog size={20} className="text-indigo-400" /> Perfil de Usuario
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Información sobre tu sesión actual.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4 p-4 bg-zinc-950 rounded-xl border border-zinc-800">
              <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                <UserCog className="text-indigo-400" size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Invitado Local</p>
                <p className="text-xs text-zinc-500">Sesión basada en el navegador</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-xs p-2 rounded-lg bg-zinc-800/50">
                <span className="text-zinc-500 dark:text-zinc-400">ID de Dispositivo</span>
                <span className="text-zinc-300 font-mono">Anonymous-Local-Client</span>
              </div>
              <div className="flex justify-between text-xs p-2 rounded-lg bg-zinc-800/50">
                <span className="text-zinc-500 dark:text-zinc-400">Tipo de Almacenamiento</span>
                <span className="text-zinc-300 font-mono">IndexedDB (Persistente)</span>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-zinc-800">
               <h3 className="text-sm font-semibold text-white">Tus Fotos (Identidad "Yo")</h3>
               <div className="flex flex-wrap gap-2">
                 {settings.userPhotos?.map((photo, i) => (
                   <img key={i} src={photo} className="w-16 h-16 rounded-lg object-cover border border-zinc-700" alt={`Foto ${i}`} />
                 ))}
                 <Button variant="outline" size="sm" className="w-16 h-16 border-dashed border-zinc-700 hover:bg-zinc-800" onClick={() => fileInputRef.current?.click()}>
                    <Plus size={24} className="text-zinc-500" />
                 </Button>
               </div>
               <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowProfile(false)} className="bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logs Dialog */}
      <Dialog open={showLogs} onOpenChange={setShowLogs}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText size={20} className="text-teal-400" /> Logs del Sistema
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Registro detallado de errores y actividad reciente.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-80 w-full rounded-md border border-zinc-800 bg-black p-4">
            <pre className="text-[10px] font-mono text-zinc-400 whitespace-pre-wrap leading-relaxed">
              {logs}
            </pre>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogs('')} className="bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700">
              Limpiar Vista
            </Button>
            <Button variant="secondary" onClick={() => setShowLogs(false)} className="bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertCircle size={20} /> {t('settings.clear_data_confirm')}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {t('settings.clear_data_desc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)} className="text-zinc-400 hover:text-white hover:bg-zinc-800">
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDeleteAllData} className="bg-red-600 hover:bg-red-700 font-bold uppercase tracking-wide">
              {t('settings.clear_data_btn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </ScrollArea>
  );
}
