import { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, Thermometer, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSettings, AppSettings } from '@/services/storage';

interface WeatherData {
  city: string;
  current: {
    temperature_2m: number;
    weather_code: number;
  };
  daily: {
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
  };
}

export default function WeatherWidget({ isHorizontal }: { isHorizontal: boolean }) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    async function init() {
      const savedSettings = await getSettings();
      setSettings(savedSettings);
    }
    init();

    window.addEventListener('settingsChanged', init);
    
    if (!navigator.geolocation) {
      setError("Geolocalización no soportada");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(`/api/weather?lat=${latitude}&lon=${longitude}`);
          if (!res.ok) {
            throw new Error(`Error ${res.status}: ${res.statusText}`);
          }
          const data = await res.json();
          setWeather(data);
        } catch (err) {
          setError("Error obteniendo clima");
        } finally {
          setLoading(false);
        }
      }, 
      (err) => {
        setError("Sin permiso de ubicación");
        setLoading(false);
      }
    );
    
    return () => window.removeEventListener('settingsChanged', init);
  }, []);

  const formatTemp = (celsius: number) => {
    if (settings?.temperatureUnit === 'F') {
      return Math.round((celsius * 9) / 5 + 32);
    }
    return Math.round(celsius);
  };
  
  const unitLabel = settings?.temperatureUnit === 'F' ? '°F' : '°C';

  if (loading) return <div className="text-xs text-slate-500 p-2">...</div>;
  if (error) return <div className="text-xs text-red-400 p-2 truncate" title={error}>!</div>;
  if (!weather) return <div className="text-xs text-slate-600 p-2">N/A</div>;

  return (
    <div className={cn("flex items-center gap-2 text-xs text-slate-400 bg-slate-800/50 p-2 rounded-xl border border-slate-700/30", isHorizontal ? "flex-row shrink-0" : "flex-col shrink-0")}>
      <MapPin size={14} className="shrink-0" />
      <div className="flex flex-col gap-0.5">
          <div className="font-semibold text-slate-200 truncate max-w-[100px]">{weather.city}</div>
          <div className="flex items-center gap-1 font-semibold text-indigo-400">
             <Thermometer size={12} />
             {formatTemp(weather.current.temperature_2m)}{unitLabel}
          </div>
          <div className="text-[9px] text-slate-500 whitespace-nowrap">
            Máx: {formatTemp(weather.daily.temperature_2m_max[0])}{unitLabel} | Mín: {formatTemp(weather.daily.temperature_2m_min[0])}{unitLabel}
          </div>
          <div className="flex items-center gap-1 text-[9px]">
            <CloudRain size={10} /> {weather.daily.precipitation_probability_max[0]}%
          </div>
      </div>
    </div>
  );
}
