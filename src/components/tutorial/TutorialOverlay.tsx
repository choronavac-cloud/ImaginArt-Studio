
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Sparkles, 
  Image as ImageIcon, 
  History, 
  Settings as SettingsIcon,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils';

interface Step {
  title: string;
  description: string;
  icon: any;
  color: string;
}

export default function TutorialOverlay({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);

  const steps: Step[] = [
    {
      title: "Bienvenido a ImagiGen AI",
      description: "Tu estudio creativo impulsado por inteligencia artificial. Aquí puedes generar imágenes desde cero o editar tus fotos existentes.",
      icon: Sparkles,
      color: "from-indigo-500 to-purple-600"
    },
    {
      title: "Generación y Edición",
      description: "Usa el panel de la izquierda para describir tu visión. Puedes elegir estilos como Pixar, Anime o Realista, y definir la posición de la cámara.",
      icon: ImageIcon,
      color: "from-blue-500 to-cyan-600"
    },
    {
      title: "Análisis y Narrativa",
      description: "Analiza imágenes para obtener prompts descriptivos o crea Historias secuenciales con participantes personalizados.",
      icon: History,
      color: "from-pink-500 to-rose-600"
    },
    {
      title: "Galería y Exportación",
      description: "Administra tus creaciones en la Galería. Puedes exportar todo tu contenido en un solo archivo para llevarlo donde quieras.",
      icon: SettingsIcon,
      color: "from-amber-500 to-orange-600"
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl relative"
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-zinc-800 transition-colors text-zinc-500"
        >
          <X size={24} />
        </button>

        <div className="flex flex-col md:flex-row h-full">
           {/* Visual Part */}
           <div className={cn("w-full md:w-56 bg-gradient-to-br flex items-center justify-center p-8", step.color)}>
              <motion.div
                key={currentStep}
                initial={{ rotate: -10, scale: 0.8 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring" }}
              >
                <step.icon size={80} className="text-white drop-shadow-xl" />
              </motion.div>
           </div>

           {/* Content Part */}
           <div className="flex-1 p-10 flex flex-col justify-between">
              <div className="space-y-6">
                <div className="flex gap-2">
                   {steps.map((_, i) => (
                     <div 
                       key={i} 
                       className={cn("h-1.5 rounded-full transition-all duration-300", 
                         i === currentStep ? "w-8 bg-white" : "w-2 bg-zinc-800"
                       )} 
                     />
                   ))}
                </div>

                <div className="space-y-3">
                   <h2 className="text-3xl font-bold text-white leading-tight">{step.title}</h2>
                   <p className="text-zinc-400 text-lg leading-relaxed">
                     {step.description}
                   </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-10">
                <Button 
                  variant="ghost" 
                  disabled={currentStep === 0}
                  onClick={handleBack}
                  className="text-zinc-500 hover:text-white"
                >
                  <ChevronLeft size={20} className="mr-2" /> Atrás
                </Button>
                
                <Button 
                  className={cn("h-12 px-8 rounded-2xl font-bold transition-all", 
                    currentStep === steps.length - 1 ? "bg-green-600 hover:bg-green-700" : "bg-white text-black hover:bg-zinc-200"
                  )}
                  onClick={handleNext}
                >
                  {currentStep === steps.length - 1 ? (
                    <span className="flex items-center gap-2">Empezar ahora <CheckCircle2 size={18} /></span>
                  ) : (
                    <span className="flex items-center gap-2">Siguiente <ChevronRight size={18} /></span>
                  )}
                </Button>
              </div>
           </div>
        </div>
      </motion.div>
    </div>
  );
}


