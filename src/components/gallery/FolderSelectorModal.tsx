import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { listDriveFolders, createDriveFolder } from '@/services/drive';
import { toast } from 'sonner';
import { 
  Folder, 
  FolderOpen, 
  ChevronRight, 
  ChevronDown, 
  FolderPlus, 
  Plus, 
  Loader2,
  FolderDot
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface FolderNode {
  id: string;
  name: string;
  parentId?: string;
  children: FolderNode[];
}

export default function FolderSelectorModal({ 
  open, 
  onOpenChange, 
  onSelect 
}: { 
  open: boolean, 
  onOpenChange: (open: boolean) => void,
  onSelect: (folderName: string) => void
}) {
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedFolderIds, setExpandedFolderIds] = useState<{ [id: string]: boolean }>({});
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  
  // Folder creation states
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      fetchFolders();
    }
  }, [open]);

  const fetchFolders = async () => {
    setLoading(true);
    try {
      const folderList = await listDriveFolders();
      setFolders(folderList);
    } catch (e: any) {
      toast.error('Error cargando carpetas: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error('El nombre de la carpeta no puede estar vacío');
      return;
    }
    setCreating(true);
    try {
      const parentId = newFolderParentId || undefined;
      const createdFolder = await createDriveFolder(newFolderName.trim(), parentId);
      toast.success(`Carpeta "${newFolderName}" creada con éxito!`);
      
      // Select the newly created folder right away
      onSelect(createdFolder.name);
      
      // Auto-refresh folders or close
      await fetchFolders();
      setShowCreateInput(false);
      setNewFolderName('');
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Error creando carpeta: ' + e.message);
    } finally {
      setCreating(false);
    }
  };

  const toggleExpand = (folderId: string) => {
    setExpandedFolderIds(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  // Build root nodes & subfolders tree
  const buildTree = (foldersList: any[]): FolderNode[] => {
    const nodesMap: { [id: string]: FolderNode } = {};
    
    // Create node objects
    foldersList.forEach(f => {
      nodesMap[f.id] = {
        id: f.id,
        name: f.name,
        parentId: f.parents && f.parents.length > 0 ? f.parents[0] : undefined,
        children: []
      };
    });

    const roots: FolderNode[] = [];
    
    // Link nodes to their parents
    Object.values(nodesMap).forEach(node => {
      if (node.parentId && nodesMap[node.parentId]) {
        nodesMap[node.parentId].children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const roots = buildTree(folders);

  // Recursively render nodes
  const renderNode = (node: FolderNode, depth: number = 0) => {
    const isExpanded = !!expandedFolderIds[node.id];
    const hasChildren = node.children.length > 0;
    const isSelected = selectedFolderId === node.id;

    return (
      <div key={node.id} className="space-y-1">
        <div 
          onClick={() => setSelectedFolderId(node.id)}
          className={cn(
            "flex items-center justify-between p-2.5 rounded-xl group transition cursor-pointer text-xs md:text-sm border border-transparent",
            isSelected 
              ? "bg-indigo-600/10 border-indigo-500/20 hover:bg-indigo-600/15" 
              : "hover:bg-zinc-800/50"
          )}
          style={{ paddingLeft: `${Math.max(8, depth * 16 + 8)}px` }}
        >
          <div className="flex items-center gap-2 overflow-hidden mr-2">
            {hasChildren ? (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(node.id);
                }}
                className="p-1 hover:bg-zinc-700/50 rounded-lg text-zinc-400 hover:text-zinc-200 transition"
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            ) : (
              <span className="w-5 shrink-0 flex justify-center text-zinc-600">•</span>
            )}
            
            {isExpanded ? (
              <FolderOpen size={16} className="text-amber-400 shrink-0" />
            ) : (
              <Folder size={16} className="text-indigo-400 shrink-0" />
            )}
            <span className={cn(
              "truncate font-medium transition-colors",
              isSelected ? "text-indigo-400" : "text-zinc-200"
            )}>
              {node.name}
            </span>
          </div>
          
          <div className="flex items-center gap-1.5 shrink-0">
            <Button 
              size="icon" 
              variant="ghost" 
              title="Crear subcarpeta"
              className="h-6 w-6 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition"
              onClick={(e) => {
                e.stopPropagation();
                setNewFolderParentId(node.id);
                setNewFolderName('');
                setShowCreateInput(true);
              }}
            >
              <FolderPlus size={13} />
            </Button>
            <Button 
              size="sm" 
              className="h-7 px-2.5 text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg tracking-wide uppercase transition shadow-lg shadow-indigo-600/10"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(node.name);
                onOpenChange(false);
              }}
            >
              Seleccionar
            </Button>
          </div>
        </div>
        
        {isExpanded && node.children.length > 0 && (
          <div className="space-y-1">
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-zinc-950 border-zinc-900 text-white p-6 rounded-3xl shadow-2xl relative overflow-hidden">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-lg font-black tracking-tight flex items-center gap-2 uppercase">
            <FolderDot size={20} className="text-indigo-400" />
            Estructura de Carpetas
          </DialogTitle>
        </DialogHeader>

        {showCreateInput ? (
          <div className="space-y-4 p-4 bg-zinc-900/40 rounded-2xl border border-zinc-900">
            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              {newFolderParentId ? 'Crear Subcarpeta' : 'Crear Nueva Carpeta en Raíz'}
            </h4>
            <div className="flex gap-2">
              <Input 
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Nombre de la carpeta..."
                className="bg-zinc-950 border-zinc-800 text-sm rounded-xl focus-visible:ring-indigo-500/20"
                disabled={creating}
              />
              <Button 
                onClick={handleCreateFolder}
                disabled={creating || !newFolderName.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl gap-2 text-xs font-bold shrink-0 h-10 px-4"
              >
                {creating ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
                Crear
              </Button>
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                className="text-xs text-zinc-400 hover:text-zinc-200"
                onClick={() => setShowCreateInput(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              Carpetas en Google Drive
            </span>
            <Button 
              size="sm" 
              variant="outline"
              className="h-7 text-[10px] font-bold uppercase rounded-lg border-zinc-800 bg-zinc-900/50 text-indigo-400 hover:bg-indigo-500/10 gap-1.5"
              onClick={() => {
                setNewFolderParentId(null);
                setNewFolderName('');
                setShowCreateInput(true);
              }}
            >
              <Plus size={12} /> Nueva Carpeta
            </Button>
          </div>
        )}

        <div className="max-h-[50vh] min-h-[160px] overflow-y-auto space-y-1 mb-2 pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-zinc-500">
              <Loader2 size={24} className="animate-spin text-zinc-600 mb-2" />
              <p className="text-xs">Cargando árbol de carpetas...</p>
            </div>
          ) : roots.length > 0 ? (
            <div className="space-y-1">
              {roots.map(root => renderNode(root, 0))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 p-4 bg-zinc-900/10 rounded-2xl border border-dashed border-zinc-900 text-center text-zinc-500">
              <Folder size={32} className="text-zinc-700 mb-2" />
              <p className="text-xs font-medium">No se encontraron carpetas.</p>
              <p className="text-[10px] text-zinc-600 mt-1 max-w-[200px]">Crea tu primera carpeta haciendo clic en "Nueva Carpeta" arriba.</p>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center mt-4 pt-4 border-t border-zinc-900">
          <p className="text-[10px] text-zinc-500 leading-normal max-w-[180px]">
            Haga clic en una carpeta para seleccionarla como la ruta de almacenamiento por defecto.
          </p>
          <Button 
            variant="ghost" 
            className="text-xs text-zinc-400 hover:text-zinc-200"
            onClick={() => onOpenChange(false)}
          >
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
