import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Trash2,
  Users,
  Images,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  UserPlus,
  Save,
  Sparkles,
  RefreshCw,
  MessageSquareQuote,
  Download,
  Printer,
  Play,
  Pause,
  Volume2,
  VolumeX,
  FileText,
  Eye,
} from "lucide-react";
import {
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";

import { motion, AnimatePresence } from "motion/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  getStories,
  saveStory,
  deleteStory,
  getGalleryItems,
  StoryItem,
  StoryParticipant,
  GalleryItem,
  StoryStep,
} from "@/services/storage";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { cn, sanitizeHtml2CanvasDoc, sanitizedHtml2Canvas } from "@/lib/utils";

// Identifica el idioma preponderante en el texto para adaptar la voz del narrador
function detectLanguage(text: string): string {
  if (!text) return "es-ES";
  const normalized = text.toLowerCase();
  
  // Español (stop words comunes y caracteres especiales)
  const spanishWords = /\b(el|la|los|las|un|una|unos|unas|y|o|pero|que|en|del|al|con|por|para|se|lo|como|este|esta|todo|muy|más|está|están|es|son|fue|ser|tiene|tienen|hacer|hecho)\b/g;
  // Inglés (stop words comunes)
  const englishWords = /\b(the|and|of|to|a|in|is|that|it|he|was|for|on|are|as|with|his|they|i|at|be|this|have|from|or|one|had|by|word|but|not|what|all|were|we|when|your|can|said)\b/g;
  // Francés (stop words comunes y caracteres)
  const frenchWords = /\b(le|la|les|un|une|des|et|ou|mais|que|qui|dans|du|au|avec|par|pour|se|en|ce|cette|tout|très|plus|est|sont|a|ont|faire|fait)\b/g;
  // Portugués (stop words comunes)
  const portugueseWords = /\b(o|a|os|as|um|uma|uns|umas|e|ou|mas|que|em|do|da|no|na|com|por|para|se|como|este|esta|tudo|muito|mais|está|estão|é|são|foi|ser|tem|têm|fazer|feito)\b/g;
  // Alemán (stop words comunes)
  const germanWords = /\b(der|die|das|und|ist|in|zu|den|von|mit|dem|des|ein|eine|einen|einer|einem|alles|sehr|mehr|nicht|wir|sie|ich|du|es|sind|war|haben|machen|getan)\b/g;
  // Italiano (stop words comunes)
  const italianWords = /\b(il|la|i|gli|le|un|una|e|o|ma|che|in|del|al|con|per|da|si|lo|come|questo|questa|tuto|molto|più|è|sono|stato|ha|hanno|fare|fatto)\b/g;

  const countSpanish = (normalized.match(spanishWords) || []).length;
  const countEnglish = (normalized.match(englishWords) || []).length;
  const countFrench = (normalized.match(frenchWords) || []).length;
  const countPortuguese = (normalized.match(portugueseWords) || []).length;
  const countGerman = (normalized.match(germanWords) || []).length;
  const countItalian = (normalized.match(italianWords) || []).length;

  const counts = [
    { lang: "es-ES", score: countSpanish },
    { lang: "en-US", score: countEnglish },
    { lang: "fr-FR", score: countFrench },
    { lang: "pt-BR", score: countPortuguese },
    { lang: "de-DE", score: countGerman },
    { lang: "it-IT", score: countItalian }
  ];

  counts.sort((a, b) => b.score - a.score);

  if (counts[0].score === 0) {
    if (/[áéíóúüñ¿¡]/i.test(normalized)) return "es-ES";
    if (/[âêîôûçàèù]/i.test(normalized)) return "fr-FR";
    if (/[ãõáéíóúçêô]/i.test(normalized)) return "pt-BR";
    if (/[äöüß]/i.test(normalized)) return "de-DE";
    return "es-ES";
  }

  return counts[0].lang;
}

