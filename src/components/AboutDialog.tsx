import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Acerca de ImaginArt Studio</DialogTitle>
          <DialogDescription>
            Plataforma avanzada de generación y edición de imágenes con IA.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <span className="font-semibold text-muted-foreground">Versión:</span>
            <span>1.0.0</span>
            <span className="font-semibold text-muted-foreground">Creador:</span>
            <span>Juan Nava</span>
            <span className="font-semibold text-muted-foreground">Contacto:</span>
            <a href="mailto:t6623704716@gmail.com" className="text-indigo-400 hover:text-indigo-300 underline">
              t6623704716@gmail.com
            </a>
          </div>
          <div className="border-t pt-4">
             <h4 className="font-semibold text-foreground mb-2">Herramientas utilizadas:</h4>
             <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>React, TypeScript</li>
                <li>Vite</li>
                <li>Tailwind CSS</li>
                <li>@google/genai</li>
                <li>shadcn/ui</li>
             </ul>
          </div>
          <div className="text-xs text-muted-foreground border-t pt-4">
            © 2026. Todos los derechos reservados.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
