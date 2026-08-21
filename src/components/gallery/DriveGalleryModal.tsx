import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { listDriveFiles, getDriveQuota, downloadDriveFile, deleteDriveFile } from '@/services/drive';
import { googleSignIn, getAccessToken } from '@/services/auth';
import { toast } from 'sonner';
import { Trash2, ExternalLink, Import, RefreshCw, Loader2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DriveGalleryModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
    const [files, setFiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null); // tracks fileId currently being processed for import/delete
    const [needsLogin, setNeedsLogin] = useState(false);
    const [quota, setQuota] = useState<any>(null);

    useEffect(() => {
        if (open) {
            checkAndFetch();
        }
    }, [open]);

    const checkAndFetch = async () => {
        setLoading(true);
        setNeedsLogin(false);
        const token = await getAccessToken();
        if (token) {
            fetchFilesAndQuota();
        } else {
            setLoading(false);
            setNeedsLogin(true);
        }
    };

    const handleSignIn = async () => {
        setLoading(true);
        setNeedsLogin(false);
        try {
            const authResult = await googleSignIn();
            if (authResult) {
                fetchFilesAndQuota();
            } else {
                setLoading(false);
                setNeedsLogin(true);
            }
        } catch (e: any) {
            toast.error('Error al iniciar sesión: ' + e.message);
            setLoading(false);
            setNeedsLogin(true);
        }
    };

    const fetchFilesAndQuota = async () => {
        setLoading(true);
        try {
            const [fileList, quotaData] = await Promise.all([listDriveFiles(), getDriveQuota()]);
            setFiles(fileList);
            setQuota(quotaData.storageQuota);
        } catch (e: any) {
            toast.error('Error cargando archivos de Drive: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleImportImage = async (fileId: string, fileName: string) => {
        setActionLoading(fileId);
        try {
            const response = await downloadDriveFile(fileId);
            if (response && response.data) {
                // Dispatch event, which EditorContainer listens to
                window.dispatchEvent(new CustomEvent('loadDriveImage', { detail: { data: response.data } }));
                // Change view to editor ('generate')
                window.dispatchEvent(new CustomEvent('changeView', { detail: 'generate' }));
                onOpenChange(false);
            } else {
                toast.error('No se pudo descargar la imagen de Drive');
            }
        } catch (e: any) {
            toast.error('Error al importar de Drive: ' + e.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteImage = async (fileId: string, fileName: string) => {
        const confirmed = window.confirm(`¿Estás seguro/a de que quieres eliminar la imagen "${fileName}" de Google Drive? Esta acción no se puede deshacer.`);
        if (!confirmed) return;

        setActionLoading(fileId);
        try {
            await deleteDriveFile(fileId);
            toast.success(`Imagen "${fileName}" eliminada de Google Drive.`);
            // Refresh list
            fetchFilesAndQuota();
        } catch (e: any) {
            toast.error('Error al eliminar de Drive: ' + e.message);
        } finally {
            setActionLoading(null);
        }
    };

    const formatBytes = (bytes: string) => {
        const b = parseInt(bytes);
        if (isNaN(b)) return 'N/A';
        const gb = b / (1024 * 1024 * 1024);
        return gb.toFixed(2) + ' GB';
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl bg-slate-900 border-slate-800 text-slate-100 rounded-3xl shadow-2xl p-6">
                <DialogHeader className="border-b border-slate-800 pb-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <DialogTitle className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                                <ImageIcon className="text-indigo-400 w-6 h-6" />
                                ImaginArt Studio en Drive
                            </DialogTitle>
                            <p className="text-xs text-slate-400 mt-1">Explora, importa y administra tus imágenes creadas guardadas en Google Drive</p>
                        </div>
                        {quota && (
                            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-400 font-mono flex flex-col gap-1 shrink-0">
                                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Espacio en Drive</span>
                                <div>Usado: <span className="text-indigo-400 font-bold">{formatBytes(quota.usage)}</span> / <span className="text-slate-300 font-bold">{formatBytes(quota.limit)}</span></div>
                            </div>
                        )}
                    </div>
                </DialogHeader>

                <div className="py-4">
                    {needsLogin ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-950/50 rounded-2xl border border-dashed border-slate-800">
                            <ImageIcon className="text-slate-600 w-16 h-16 mb-4 animate-pulse" />
                            <h3 className="text-lg font-bold text-slate-200">Conéctate con Google Drive</h3>
                            <p className="text-xs text-slate-400 mt-1 max-w-sm mb-6">Inicia sesión con tu cuenta de Google para sincronizar directamente e importar tus creaciones artísticas.</p>
                            <Button 
                                className="px-6 h-11 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs tracking-wider uppercase transition-all shadow-lg shadow-indigo-500/25" 
                                onClick={handleSignIn}
                            >
                                Conectar Google Drive
                            </Button>
                        </div>
                    ) : loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
                            <p className="text-xs text-slate-400 tracking-wider font-bold uppercase">Sincronizando archivos...</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800/60">
                                    {files.length} {files.length === 1 ? 'Foto encontrada' : 'Fotos encontradas'}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={fetchFilesAndQuota}
                                    className="h-8 px-2.5 text-xs text-slate-400 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 font-semibold"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    Actualizar
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto max-h-[50vh] pr-1">
                                {files.length > 0 ? (
                                    files.map((file) => (
                                        <div 
                                            key={file.id} 
                                            className="group relative border border-slate-800 rounded-2xl p-3 bg-slate-950 hover:border-slate-700 transition-all flex flex-col justify-between"
                                        >
                                            <div className="aspect-video relative rounded-lg bg-slate-900 overflow-hidden mb-3 flex items-center justify-center">
                                                {file.thumbnailLink ? (
                                                    <img 
                                                        src={file.thumbnailLink} 
                                                        alt={file.name} 
                                                        className="object-cover w-full h-full transition-transform group-hover:scale-105 duration-300"
                                                        referrerPolicy="no-referrer"
                                                        onError={(e) => {
                                                            // Fallback in case of CORS or broken thumbnail
                                                            e.currentTarget.style.display = 'none';
                                                            const fallback = e.currentTarget.parentElement?.querySelector('.fallback-icon');
                                                            if (fallback) fallback.classList.remove('hidden');
                                                        }}
                                                    />
                                                ) : null}
                                                <div className={`fallback-icon flex flex-col items-center gap-2 text-slate-600 ${file.thumbnailLink ? 'hidden' : ''}`}>
                                                    <ImageIcon className="w-10 h-10" />
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <div>
                                                    <p className="text-xs font-bold text-slate-200 truncate" title={file.name}>
                                                        {file.name}
                                                    </p>
                                                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate">ID: {file.id}</p>
                                                </div>

                                                <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800/50">
                                                    <Button 
                                                        size="sm"
                                                        variant="ghost"
                                                        className="flex-1 h-8 px-2 bg-indigo-500/10 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-colors"
                                                        disabled={actionLoading !== null}
                                                        onClick={() => handleImportImage(file.id, file.name)}
                                                    >
                                                        {actionLoading === file.id ? (
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                        ) : (
                                                            <Import className="w-3.5 h-3.5" />
                                                        )}
                                                        Importar
                                                    </Button>

                                                    {file.webViewLink && (
                                                        <a 
                                                            href={file.webViewLink} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="h-8 w-8 inline-flex items-center justify-center bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors shrink-0"
                                                            title="Ver en Drive"
                                                        >
                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                        </a>
                                                    )}

                                                    <Button 
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 w-8 hover:bg-rose-500/15 text-slate-500 hover:text-rose-400 rounded-lg p-0 flex items-center justify-center transition-colors shrink-0"
                                                        disabled={actionLoading !== null}
                                                        onClick={() => handleDeleteImage(file.id, file.name)}
                                                        title="Eliminar de Drive"
                                                    >
                                                        {actionLoading === file.id ? (
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-full py-16 text-center bg-slate-950/30 rounded-2xl border border-dashed border-slate-800">
                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">No hay imágenes en Drive.</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