export default function StoryBoard({
  initialImageId,
  onStoryCreated,
}: {
  initialImageId?: string | null;
  onStoryCreated?: () => void;
}) {
  const { t } = useTranslation();
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [activeStory, setActiveStory] = useState<StoryItem | null>(null);
  const [availableImages, setAvailableImages] = useState<GalleryItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [autoStoryPrompt, setAutoStoryPrompt] = useState("");
  const [isAutoCreating, setIsAutoCreating] = useState(false);
  const storyRef = useRef<HTMLDivElement>(null);
  const [isExportingPNG, setIsExportingPNG] = useState(false);

  // States for format presentations and playbacks
  const [currentSlide, setCurrentSlide] = useState(0);
  const [videoIdx, setVideoIdx] = useState(0);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [narratorMuted, setNarratorMuted] = useState(false);
  const [storyToDelete, setStoryToDelete] = useState<string | null>(null);

  // Reset indices and players on active story changes
  useEffect(() => {
    setCurrentSlide(0);
    setVideoIdx(0);
    setVideoPlaying(false);
    // Cancel any active SpeechSynthesis speaking to avoid state leakage
    window.speechSynthesis.cancel();
  }, [activeStory?.id]);

  // Clean speech synthesis on component unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  // Speech Narration side-effect for Video Narrado format
  useEffect(() => {
    if (!activeStory || activeStory.format !== "video" || !videoPlaying) {
      window.speechSynthesis.cancel();
      return;
    }

    const steps = activeStory.steps;
    if (steps.length === 0) return;

    const currentStep = steps[videoIdx];
    if (!currentStep) return;

    const speechText = currentStep.narrative || "Escena sin narración.";

    if (!narratorMuted) {
      // Speak!
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(speechText);
      const detectedLang = detectLanguage(speechText);
      utterance.lang = detectedLang;

      if (typeof window !== "undefined" && window.speechSynthesis) {
        const voices = window.speechSynthesis.getVoices();
        const mainLangPrefix = detectedLang.split("-")[0];
        const matchingVoice = voices.find((v) => v.lang.toLowerCase().startsWith(mainLangPrefix));
        if (matchingVoice) {
          utterance.voice = matchingVoice;
        }
      }
      
      utterance.onend = () => {
        // Wait 1.5 seconds after speaking, then click next!
        const timer = setTimeout(() => {
          if (videoIdx < steps.length - 1) {
            setVideoIdx(prev => prev + 1);
          } else {
            // Loop back to start or pause
            setVideoPlaying(false);
            setVideoIdx(0);
            toast.success("¡Historia finalizada!");
          }
        }, 1500);
        return () => clearTimeout(timer);
      };

      utterance.onerror = () => {
        // Fallback on speech synthesis error: advance after 5 seconds
        const timer = setTimeout(() => {
          if (videoIdx < steps.length - 1) {
            setVideoIdx(prev => prev + 1);
          } else {
            setVideoPlaying(false);
            setVideoIdx(0);
          }
        }, 5000);
        return () => clearTimeout(timer);
      };

      window.speechSynthesis.speak(utterance);
    } else {
      // If narrator is muted, just auto-advance after 5 seconds
      const timer = setTimeout(() => {
        if (videoIdx < steps.length - 1) {
          setVideoIdx(prev => prev + 1);
        } else {
          setVideoPlaying(false);
          setVideoIdx(0);
          toast.success("¡Historia finalizada!");
        }
      }, 5000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.speechSynthesis.cancel();
    };
  }, [videoPlaying, videoIdx, activeStory?.id, narratorMuted, activeStory?.format]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (initialImageId && availableImages.length > 0) {
      const img = availableImages.find((i) => i.id === initialImageId);
      if (img) {
        handleCreateNew(initialImageId);
        onStoryCreated?.();
      }
    }
  }, [initialImageId, availableImages]);

  const loadData = async () => {
    const [sData, genItems, histItems, swapItems, collItems, analItems] = await Promise.all([
      getStories(),
      getGalleryItems("generation"),
      getGalleryItems("history"),
      getGalleryItems("swap"),
      getGalleryItems("collage"),
      getGalleryItems("analysis"),
    ]);
    setStories(sData);
    setAvailableImages([
      ...genItems,
      ...histItems,
      ...swapItems,
      ...collItems,
      ...analItems,
    ]);
  };

  const handleCreateNew = (withImageId?: string) => {
    const newSteps: StoryStep[] = [];
    if (withImageId) {
      newSteps.push({
        id: crypto.randomUUID(),
        imageId: withImageId,
        participantIds: [],
        narrative: "",
      });
    }

    const newStory: StoryItem = {
      id: crypto.randomUUID(),
      title: "Nueva Historia",
      description: "",
      steps: newSteps,
      participants: [],
      timestamp: new Date().toISOString(),
      style: "pixar",
      format: "historieta",
    };
    setActiveStory(newStory);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!activeStory) return;
    try {
      await saveStory(activeStory);
      toast.success(t("common.success"));
      setIsEditing(false);
      loadData();
    } catch (e) {
      toast.error(t("common.error"));
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    try {
      await deleteStory(storyId);
      toast.success("Historia eliminada correctamente");
      if (activeStory?.id === storyId) {
        setActiveStory(null);
      }
      loadData();
    } catch (e) {
      toast.error("Error al eliminar la historia");
    } finally {
      setStoryToDelete(null);
    }
  };

  const handleFormatChange = async (format: 'historieta' | 'editorial' | 'presentacion' | 'video') => {
    if (!activeStory) return;
    const updatedStory = { ...activeStory, format };
    setActiveStory(updatedStory);
    await saveStory(updatedStory);
    await loadData();
    setVideoPlaying(false);
    toast.success(`Formato de presentación cambiado a: ${format.toUpperCase()}`);
  };

  const handlePrintOrPDF = () => {
    if (!activeStory) return;
    const format = activeStory.format || "historieta";
    const title = activeStory.title || "Crónica Visual";
    const description = activeStory.description || "";

    const stepsHtml = activeStory.steps.map((step, idx) => {
      const img = availableImages.find((i) => i.id === step.imageId);
      const imgUrl = img ? img.url : "";
      const narrative = step.narrative || "Sin descripción";
      const stepParts = activeStory.participants
        .filter((p) => step.participantIds.includes(p.id))
        .map((p) => p.name)
        .join(", ");

      return { idx: idx + 1, imgUrl, narrative, stepParts };
    });

    let formatHtml = "";

    if (format === "historieta") {
      formatHtml = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 print:grid-cols-2">
          ${stepsHtml.map((s) => `
            <div class="border-2 border-slate-900 bg-white p-5 rounded-2xl flex flex-col space-y-4 shadow-sm" style="page-break-inside: avoid; break-inside: avoid;">
              <div class="aspect-video w-full rounded-xl overflow-hidden border border-slate-300 relative bg-slate-50 flex items-center justify-center">
                <img src="${s.imgUrl}" class="max-w-full max-h-full object-contain" />
                <div class="absolute top-3 left-3 bg-indigo-600 text-white font-extrabold w-7 h-7 rounded-full flex items-center justify-center border border-white shadow-sm text-xs">
                  ${s.idx}
                </div>
              </div>
              <div class="p-3 bg-amber-50 text-slate-900 rounded-xl border border-slate-200 text-xs font-semibold leading-relaxed relative">
                <p class="italic">"${s.narrative}"</p>
                ${s.stepParts ? `<div class="mt-2 text-[9px] text-slate-500 uppercase tracking-widest font-mono">Actores: ${s.stepParts}</div>` : ""}
              </div>
            </div>
          `).join("")}
        </div>
      `;
    } else if (format === "editorial") {
      formatHtml = `
        <div class="space-y-12 max-w-3xl mx-auto">
          ${stepsHtml.map((s, idx) => `
            <div class="flex flex-col md:flex-row gap-8 items-center bg-stone-50/50 p-6 rounded-3xl border border-stone-200" style="page-break-inside: avoid; break-inside: avoid; flex-direction: ${idx % 2 === 0 ? 'row' : 'row-reverse'}">
              <div class="w-full md:w-1/2 aspect-video rounded-2xl overflow-hidden border border-stone-200">
                <img src="${s.imgUrl}" class="w-full h-full object-cover" />
              </div>
              <div class="w-full md:w-1/2 flex flex-col justify-center space-y-2">
                <div class="text-[9px] tracking-widest text-slate-500 font-bold uppercase">Escena 0${s.idx}</div>
                <p class="leading-relaxed text-sm italic text-stone-800 serif-font">
                  <span class="text-3xl font-sans font-black float-left mr-1.5 align-middle leading-[0.8]">${s.narrative.charAt(0)}</span>${s.narrative.slice(1)}
                </p>
                ${s.stepParts ? `<p class="text-[10px] font-sans text-slate-500">En escena: <strong class="text-slate-700">${s.stepParts}</strong></p>` : ""}
              </div>
            </div>
          `).join("")}
        </div>
      `;
    } else if (format === "presentacion") {
      formatHtml = `
        <div class="space-y-12 max-w-4xl mx-auto">
          ${stepsHtml.map((s) => `
            <div class="flex flex-col items-center justify-center bg-zinc-50 border border-zinc-200 rounded-3xl p-8 min-h-[440px]" style="page-break-after: always; break-after: page; page-break-inside: avoid; break-inside: avoid;">
              <div class="w-full aspect-video rounded-2xl overflow-hidden bg-black border border-zinc-300 mb-6 flex items-center justify-center">
                <img src="${s.imgUrl}" class="max-w-full max-h-full object-contain" />
              </div>
              <div class="text-center space-y-3 max-w-2xl">
                <div class="text-4xl font-extrabold text-indigo-600/20 font-mono">0${s.idx}</div>
                <p class="text-zinc-800 text-base leading-relaxed italic">"${s.narrative}"</p>
                ${s.stepParts ? `<div class="inline-block px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full text-xs font-bold uppercase">Con: ${s.stepParts}</div>` : ""}
              </div>
            </div>
          `).join("")}
        </div>
      `;
    } else if (format === "video") {
      formatHtml = `
        <div class="space-y-8 max-w-3xl mx-auto">
          ${stepsHtml.map((s) => `
            <div class="flex flex-col md:flex-row gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-200" style="page-break-inside: avoid; break-inside: avoid;">
              <div class="w-full md:w-2/5 aspect-video rounded-xl overflow-hidden border border-slate-300 relative bg-black flex items-center justify-center">
                <img src="${s.imgUrl}" class="max-w-full max-h-full object-contain" />
                <div class="absolute top-2 left-2 bg-red-600 text-white font-extrabold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Escena 0${s.idx}
                </div>
              </div>
              <div class="w-full md:w-3/5 flex flex-col justify-between py-1">
                <div class="space-y-2">
                  <div class="text-[9px] font-semibold text-slate-400 font-mono uppercase tracking-widest">Guion Técnico y Diálogo</div>
                  <p class="text-slate-700 text-xs md:text-sm leading-relaxed italic border-l-4 border-indigo-500 pl-3">
                    "${s.narrative}"
                  </p>
                </div>
                ${s.stepParts ? `<div class="mt-4 text-[10px] text-slate-500 font-medium">Personajes: <strong class="text-slate-700">${s.stepParts}</strong></div>` : ""}
              </div>
            </div>
          `).join("")}
        </div>
      `;
    }

    const printTemplate = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700;800&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;500;700;900&display=swap" rel="stylesheet">
        <style>
          @media print {
            body {
              background: white !important;
              color: black !important;
            }
            .no-print {
              display: none !important;
            }
          }
          body {
            font-family: 'Inter', sans-serif;
            background: white;
            color: #1e293b;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .serif-font {
            font-family: 'Playfair Display', serif;
          }
          .display-font {
            font-family: 'Space Grotesk', sans-serif;
          }
        </style>
      </head>
      <body class="p-8">
        <div class="max-w-5xl mx-auto space-y-10">
          <header class="border-b-2 border-stone-200 pb-6 flex flex-col gap-2">
            <div class="inline-block self-start px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-bold uppercase tracking-wider border border-slate-200">
              Formato: ${format.toUpperCase()}
            </div>
            <h1 class="text-3xl font-black uppercase tracking-tight display-font text-slate-900">${title}</h1>
            <p class="text-slate-600 max-w-2xl leading-relaxed italic text-sm">"${description || 'Sin descripción'}"</p>
            <div class="text-[9px] text-slate-400 font-mono uppercase">Fecha: ${new Date(activeStory.timestamp).toLocaleDateString()}</div>
          </header>

          <main class="py-4">
            ${formatHtml}
          </main>

          <footer class="border-t border-stone-200 pt-6 text-center text-[10px] font-mono text-zinc-400">
            Generado por ImaginArt Studio &bull; &copy; 2026 Todos los derechos reservados
          </footer>
        </div>

        <script>
          window.onload = function() {
            // Give brief timeout for images and styles to parse correctly
            setTimeout(function() {
              window.print();
            }, 500);
          };
        </script>
      </body>
      </html>
    `;

    // Create a temporary hidden iframe to output and print
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    
    // Append to body
    document.body.appendChild(iframe);

    // Write content to iframe document
    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(printTemplate);
      iframeDoc.close();

      // Clean up after standard delay (giving user time to use print dialog)
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 5000);
      toast.success("Preparando ventana de impresión o PDF...");
    } else {
      toast.error("No se pudo iniciar el servicio de impresión.");
    }
  };

  const handleExportHTML = () => {
    if (!activeStory) return;
    const format = activeStory.format || "historieta";
    const title = activeStory.title || "Crónica Visual";
    const description = activeStory.description || "";

    const stepsHtml = activeStory.steps.map((step, idx) => {
      const img = availableImages.find((i) => i.id === step.imageId);
      const imgUrl = img ? img.url : "";
      const narrative = step.narrative || "Sin descripción";
      const stepParts = activeStory.participants
        .filter((p) => step.participantIds.includes(p.id))
        .map((p) => p.name)
        .join(", ");

      return { idx: idx + 1, imgUrl, narrative, stepParts };
    });

    let formatSpecificScript = "";
    let formatSpecificHtml = "";

    if (format === "historieta") {
      formatSpecificHtml = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          ${stepsHtml.map((s) => `
            <div class="border-4 border-slate-900 bg-slate-900 p-4 rounded-3xl shadow-[8px_8px_0px_0px_rgba(30,27,75,1)] flex flex-col space-y-4">
              <div class="aspect-video w-full rounded-2xl overflow-hidden border-2 border-slate-800 relative bg-black">
                <img src="${s.imgUrl}" class="w-full h-full object-contain" />
                <div class="absolute top-3 left-3 bg-indigo-600 text-white font-extrabold w-8 h-8 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-md">
                  ${s.idx}
                </div>
              </div>
              <div class="p-4 bg-yellow-50 text-slate-950 rounded-2xl border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-sm font-bold leading-relaxed relative min-h-[60px]">
                <p class="italic">"${s.narrative}"</p>
                ${s.stepParts ? `<div class="mt-2 text-[10px] text-slate-500 uppercase tracking-wider">Actores: ${s.stepParts}</div>` : ""}
              </div>
            </div>
          `).join("")}
        </div>
      `;
    } else if (format === "editorial") {
      formatSpecificHtml = `
        <div class="space-y-16 max-w-3xl mx-auto p-8 bg-[#faf6ee] text-[#1b1c1e] rounded-[2.5rem] border border-[#e8dfd3] shadow-md serif-font">
          <div class="border-b border-dashed border-[#e1d3c0] pb-6 mb-8 text-center">
            <span class="text-[10px] uppercase font-sans tracking-widest text-[#9c8443] font-bold">Resumen de Crónica</span>
            <p class="text-sm italic text-slate-600 max-w-xl mx-auto mt-2 leading-relaxed">
              "${description}"
            </p>
          </div>
          ${stepsHtml.map((s) => `
            <div class="flex flex-col md:flex-row gap-8 items-center bg-[#fdfaf2] p-8 rounded-3xl border border-[#eadaa6]/30 shadow-md ${s.idx % 2 === 0 ? "md:flex-row-reverse" : ""}">
              <div class="w-full md:w-1/2 aspect-video rounded-2xl overflow-hidden shadow-lg border border-[#eadaa6]">
                <img src="${s.imgUrl}" class="w-full h-full object-cover" />
              </div>
              <div class="w-full md:w-1/2 flex flex-col justify-center space-y-4">
                <div class="text-[10px] tracking-widest text-[#a88d44] font-bold uppercase font-sans">Escena 0${s.idx}</div>
                <p class="leading-relaxed text-base italic text-[#2c2c2a]">
                  <span class="text-4xl font-sans font-black float-left mr-1.5 align-middle leading-[0.8]">${s.narrative.charAt(0)}</span>${s.narrative.slice(1)}
                </p>
                ${s.stepParts ? `<p class="text-[11px] font-sans text-slate-500 italic">En escena: ${s.stepParts}</p>` : ""}
              </div>
            </div>
          `).join("")}
        </div>
      `;
    } else if (format === "presentacion") {
      formatSpecificHtml = `
        <div class="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative">
          <div id="slides-container" class="relative min-h-[400px]">
            ${stepsHtml.map((s, i) => `
              <div class="slide flex flex-col md:flex-row gap-8 items-center justify-center transform transition-all duration-500 ${i === 0 ? 'opacity-100' : 'opacity-0 hidden'}" data-slide="${i}">
                <div class="w-full md:w-3/5 aspect-video rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-2xl">
                  <img src="${s.imgUrl}" class="w-full h-full object-contain" />
                </div>
                <div class="w-full md:w-2/5 space-y-4">
                  <div class="text-6xl font-extrabold text-indigo-500/20 font-mono">0${s.idx}</div>
                  <p class="text-slate-200 text-base leading-relaxed font-sans italic">"${s.narrative}"</p>
                  ${s.stepParts ? `<div class="inline-block px-3 py-1 bg-slate-800 text-slate-400 rounded-full text-xs font-bold uppercase">Con: ${s.stepParts}</div>` : ""}
                </div>
              </div>
            `).join("")}
          </div>
          
          <!-- Navigation controls -->
          <div class="flex justify-between items-center mt-8 border-t border-slate-800 pt-6">
            <button onclick="prevSlide()" class="px-5 py-2.5 bg-slate-950 border border-slate-800 text-slate-300 rounded-xl hover:bg-slate-800 text-xs font-bold uppercase tracking-wider transition">Anterior</button>
            <div id="dots-container" class="flex gap-2">
              ${stepsHtml.map((_, i) => `
                <button onclick="gotoSlide(${i})" class="w-2.5 h-2.5 rounded-full transition-all duration-300 ${i === 0 ? 'bg-indigo-500 w-6' : 'bg-slate-700'}" data-dot="${i}"></button>
              `).join("")}
            </div>
            <button onclick="nextSlide()" class="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 text-xs font-bold uppercase tracking-wider transition">Siguiente</button>
          </div>
        </div>
      `;

      formatSpecificScript = `
        let currentSlide = 0;
        const totalSlides = ${stepsHtml.length};
        
        function showSlide(index) {
          document.querySelectorAll('.slide').forEach(s => {
            s.classList.add('opacity-0', 'hidden');
            s.classList.remove('opacity-100');
          });
          document.querySelectorAll('[data-dot]').forEach(d => {
            d.classList.remove('bg-indigo-500', 'w-6');
            d.classList.add('bg-slate-700');
          });
          
          const activeSlide = document.querySelector(\`[data-slide="\${index}"]\`);
          if (activeSlide) {
            activeSlide.classList.remove('hidden');
            setTimeout(() => activeSlide.classList.add('opacity-100'), 20);
          }
          
          const activeDot = document.querySelector(\`[data-dot="\${index}"]\`);
          if (activeDot) {
            activeDot.classList.add('bg-indigo-500', 'w-6');
            activeDot.classList.remove('bg-slate-700');
          }
          currentSlide = index;
        }

        function nextSlide() {
          let next = (currentSlide + 1) % totalSlides;
          showSlide(next);
        }

        function prevSlide() {
          let prev = (currentSlide - 1 + totalSlides) % totalSlides;
          showSlide(prev);
        }

        function gotoSlide(idx) {
          showSlide(idx);
        }
      `;
    } else if (format === "video") {
      formatSpecificHtml = `
        <div class="max-w-4xl mx-auto bg-slate-950 rounded-3xl overflow-hidden border border-slate-900 shadow-2xl">
          <!-- Video Screen -->
          <div class="aspect-video bg-black relative group flex items-center justify-center overflow-hidden">
            ${stepsHtml.map((s, i) => `
              <div class="video-slide absolute inset-0 flex items-center justify-center transition-opacity duration-700 ${i === 0 ? 'opacity-100' : 'opacity-0'}" data-vslide="${i}">
                <img src="${s.imgUrl}" class="w-full h-full object-contain" />
                <div class="absolute bottom-16 left-8 right-8 bg-black/75 px-6 py-3 rounded-2xl border border-slate-800 text-center text-white font-extrabold text-sm md:text-base selection:bg-indigo-500 shadow-xl backdrop-blur-md italic">
                  "${s.narrative}"
                </div>
              </div>
            `).join("")}
            
            <!-- Rec button overlay -->
            <div class="absolute top-4 left-4 flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-full text-[10px] font-bold text-red-500 border border-slate-800 tracking-widest uppercase">
              <span class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span> SYSTEM OK: PLAYBACK
            </div>
          </div>

          <!-- Video Controls Row -->
          <div class="bg-slate-900 p-6 border-t border-slate-800 space-y-4">
            <!-- Timeline -->
            <div class="relative h-1.5 bg-slate-800 rounded-full overflow-hidden cursor-pointer" onclick="seekVideo(event)">
              <div id="video-progress" class="absolute left-0 top-0 bottom-0 bg-indigo-500 transition-all duration-300 w-0"></div>
            </div>

            <!-- Buttons -->
            <div class="flex justify-between items-center">
              <div class="flex items-center gap-3">
                <button id="play-btn" onclick="togglePlay()" class="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition shadow-lg shadow-indigo-500/20">REPRODUCIR</button>
                <div class="text-xs text-slate-400 font-mono">
                  Escena <span id="current-vidx" class="text-white font-bold">1</span> de <span class="text-white">${stepsHtml.length}</span>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <button onclick="toggleAudio()" id="audio-btn" class="px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-xl transition text-xs font-bold uppercase tracking-wider">Narración Voice: ON</button>
                <button onclick="prevVideoSlide()" class="p-2.5 bg-slate-950 text-slate-400 hover:text-white rounded-xl transition">&larr;</button>
                <button onclick="nextVideoSlide()" class="p-2.5 bg-slate-950 text-slate-400 hover:text-white rounded-xl transition">&rarr;</button>
              </div>
            </div>
          </div>
        </div>
      `;

      formatSpecificScript = `
        let activeIdx = 0;
        const totalIdx = ${stepsHtml.length};
        let isPlaying = false;
        let isAudioOn = true;
        let playInterval = null;
        const narratives = [${stepsHtml.map((s) => `"${s.narrative.replace(/"/g, '\\"')}"`).join(", ")}];

        function showVideoSlide(index) {
          document.querySelectorAll('.video-slide').forEach((s, idx) => {
            if (idx === index) {
              s.classList.remove('opacity-0');
              s.classList.add('opacity-100');
            } else {
              s.classList.remove('opacity-100');
              s.classList.add('opacity-0');
            }
          });
          activeIdx = index;
          document.getElementById('current-vidx').innerText = index + 1;
          
          // update progress
          const percentage = ((index + 1) / totalIdx) * 100;
          document.getElementById('video-progress').style.width = \`\${percentage}%\`;

          if (isPlaying && isAudioOn) {
            speakText(narratives[index], () => {
              if (isPlaying) {
                setTimeout(() => {
                  if (isPlaying) {
                    nextVideoSlide();
                  }
                }, 1500);
              }
            });
          }
        }

        function speakText(text, callback) {
          window.speechSynthesis.cancel();
          if (!text) {
            callback();
            return;
          }
          const u = new SpeechSynthesisUtterance(text);
          u.lang = 'es-ES';
          u.onend = callback;
          u.onerror = callback;
          window.speechSynthesis.speak(u);
        }

        function togglePlay() {
          isPlaying = !isPlaying;
          const btn = document.getElementById('play-btn');
          if (isPlaying) {
            btn.innerText = "DETENER";
            btn.classList.replace('bg-indigo-600', 'bg-red-600');
            btn.classList.replace('hover:bg-indigo-500', 'hover:bg-red-500');
            showVideoSlide(activeIdx);
          } else {
            btn.innerText = "REPRODUCIR";
            btn.classList.replace('bg-red-600', 'bg-indigo-600');
            btn.classList.replace('hover:bg-red-500', 'hover:bg-indigo-500');
            window.speechSynthesis.cancel();
          }
        }

        function nextVideoSlide() {
          let next = (activeIdx + 1) % totalIdx;
          showVideoSlide(next);
        }

        function prevVideoSlide() {
          let prev = (activeIdx - 1 + totalIdx) % totalIdx;
          showVideoSlide(prev);
        }

        function toggleAudio() {
          isAudioOn = !isAudioOn;
          const abtn = document.getElementById('audio-btn');
          if (isAudioOn) {
            abtn.innerText = "Narración Voice: ON";
            abtn.classList.replace('text-slate-500', 'text-slate-300');
          } else {
            abtn.innerText = "Narración Voice: OFF";
            abtn.classList.replace('text-slate-300', 'text-slate-500');
            window.speechSynthesis.cancel();
          }
        }
      `;
    }

    const fullHtmlTemplate = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700;800&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;500;700;900&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background-color: #0b0f19;
            color: #f1f5f9;
        }
        .serif-font {
            font-family: 'Playfair Display', serif;
        }
        .display-font {
            font-family: 'Space Grotesk', sans-serif;
        }
    </style>
</head>
<body class="min-h-screen p-6 md:p-12 selection:bg-indigo-500 selection:text-white">

    <div class="max-w-5xl mx-auto space-y-12">
        
        <!-- Header -->
        <header class="border-b border-zinc-800 pb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div class="space-y-2">
                <div class="inline-block px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-xs font-bold uppercase tracking-widest border border-indigo-500/20">
                    Formato: ${format.toUpperCase()}
                </div>
                <h1 class="text-4xl md:text-5xl font-black uppercase tracking-tight display-font">${title}</h1>
                <p class="text-zinc-400 max-w-2xl leading-relaxed italic">"${description || 'Sin descripción'}"</p>
                <div class="text-[10px] text-zinc-600 font-mono uppercase mt-2">Creada originalmente el ${new Date(activeStory.timestamp).toLocaleDateString()}</div>
            </div>
        </header>

        <!-- Main Format Specific Container -->
        <main class="py-4">
            ${formatSpecificHtml}
        </main>

        <!-- Footer -->
        <footer class="border-t border-zinc-900 pt-8 mt-12 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-mono text-zinc-600">
            <div>Generado por ImaginArt Studio</div>
            <div>&copy; 2026 Todos los derechos reservados</div>
        </footer>

    </div>

    <script>
        ${formatSpecificScript}
    </script>
</body>
</html>
    `;

    const blob = new Blob([fullHtmlTemplate], { type: "text/html" });
    const fileUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${format}_render.html`;
    link.click();
    URL.revokeObjectURL(fileUrl);
    toast.success("¡Historia exportada como archivo web interactivo!");
  };

  const handleExportPNG = async () => {
    if (!activeStory || !storyRef.current) return;
    setIsExportingPNG(true);
    const toastId = toast.loading("Generando imagen PNG de la historia...");
    try {
      // Breve delay para asegurar transiciones y renderizado
      await new Promise((resolve) => setTimeout(resolve, 800));

      const canvas = await sanitizedHtml2Canvas(storyRef.current, {
        useCORS: true,
        backgroundColor: activeStory.format === "editorial" ? "#faf6ee" : "#020617",
        scale: 2, // 2x para mayor calidad de resolución
        logging: false,
        onclone: (clonedDoc) => {
          sanitizeHtml2CanvasDoc(clonedDoc);
        },
      });

      const dataUrl = canvas.toDataURL("image/png");
      const blob = await (await fetch(dataUrl)).blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${activeStory.title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${activeStory.format || "historieta"}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      toast.dismiss(toastId);
      toast.success("¡Historia exportada como imagen PNG con éxito!");
    } catch (err: any) {
      console.error(err);
      toast.dismiss(toastId);
      toast.error("Error al exportar PNG: " + err.message);
    } finally {
      setIsExportingPNG(false);
    }
  };

  const addParticipant = () => {
    if (!activeStory) return;
    const p: StoryParticipant = {
      id: crypto.randomUUID(),
      name: "Nuevo Avatar",
    };
    setActiveStory({
      ...activeStory,
      participants: [...activeStory.participants, p],
    });
  };

  const updateParticipant = (
    id: string,
    updates: Partial<StoryParticipant>,
  ) => {
    if (!activeStory) return;
    const newParticipants = activeStory.participants.map((p) =>
      p.id === id ? { ...p, ...updates } : p,
    );
    setActiveStory({ ...activeStory, participants: newParticipants });
  };

  const handleParticipantPhoto = (id: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          updateParticipant(id, { photoUrl: ev.target?.result as string });
          toast.success("Foto de avatar actualizada");
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const toggleImageInSequence = (imgId: string) => {
    if (!activeStory) return;
    const exists = activeStory.steps.some((s) => s.imageId === imgId);

    if (exists) {
      setActiveStory({
        ...activeStory,
        steps: activeStory.steps.filter((s) => s.imageId !== imgId),
      });
    } else {
      const newStep: StoryStep = {
        id: crypto.randomUUID(),
        imageId: imgId,
        participantIds: [],
        narrative: "",
      };
      setActiveStory({
        ...activeStory,
        steps: [...activeStory.steps, newStep],
      });
    }
  };

  const swapImageInStep = (stepId: string, newImageId: string) => {
    if (!activeStory) return;
    const newSteps = activeStory.steps.map((s) =>
      s.id === stepId ? { ...s, imageId: newImageId } : s,
    );
    setActiveStory({ ...activeStory, steps: newSteps });
    toast.success("Imagen reemplazada en la secuencia");
  };

  const toggleParticipantInStep = (stepId: string, participantId: string) => {
    if (!activeStory) return;
    const newSteps = activeStory.steps.map((s) => {
      if (s.id !== stepId) return s;
      const pExists = s.participantIds.includes(participantId);
      return {
        ...s,
        participantIds: pExists
          ? s.participantIds.filter((id) => id !== participantId)
          : [...s.participantIds, participantId],
      };
    });
    setActiveStory({ ...activeStory, steps: newSteps });
  };

  const [generatingNarrative, setGeneratingNarrative] = useState(false);

  const handleAutoCreateStory = async () => {
    if (!autoStoryPrompt.trim() || !activeStory) return;
    setIsAutoCreating(true);
    toast.info("Iniciando creación de historia...", {
      description:
        "Esto puede tardar unos minutos ya que estamos generando múltiples escenas.",
    });

    try {
      const { breakdownStoryIntoScenes, generateImageAI } =
        await import("@/lib/gemini");
      const { saveGalleryItem, getSettings } = await import("@/services/storage");

      const settings = await getSettings();
      const storyScenesCount = settings.storyScenesCount || 4;

      const scenes = await breakdownStoryIntoScenes(
        autoStoryPrompt,
        activeStory.participants,
        storyScenesCount
      );

      const newSteps: StoryStep[] = [];

      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        toast.info(`Generando imagen de escena ${i + 1}/${scenes.length}...`);

        let finalPrompt = scene.imagePrompt;
        const selectedStyle = activeStory.style || "pixar";
        if (selectedStyle === "pixar") {
          finalPrompt +=
            ", in 3D Pixar digital animation style, stylized adorable character, highly detailed, cozy beautiful lighting, 3d render";
        } else if (selectedStyle === "anime") {
          finalPrompt +=
            ", in professional high-quality Japanese anime style, detailed hand-drawn illustration, vibrant masterpiece";
        } else if (selectedStyle === "watercolor") {
          finalPrompt +=
            ", in soft exquisite watercolor painting style, wet-on-wet details, delicate canvas texture, artistic watercolor washes";
        } else if (selectedStyle === "cinematic") {
          finalPrompt +=
            ", cinematic movie photography, dramatic cinematic lighting, photorealistic, premium lens depth of field, sharp focus, ultra-detailed";
        } else if (selectedStyle === "comic") {
          finalPrompt +=
            ", in comic book graphic novel illustration style, classic ink lines, rich colored cel shading";
        } else if (selectedStyle === "none") {
          finalPrompt +=
            ", photorealistic, lifelike high detail portrait, natural ambient lighting, sharp focus, photograph";
        }

        // Enforce physical traits integrity
        const physicalTraitsInstruction =
          " Crucially, preserve absolute facial loyalty and identity. Maintain the exact physical features, facial structure, skin tone, eye color, hair style, facial details, age, and appearance of the person in the reference photograph. Do not alter, cartoonize, or morph their distinctive physical features, facial expressions, and characteristics in any way. They must look EXACTLY as they do in their uploaded reference photos with zero changes to their traits.";
        finalPrompt += physicalTraitsInstruction;

        // Find reference images for participants in this scene
        const referenceImages = activeStory.participants
          .filter(
            (p) =>
              scene.participantIds.includes(p.id) ||
              scene.participantIds.includes(p.name),
          )
          .filter((p) => p.photoUrl)
          .map((p) => ({
            data: p.photoUrl!.split(",")[1],
            mimeType: p.photoUrl!.split(",")[0].split(":")[1].split(";")[0],
          }));

        try {
          const imageUrl = await generateImageAI(finalPrompt, {
            referenceImages,
            highQuality: true,
          });

          const imageId = crypto.randomUUID();
          await saveGalleryItem("history", {
            id: imageId,
            url: imageUrl,
            prompt: scene.imagePrompt,
            timestamp: new Date().toISOString(),
            category: "history",
            metadata: {},
          });

          const stepId = crypto.randomUUID();
          const newStep: StoryStep = {
            id: stepId,
            imageId,
            participantIds: activeStory.participants
              .filter(
                (p) =>
                  scene.participantIds.includes(p.id) ||
                  scene.participantIds.includes(p.name),
              )
              .map((p) => p.id),
            narrative: scene.narrative,
          };

          newSteps.push(newStep);

          // Stream/present the image immediately as it gets created step-by-step
          setActiveStory((prev) => {
            if (!prev) return prev;
            const updated = {
              ...prev,
              steps: [...prev.steps, newStep],
            };
            saveStory(updated);
            return updated;
          });

          await loadData();
        } catch (imgError) {
          console.error(`Error generating image for scene ${i + 1}:`, imgError);
          // Continue with next scenes even if one fails
        }
      }

      if (newSteps.length > 0) {
        setActiveStory((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            description: prev.description
              ? prev.description + "\n\n" + autoStoryPrompt
              : autoStoryPrompt,
          };
        });
        setAutoStoryPrompt("");
        toast.success("Escenas de historia creadas");
      } else {
        toast.error("No se pudieron generar escenas.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Error al crear la historia");
    } finally {
      setIsAutoCreating(false);
    }
  };

  const handleRegenerateStep = async (stepId: string) => {
    const step = activeStory?.steps.find((s) => s.id === stepId);
    if (!step || !activeStory) return;

    const img = availableImages.find((i) => i.id === step.imageId);
    const basePrompt = img?.prompt || step.narrative || "Escena de historia";

    // Simple popup prompt
    const userPromptInput = prompt(
      "Modifica el prompt de generación si lo deseas (o deja en blanco para usar el mismo):",
      basePrompt,
    );
    if (userPromptInput === null) return;

    const finalPromptText = userPromptInput.trim() || basePrompt;

    toast.info("Regenerando esta escena específica...", {
      description: "Reescribiendo la imagen con los mismos participantes.",
    });

    try {
      const { generateImageAI } = await import("@/lib/gemini");
      const { saveGalleryItem } = await import("@/services/storage");

      let finalPrompt = finalPromptText;
      const selectedStyle = activeStory.style || "pixar";
      if (selectedStyle === "pixar") {
        finalPrompt +=
          ", in 3D Pixar digital animation style, stylized adorable character, highly detailed, cozy beautiful lighting, 3d render";
      } else if (selectedStyle === "anime") {
        finalPrompt +=
          ", in professional high-quality Japanese anime style, detailed hand-drawn illustration, vibrant masterpiece";
      } else if (selectedStyle === "watercolor") {
        finalPrompt +=
          ", in soft exquisite watercolor painting style, wet-on-wet details, delicate canvas texture, artistic watercolor washes";
      } else if (selectedStyle === "cinematic") {
        finalPrompt +=
          ", cinematic movie photography, dramatic cinematic lighting, photorealistic, premium lens depth of field, sharp focus, ultra-detailed";
      } else if (selectedStyle === "comic") {
        finalPrompt +=
          ", in comic book graphic novel illustration style, classic ink lines, rich colored cel shading";
      } else if (selectedStyle === "none") {
        finalPrompt +=
          ", photorealistic, lifelike high detail portrait, natural ambient lighting, sharp focus, photograph";
      }

      // Strict physical traits preservation
      const physicalTraitsInstruction =
        " Crucially, preserve absolute facial loyalty and identity. Maintain the exact physical features, facial structure, skin tone, eye color, hair style, facial details, age, and appearance of the person in the reference photograph. Do not alter, cartoonize, or morph their distinctive physical features, facial expressions, and characteristics in any way. They must look EXACTLY as they do in their uploaded reference photos with zero changes to their traits.";
      finalPrompt += physicalTraitsInstruction;

      const referenceImages = activeStory.participants
        .filter((p) => step.participantIds.includes(p.id))
        .filter((p) => p.photoUrl)
        .map((p) => ({
          data: p.photoUrl!.split(",")[1],
          mimeType: p.photoUrl!.split(",")[0].split(":")[1].split(";")[0],
        }));

      const newImageUrl = await generateImageAI(finalPrompt, {
        referenceImages,
        highQuality: true,
      });

      const newImageId = crypto.randomUUID();
      await saveGalleryItem("history", {
        id: newImageId,
        url: newImageUrl,
        prompt: finalPromptText,
        timestamp: new Date().toISOString(),
        category: "history",
        metadata: {},
      });

      const updatedSteps = activeStory.steps.map((s) =>
        s.id === stepId ? { ...s, imageId: newImageId } : s,
      );

      const updatedStory = {
        ...activeStory,
        steps: updatedSteps,
      };
      setActiveStory(updatedStory);
      await saveStory(updatedStory);
      await loadData();
      toast.success("Escena regenerada con éxito!");
    } catch (err: any) {
      console.error(err);
      toast.error("Error al regenerar escena: " + err.message);
    }
  };

  const handleGenerateNarrative = async () => {
    if (!activeStory || activeStory.steps.length === 0) return;
    setGeneratingNarrative(true);
    try {
      const { generateNarrative } = await import("@/lib/gemini");
      const scenes = activeStory.steps.map((s) => {
        const img = availableImages.find((i) => i.id === s.imageId);
        const participants = activeStory.participants
          .filter((p) => s.participantIds.includes(p.id))
          .map((p) => p.name);
        return {
          prompt: img?.prompt || "Sin descripción",
          participants,
        };
      });

      const narrative = await generateNarrative(activeStory.title, scenes);
      setActiveStory({ ...activeStory, description: narrative });
      toast.success("Narrativa generada");
    } catch (error) {
      toast.error("Error al generar narrativa");
    } finally {
      setGeneratingNarrative(false);
    }
  };

  return (
    <PanelGroup
      orientation="horizontal"
      className="h-full gap-6 p-4 lg:p-6 bg-slate-950 overflow-hidden"
    >
      {/* Sidebar: Stories List (Bento Card) */}
      <Panel
        defaultSize={25}
        minSize={20}
        className="bg-slate-900 border border-slate-800 rounded-3xl flex flex-col shadow-xl overflow-hidden"
      >
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            {t("app.history")}
          </h2>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-lg text-indigo-400 hover:bg-slate-800"
            onClick={() => handleCreateNew()}
          >
            <Plus size={18} />
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-2">
            {stories.map((story) => (
              <div key={story.id} className="relative group w-full">
                <button
                  onClick={() => {
                    setActiveStory(story);
                    setIsEditing(false);
                  }}
                  className={cn(
                    "w-full text-left p-4 pr-12 rounded-2xl transition-all border",
                    activeStory?.id === story.id
                      ? "bg-slate-800 border-indigo-500/30 shadow-lg text-slate-200"
                      : "border-transparent hover:bg-slate-800/50 text-slate-400 hover:text-slate-200",
                  )}
                >
                  <p className="font-bold text-sm truncate uppercase tracking-tight">
                    {story.title || t("common.untitled")}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex -space-x-2">
                      {story.participants.slice(0, 3).map((p, i) => (
                        <div
                          key={i}
                          className="w-6 h-6 rounded-full border-2 border-slate-900 bg-slate-700 flex items-center justify-center text-[8px] font-bold uppercase"
                        >
                          {p.name.charAt(0)}
                        </div>
                      ))}
                    </div>
                    <span className="text-[10px] font-mono text-slate-600">
                      {new Date(story.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                </button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all h-8 w-8 rounded-lg text-red-500 hover:text-red-400 hover:bg-red-950/30"
                  onClick={(e) => {
                    e.stopPropagation();
                    setStoryToDelete(story.id);
                  }}
                  title="Eliminar Historia"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
            {stories.length === 0 && !activeStory && (
              <div className="text-center py-12 p-4">
                <p className="text-slate-600 text-xs font-bold uppercase tracking-widest">
                  VACÍO
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </Panel>

      <PanelResizeHandle className="w-2 bg-slate-800 hover:bg-slate-700 transition rounded-lg" />

      {/* Main Content: Story Content (Bento Card) */}
      <Panel
        defaultSize={75}
        minSize={40}
        className="bg-slate-900 border border-slate-800 rounded-3xl flex flex-col shadow-2xl relative overflow-hidden"
      >
        {activeStory ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-8 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/50 block-style-selector">
              <div className="flex-1">
                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                        Título de la Historia
                      </label>
                      <Input
                        value={activeStory.title}
                        onChange={(e) =>
                          setActiveStory({
                            ...activeStory,
                            title: e.target.value,
                          })
                        }
                        className="text-2xl font-bold bg-slate-950 border-slate-800 rounded-xl px-3 h-10 text-white focus-visible:ring-1 focus-visible:ring-indigo-500/30 placeholder:text-slate-700 tracking-tight"
                        placeholder="TÍTULO DE LA HISTORIA"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                        Estilo Visual de la Historia
                      </label>
                      <select
                        value={activeStory.style || "pixar"}
                        onChange={(e) =>
                          setActiveStory({
                            ...activeStory,
                            style: e.target.value,
                          })
                        }
                        className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 h-10 focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="pixar">3D Pixar (Predeterminado)</option>
                        <option value="anime">Anime</option>
                        <option value="watercolor">Acuarela</option>
                        <option value="cinematic">Cinemático</option>
                        <option value="comic">Comic / Novela Gráfica</option>
                        <option value="none">Realista / Fotografía</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight">
                      {activeStory.title}
                    </h2>
                    <div className="flex flex-wrap gap-2 mt-2 items-center">
                      <span className="text-[10px] text-slate-500 font-mono">
                        ESTADO:{" "}
                        <span className="font-bold text-emerald-400">
                          VISTA PREVIA
                        </span>
                      </span>
                      <span className="text-[10px] px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20 font-bold uppercase tracking-wider">
                        ESTILO:{" "}
                        {activeStory.style === "pixar" || !activeStory.style
                          ? "3D Pixar"
                          : activeStory.style === "anime"
                            ? "Anime"
                            : activeStory.style === "watercolor"
                              ? "Acuarela"
                              : activeStory.style === "cinematic"
                                ? "Cinemático"
                                : activeStory.style === "comic"
                                  ? "Comic"
                                  : "Realista"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {!isEditing && (
                  <>
                    {/* Selector de Formatos */}
                    <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
                      {(["historieta", "editorial", "presentacion", "video"] as const).map((fmt) => (
                        <Button
                          key={fmt}
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "h-7 px-2.5 rounded-lg text-[9px] font-bold uppercase transition-all",
                            (activeStory.format === fmt || (!activeStory.format && fmt === "historieta"))
                              ? "bg-indigo-600 text-white hover:bg-indigo-500 shadow-md"
                              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900",
                          )}
                          onClick={() => handleFormatChange(fmt)}
                        >
                          {fmt === "historieta" && "Cómic"}
                          {fmt === "editorial" && "Libro"}
                          {fmt === "presentacion" && "Diapositivas"}
                          {fmt === "video" && "Video"}
                        </Button>
                      ))}
                    </div>

                    {/* Acciones de Exportación */}
                    <div className="flex items-center gap-1.5 border-l border-slate-800 pl-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 rounded-xl border-indigo-500/20 text-indigo-400 bg-slate-950 hover:bg-indigo-500/10 hover:text-indigo-300 gap-1.5 text-[9px] font-bold uppercase transition"
                        onClick={handleExportHTML}
                        title="Exportar historia como HTML autónomo interactivo"
                      >
                        <Download size={11} /> EXPORTAR HTML
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 rounded-xl border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 gap-1.5 text-[9px] font-bold uppercase transition"
                        onClick={handlePrintOrPDF}
                        title="Imprimir o Exportar como PDF"
                      >
                        <Printer size={11} /> IMPRIMIR / PDF
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 rounded-xl border-emerald-500/20 text-emerald-400 bg-slate-950 hover:bg-emerald-500/10 hover:text-emerald-300 gap-1.5 text-[9px] font-bold uppercase transition"
                        onClick={handleExportPNG}
                        disabled={isExportingPNG}
                        title="Exportar historia en formato PNG"
                      >
                        {isExportingPNG ? (
                          <RefreshCw size={11} className="animate-spin" />
                        ) : (
                          <Images size={11} />
                        )}
                        EXPORTAR PNG
                      </Button>
                    </div>
                  </>
                )}

                {isEditing ? (
                  <Button
                    variant="outline"
                    className="rounded-xl border-slate-800 bg-slate-950 hover:bg-slate-800 text-[10px] font-bold uppercase h-10 gap-2"
                    onClick={handleSave}
                  >
                    <Save size={14} /> {t("common.save")}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="rounded-xl border-slate-800 bg-slate-950 hover:bg-slate-800 text-[10px] font-bold uppercase h-10"
                    onClick={() => setIsEditing(true)}
                  >
                    EDITAR
                  </Button>
                )}
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div ref={storyRef} className="max-w-4xl mx-auto p-8 space-y-12">
                {!isEditing ? (
                  /* VISTA PREVIA ACCORDING TO USER'S SELECTED PRESENTATION FORMAT */
                  <div className="space-y-12">
                    {/* Format switch rendering header info */}
                    <div className="p-6 bg-slate-950/40 rounded-3xl border border-slate-900 border-dashed text-center">
                      <span className="text-[10px] font-extrabold uppercase text-indigo-400 tracking-wider font-mono">Resumen de Crónica</span>
                      <p className="text-xs text-slate-300 italic mt-1 leading-relaxed max-w-xl mx-auto">
                        "{activeStory.description || "Un viaje narrado a través de secuencias visuales de alta precisión creativa..."}"
                      </p>
                    </div>

                    {(activeStory.format === "historieta" || !activeStory.format) && (
                      <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:grid-cols-2">
                          {activeStory.steps.map((step, idx) => {
                            const img = availableImages.find((i) => i.id === step.imageId);
                            return (
                              <div key={step.id} className="border-4 border-slate-950 bg-slate-900 p-4 rounded-3xl shadow-[8px_8px_0px_0px_rgba(30,27,75,1)] flex flex-col space-y-4 print:shadow-none print:border-2">
                                <div className="aspect-video w-full rounded-2xl overflow-hidden border-2 border-slate-800 relative bg-black">
                                  {img ? (
                                    <img src={img.url} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-700 bg-slate-950 text-xs font-mono">
                                      Cargando imagen o escena no encontrada
                                    </div>
                                  )}
                                  <div className="absolute top-3 left-3 bg-indigo-600 text-white font-extrabold w-8 h-8 rounded-full flex items-center justify-center border-2 border-slate-950 shadow-md">
                                    {idx + 1}
                                  </div>
                                </div>
                                <div className="p-4 bg-yellow-50 text-slate-950 rounded-2xl border-2 border-slate-955 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-xs font-bold leading-relaxed relative min-h-[60px] print:shadow-none">
                                  <p className="italic">"{step.narrative || "Sin descripción"}"</p>
                                  {step.participantIds.length > 0 && (
                                    <div className="mt-2 text-[10px] text-slate-500 uppercase tracking-wider flex flex-wrap gap-1 items-center">
                                      <span>Actores:</span>
                                      {activeStory.participants
                                        .filter((p) => step.participantIds.includes(p.id))
                                        .map((p) => (
                                          <span key={p.id} className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-700 font-sans text-[9px]">{p.name}</span>
                                        ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {activeStory.format === "editorial" && (
                      <div className="bg-[#faf6ee] text-[#1b1c1e] p-8 md:p-12 rounded-[2.5rem] border border-[#e8dfd3] shadow-md font-serif print:border-none print:shadow-none print:p-0">
                        <div className="space-y-16 max-w-3xl mx-auto">
                          {activeStory.steps.map((step, idx) => {
                            const img = availableImages.find((i) => i.id === step.imageId);
                            const isEven = idx % 2 === 0;
                            return (
                              <div key={step.id} className={cn(
                                "flex flex-col md:flex-row gap-8 items-center bg-[#fdfaf2] p-6 rounded-3xl border border-[#eadaa6]/25 shadow-sm print:bg-transparent print:border-none print:shadow-none",
                                isEven ? "md:flex-row" : "md:flex-row-reverse"
                              )}>
                                <div className="w-full md:w-1/2 aspect-video rounded-2xl overflow-hidden shadow-md border border-[#eadaa6] bg-[#eae2d5]">
                                  {img ? (
                                    <img src={img.url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-mono">
                                      Imagen no encontrada
                                    </div>
                                  )}
                                </div>
                                <div className="w-full md:w-1/2 flex flex-col justify-center space-y-3">
                                  <div className="text-[10px] tracking-widest text-[#a88d44] font-bold uppercase font-sans">Escena 0{idx + 1}</div>
                                  <p className="leading-relaxed text-sm italic text-[#2c2c2aa] font-serif">
                                    <span className="text-3xl font-sans font-black float-left mr-1.5 align-middle leading-[0.8]">{(step.narrative || "S").charAt(0)}</span>
                                    {(step.narrative || "Sin narrativa para esta escena.").slice(1)}
                                  </p>
                                  {step.participantIds.length > 0 && (
                                    <div className="text-[10px] font-sans text-slate-500 flex items-center gap-1">
                                      <span>En escena:</span>
                                      {activeStory.participants
                                        .filter((p) => step.participantIds.includes(p.id))
                                        .map((p) => p.name)
                                        .join(", ")}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {activeStory.format === "presentacion" && (
                      <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-[2rem] p-8 flex flex-col shadow-2xl relative overflow-hidden min-h-[420px]">
                        <div className="flex-1 flex flex-col md:flex-row gap-8 items-center justify-center">
                          {activeStory.steps.length > 0 ? (() => {
                            const step = activeStory.steps[currentSlide] || activeStory.steps[0];
                            const img = availableImages.find((i) => i.id === step.imageId);
                            return (
                              <>
                                <div className="w-full md:w-3/5 aspect-video rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-2xl relative group">
                                  {img ? (
                                    <img src={img.url} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-600 bg-slate-950 text-xs">
                                      Imagen no encontrada
                                    </div>
                                  )}
                                  <div className="absolute top-4 left-4 bg-indigo-600 text-white font-extrabold w-8 h-8 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-lg">
                                    {currentSlide + 1}
                                  </div>
                                </div>
                                <div className="w-full md:w-2/5 flex flex-col justify-center space-y-4">
                                  <div className="text-5xl font-extrabold text-indigo-500/10 font-mono">0{currentSlide + 1}</div>
                                  <p className="text-slate-200 text-sm md:text-base leading-relaxed italic">
                                    "{step.narrative || "Sin narrativa para esta diapositiva."}"
                                  </p>
                                  {step.participantIds.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                      {activeStory.participants
                                        .filter((p) => step.participantIds.includes(p.id))
                                        .map((p) => (
                                          <span key={p.id} className="px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 rounded text-[9px] font-bold">
                                            {p.name}
                                          </span>
                                        ))}
                                    </div>
                                  )}
                                </div>
                              </>
                            );
                          })() : (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                              <Images size={48} className="mb-2 text-slate-700" />
                              <p className="text-xs">No hay escenas en la secuencia</p>
                            </div>
                          )}
                        </div>

                        {/* Slide Navigation Controls */}
                        {activeStory.steps.length > 0 && (
                          <div className="flex justify-between items-center mt-8 border-t border-slate-800 pt-6">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 px-4 rounded-xl border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 text-xs font-bold uppercase"
                              onClick={() => setCurrentSlide((prev) => (prev > 0 ? prev - 1 : activeStory.steps.length - 1))}
                            >
                              <ChevronLeft size={16} /> Anterior
                            </Button>
                            
                            <div className="flex gap-1.5 items-center">
                              {activeStory.steps.map((_, i) => (
                                <button
                                  key={i}
                                  onClick={() => setCurrentSlide(i)}
                                  className={cn(
                                    "h-2 rounded-full transition-all duration-300",
                                    currentSlide === i ? "bg-indigo-500 w-5" : "bg-slate-700 w-2 hover:bg-slate-600"
                                  )}
                                  title={`Slide ${i + 1}`}
                                />
                              ))}
                            </div>

                            <Button
                              variant="default"
                              size="sm"
                              className="h-9 px-4 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-xs font-bold uppercase transition"
                              onClick={() => setCurrentSlide((prev) => (prev < activeStory.steps.length - 1 ? prev + 1 : 0))}
                            >
                              Siguiente <ChevronRight size={16} />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {activeStory.format === "video" && (
                      <div className="max-w-4xl mx-auto bg-slate-950 rounded-3xl overflow-hidden border border-slate-900 shadow-2xl print:bg-transparent print:border-none">
                        {/* Screen */}
                        <div className="aspect-video bg-black relative group flex items-center justify-center overflow-hidden">
                          {activeStory.steps.length > 0 ? (() => {
                            const step = activeStory.steps[videoIdx] || activeStory.steps[0];
                            const img = availableImages.find((i) => i.id === step.imageId);
                            return (
                              <div className="absolute inset-0 flex items-center justify-center">
                                {img ? (
                                  <img src={img.url} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-600 bg-slate-955 text-xs">
                                    Escena no disponible
                                  </div>
                                )}
                                
                                {/* Subtitles Overlay */}
                                <div className="absolute bottom-12 left-8 right-8 bg-black/75 px-6 py-3 rounded-2xl border border-slate-800 text-center text-white font-extrabold text-xs md:text-sm shadow-xl backdrop-blur-md italic selection:bg-indigo-500 max-w-2xl mx-auto">
                                  {step.narrative || "Sin subtítulos."}
                                </div>
                              </div>
                            );
                          })() : (
                            <div className="flex flex-col items-center justify-center text-slate-600">
                              <Images size={48} />
                              <p className="text-xs">No hay escenas en la secuencia</p>
                            </div>
                          )}

                          {/* Recording status dot */}
                          <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-full text-[9px] font-bold text-red-500 border border-slate-800 tracking-widest uppercase">
                            <span className={cn("w-1.5 h-1.5 bg-red-500 rounded-full", videoPlaying && "animate-pulse")} />
                            {videoPlaying ? "REPLAY ACTIVO" : "NARRADOR DETENIDO"}
                          </div>
                        </div>

                        {/* Player Controls Panel */}
                        {activeStory.steps.length > 0 && (
                          <div className="bg-slate-900 p-6 border-t border-slate-800 space-y-4">
                            {/* Timeline tracker */}
                            <div 
                              className="relative h-1.5 bg-slate-800 rounded-full overflow-hidden cursor-pointer"
                              onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const clickX = e.clientX - rect.left;
                                const percentage = clickX / rect.width;
                                const targetIndex = Math.min(
                                  activeStory.steps.length - 1,
                                  Math.max(0, Math.floor(percentage * activeStory.steps.length))
                                );
                                setVideoIdx(targetIndex);
                              }}
                            >
                              <div 
                                className="absolute left-0 top-0 bottom-0 bg-indigo-500 transition-all duration-300"
                                style={{ width: `${((videoIdx + 1) / activeStory.steps.length) * 100}%` }}
                              />
                            </div>

                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                <Button
                                  size="sm"
                                  className={cn(
                                    "h-9 px-4 rounded-xl text-xs font-bold uppercase transition",
                                    videoPlaying ? "bg-red-600 hover:bg-red-500 text-white" : "bg-indigo-600 hover:bg-indigo-500 text-white"
                                  )}
                                  onClick={() => setVideoPlaying((prev) => !prev)}
                                >
                                  {videoPlaying ? (
                                    <>
                                      <Pause size={14} className="mr-1.5" /> DETENER
                                    </>
                                  ) : (
                                    <>
                                      <Play size={14} className="mr-1.5" /> NARRAR LECTURA
                                    </>
                                  )}
                                </Button>

                                <span className="text-[11px] text-slate-400 font-mono">
                                  Escena <span className="text-white font-bold">{videoIdx + 1}</span> de <span className="text-white font-bold">{activeStory.steps.length}</span>
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                {/* Narrator volume toggle */}
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-9 w-9 rounded-xl border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800"
                                  onClick={() => setNarratorMuted((prev) => !prev)}
                                  title={narratorMuted ? "Activar Narrador" : "Silenciar Narrador"}
                                >
                                  {narratorMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                                </Button>

                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-9 w-9 rounded-xl border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800"
                                  onClick={() => setVideoIdx((prev) => (prev > 0 ? prev - 1 : activeStory.steps.length - 1))}
                                >
                                  <ChevronLeft size={16} />
                                </Button>

                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-9 w-9 rounded-xl border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800"
                                  onClick={() => setVideoIdx((prev) => (prev < activeStory.steps.length - 1 ? prev + 1 : 0))}
                                >
                                  <ChevronRight size={16} />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* ORIGINAL EDIT MODE BLOCKS / PANEL CONTROLS */
                  <div className="space-y-12">
                    {/* Narration/Description Section */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center px-1">
                        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          DESCRIBE EL MOMENTO (CREACIÓN IA)
                        </h3>
                        <div className="flex gap-2">
                          {autoStoryPrompt.trim() && (
                            <Button
                              onClick={handleAutoCreateStory}
                              disabled={
                                isAutoCreating ||
                                activeStory.participants.length === 0
                              }
                              size="sm"
                              variant="default"
                              className="h-8 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold gap-2 shadow-lg shadow-indigo-500/20"
                            >
                              {isAutoCreating ? (
                                <RefreshCw className="animate-spin" size={12} />
                              ) : (
                                <Sparkles size={12} />
                              )}
                              CREAR ESCENAS
                            </Button>
                          )}
                          <Button
                            onClick={handleGenerateNarrative}
                            disabled={
                              generatingNarrative || activeStory.steps.length === 0
                            }
                            size="sm"
                            variant="outline"
                            className="h-8 border-indigo-500/20 text-indigo-400 text-[10px] font-bold gap-2"
                          >
                            {generatingNarrative ? (
                              <RefreshCw className="animate-spin" size={12} />
                            ) : (
                              <MessageSquareQuote size={12} />
                            )}
                            AUTOGENERAR NARRATIVA
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <Textarea
                          value={autoStoryPrompt}
                          onChange={(e) => setAutoStoryPrompt(e.target.value)}
                          className="min-h-[100px] bg-slate-950 border-slate-800 rounded-2xl p-6 text-sm leading-relaxed focus-visible:ring-indigo-500/30 text-slate-300 shadow-inner resize-none border-dashed"
                          placeholder="Describe lo que está pasando en este momento de la historia... La AI creará las escenas visuales automáticamente usando tus avatares."
                        />
                        {activeStory.participants.length === 0 && (
                          <p className="text-[10px] text-amber-500 font-bold uppercase tracking-tight px-1">
                            ⚠️ Crea al menos un avatar abajo para que la AI pueda usarlos como protagonistas.
                          </p>
                        )}
                      </div>

                      <Separator className="bg-slate-800/50" />

                      <div className="flex justify-between items-center px-1">
                        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          NARRATIVA FINAL
                        </h3>
                      </div>
                      <Textarea
                        value={activeStory.description}
                        onChange={(e) =>
                          setActiveStory({
                            ...activeStory,
                            description: e.target.value,
                          })
                        }
                        className="min-h-[160px] bg-slate-950 border-slate-800 rounded-2xl p-6 text-sm leading-relaxed focus-visible:ring-indigo-500/30 text-slate-300 shadow-inner resize-none"
                        placeholder="Describe la trama de tu historia o usa el botón de autogenerar..."
                      />
                    </div>

                    {/* Scenes/Steps Grid */}
                    <div className="space-y-6">
                      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">
                        SECUENCIA DE ESCENAS
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {activeStory.steps.map((step, idx) => {
                          const img = availableImages.find(
                            (i) => i.id === step.imageId,
                          );
                          return (
                            <motion.div
                              key={step.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="space-y-3"
                            >
                              <div className="aspect-video relative group overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
                                {img ? (
                                  <img
                                    src={img.url}
                                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-700 bg-slate-900 text-xs text-center p-3 font-mono">
                                    Cargando imagen o escena no encontrada
                                  </div>
                                )}
                                <div className="absolute top-3 left-3 w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center text-xs font-bold shadow-lg shadow-indigo-500/20">
                                  {idx + 1}
                                </div>

                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger
                                      className={cn(
                                        buttonVariants({
                                          variant: "ghost",
                                          size: "sm",
                                        }),
                                        "text-white bg-slate-900 border border-slate-800 hover:bg-slate-800 gap-1.5 h-8 px-2 text-[9px] font-bold uppercase rounded-lg",
                                      )}
                                    >
                                      <RefreshCw size={12} /> SWAP
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="max-h-64 overflow-y-auto bg-slate-900 border-slate-800 text-slate-200">
                                      {availableImages.map((ai) => (
                                        <DropdownMenuItem
                                          key={ai.id}
                                          className="gap-3 focus:bg-slate-800"
                                          onClick={() =>
                                            swapImageInStep(step.id, ai.id)
                                          }
                                        >
                                          <img
                                            src={ai.url}
                                            className="w-10 h-10 rounded-lg object-cover"
                                          />
                                          <span className="text-[10px] max-w-[150px] truncate">
                                            {ai.prompt}
                                          </span>
                                        </DropdownMenuItem>
                                      ))}
                                    </DropdownMenuContent>
                                  </DropdownMenu>

                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-indigo-400 bg-slate-900 border border-slate-800 hover:bg-slate-800 h-8 px-2 text-[9px] font-bold uppercase rounded-lg gap-1.5"
                                    onClick={() => handleRegenerateStep(step.id)}
                                  >
                                    <Sparkles size={12} /> REGEN
                                  </Button>

                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="text-red-400 bg-slate-900 border border-slate-800 hover:bg-red-800/80 h-8 w-8 rounded-lg"
                                    onClick={() =>
                                      toggleImageInSequence(step.imageId)
                                    }
                                  >
                                    <Trash2 size={13} />
                                  </Button>
                                </div>
                              </div>

                              <div className="px-1 space-y-2.5">
                                <Textarea
                                  value={step.narrative || ""}
                                  onChange={(e) => {
                                    const updatedSteps = activeStory.steps.map(
                                      (s) =>
                                        s.id === step.id
                                          ? { ...s, narrative: e.target.value }
                                          : s,
                                    );
                                    setActiveStory({
                                      ...activeStory,
                                      steps: updatedSteps,
                                    });
                                  }}
                                  className="bg-slate-950 border-slate-800 text-xs text-slate-200 rounded-xl resize-none p-3 h-16 focus-visible:ring-indigo-500/30 placeholder:text-slate-700 leading-relaxed min-h-0"
                                  placeholder="Narrativa o descripción de esta escena..."
                                />

                                <div className="flex items-center justify-between">
                                  <p className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter">
                                    Participantes en escena
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {activeStory.participants.length > 0 ? (
                                      activeStory.participants.map((p) => (
                                        <button
                                          key={p.id}
                                          onClick={() =>
                                            toggleParticipantInStep(step.id, p.id)
                                          }
                                          className={cn(
                                            "px-2 py-0.5 rounded-lg text-[9px] font-bold border transition-all",
                                            step.participantIds.includes(p.id)
                                              ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                                              : "bg-slate-950 border-slate-800 text-slate-600",
                                          )}
                                        >
                                          {p.name}
                                        </button>
                                      ))
                                    ) : (
                                      <span className="text-[9px] text-slate-700 italic">
                                        No hay avatares creados
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                        <div className="col-span-full pt-4">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 px-1">
                            Sincronizar Galería (Añadir a Secuencia)
                          </p>
                          <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
                            {availableImages.map((img) => (
                              <button
                                key={img.id}
                                onClick={() => toggleImageInSequence(img.id)}
                                className={cn(
                                  "shrink-0 w-24 aspect-video rounded-xl overflow-hidden border-2 transition-all relative",
                                  activeStory.steps.some(
                                    (s) => s.imageId === img.id,
                                  )
                                    ? "border-indigo-500 scale-105 shadow-lg shadow-indigo-500/20"
                                    : "border-transparent opacity-60 hover:opacity-100",
                                )}
                              >
                                <img
                                  src={img.url}
                                  className="w-full h-full object-contain"
                                />
                                {activeStory.steps.some(
                                  (s) => s.imageId === img.id,
                                ) && (
                                  <div className="absolute top-1 right-1 bg-indigo-500 rounded-full p-0.5 text-white">
                                    <Sparkles size={8} />
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                        {activeStory.steps.length === 0 && (
                          <div className="col-span-full py-12 bg-slate-950/30 rounded-3xl border border-dashed border-slate-800 flex flex-col items-center gap-2 text-slate-600">
                            <Images size={32} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">
                              Sin Secuencia
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Participants Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      AVATARES & PERSONAJES
                    </h3>
                    {isEditing && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[10px] font-bold text-indigo-400 h-6 px-2 hover:bg-indigo-500/10"
                        onClick={addParticipant}
                      >
                        + NEW AVATAR
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {activeStory.participants.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 p-3 pl-4 pr-6 bg-slate-950 rounded-2xl border border-slate-800 group transition-all hover:border-slate-700"
                      >
                        <button
                          onClick={() =>
                            isEditing && handleParticipantPhoto(p.id)
                          }
                          className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-sm font-bold text-indigo-400 border border-slate-700 group-hover:bg-indigo-500/10 group-hover:border-indigo-500/20 uppercase overflow-hidden"
                        >
                          {p.photoUrl ? (
                            <img
                              src={p.photoUrl}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            p.name.charAt(0)
                          )}
                        </button>
                        {isEditing ? (
                          <Input
                            value={p.name}
                            onChange={(e) =>
                              updateParticipant(p.id, { name: e.target.value })
                            }
                            className="h-6 w-24 text-xs font-bold bg-transparent border-none p-0 focus-visible:ring-0"
                          />
                        ) : (
                          <span className="text-xs font-bold uppercase tracking-tight">
                            {p.name}
                          </span>
                        )}
                        {isEditing && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="opacity-0 group-hover:opacity-100 h-6 w-6 text-slate-600 hover:text-red-400"
                            onClick={() => {
                              const newP = activeStory.participants.filter(
                                (item) => item.id !== p.id,
                              );
                              setActiveStory({
                                ...activeStory,
                                participants: newP,
                              });
                            }}
                          >
                            <Trash2 size={12} />
                          </Button>
                        )}
                      </div>
                    ))}
                    {activeStory.participants.length === 0 && (
                      <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest px-1">
                        Sin Participantes
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from),_transparent_70%)] from-indigo-500/5">
            <div className="w-24 h-24 bg-slate-950 rounded-[2.5rem] border border-slate-800 flex items-center justify-center mb-8 text-slate-700 shadow-2xl">
              <BookOpen size={48} />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight mb-2 uppercase">
              Crónicas Visuales
            </h2>
            <p className="text-slate-500 max-w-xs font-medium text-sm">
              Selecciona una narrativa del panel lateral o inicia una nueva para
              organizar tus secuencias generadas.
            </p>
            <Button
              variant="outline"
              className="mt-8 rounded-full h-12 px-8 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500 hover:text-white uppercase font-bold tracking-widest text-xs transition-all shadow-lg"
              onClick={() => handleCreateNew()}
            >
              INICIAR NUEVA CRÓNICA
            </Button>
          </div>
        )}
      </Panel>

      <Dialog open={storyToDelete !== null} onOpenChange={(open) => !open && setStoryToDelete(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              ¿Eliminar historia permanente?
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Esta acción no se puede deshacer. Se eliminará la historia seleccionada permanentemente de tu base de datos local.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4 flex justify-end">
            <Button variant="ghost" onClick={() => setStoryToDelete(null)} className="text-slate-400 hover:text-white hover:bg-slate-800">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => storyToDelete && handleDeleteStory(storyToDelete)} className="bg-red-600 hover:bg-red-700 text-white">
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PanelGroup>
  );
}
