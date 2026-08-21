
import { get, set, del, keys, clear } from 'idb-keyval';

export type GalleryCategory = 'generation' | 'analysis' | 'swap' | 'history' | 'collage';

export interface GalleryItem {
  id: string;
  url: string;
  prompt: string;
  timestamp: string;
  category: GalleryCategory;
  metadata: {
    aspectRatio?: string;
    quality?: string;
    cameraPosition?: string;
    cameraDistance?: string;
    imageStyle?: string;
    [key: string]: any;
  };
}

export interface StoryParticipant {
  id: string;
  name: string;
  photoUrl?: string;
}

export interface StoryStep {
  id: string;
  imageId: string;
  participantIds: string[];
  narrative?: string;
}

export interface StoryItem {
  id: string;
  title: string;
  description: string;
  steps: StoryStep[];
  participants: StoryParticipant[];
  timestamp: string;
  style?: string;
  format?: 'historieta' | 'editorial' | 'presentacion' | 'video';
}

export interface AppSettings {
  language: 'es' | 'en';
  numVariations: number;
  autoAdjustPrompts: boolean;
  defaultGenerationLanguage: 'es' | 'en';
  taskbarPosition: 'top' | 'bottom' | 'left' | 'right';
  userPhotos: string[];
  temperatureUnit: 'C' | 'F';
  driveFolderPath?: string;
  storyScenesCount?: number;
}

const STORAGE_KEYS = {
  generation: 'imagigen_generation',
  analysis: 'imagigen_analysis',
  swap: 'imagigen_swap',
  history: 'imagigen_history',
  collage: 'imagigen_collage',
  stories: 'imagigen_stories',
  settings: 'imagigen_settings',
};

export async function saveGalleryItem(category: GalleryCategory, item: GalleryItem) {
  const key = STORAGE_KEYS[category];
  const currentItems = await get(key) || [];
  const index = currentItems.findIndex((i: GalleryItem) => i.id === item.id);
  const updatedItems = [...currentItems];
  if (index >= 0) {
    updatedItems[index] = item;
  } else {
    updatedItems.push(item);
  }
  await set(key, updatedItems);
}

export async function getGalleryItems(category: GalleryCategory): Promise<GalleryItem[]> {
  return (await get(STORAGE_KEYS[category])) || [];
}

export async function deleteGalleryItem(category: GalleryCategory, id: string) {
  const key = STORAGE_KEYS[category];
  const items = await getGalleryItems(category);
  await set(key, items.filter(item => item.id !== id));
}

export async function saveStory(story: StoryItem) {
  const stories = await getStories();
  const index = stories.findIndex(s => s.id === story.id);
  if (index >= 0) {
    stories[index] = story;
  } else {
    stories.push(story);
  }
  await set(STORAGE_KEYS.stories, stories);
}

export async function deleteStory(id: string) {
  const stories = await getStories();
  await set(STORAGE_KEYS.stories, stories.filter(s => s.id !== id));
}

export async function getStories(): Promise<StoryItem[]> {
  return (await get(STORAGE_KEYS.stories)) || [];
}

export async function getSettings(): Promise<AppSettings> {
  const defaults: AppSettings = {
    language: 'es',
    numVariations: 1,
    autoAdjustPrompts: false,
    defaultGenerationLanguage: 'en',
    taskbarPosition: 'top',
    userPhotos: [],
    temperatureUnit: 'C',
    driveFolderPath: 'ImaginArt Studio',
    storyScenesCount: 4
  };
  const data = await get(STORAGE_KEYS.settings);
  return { ...defaults, ...(data || {}) };
}

export async function saveSettings(settings: AppSettings) {
  await set(STORAGE_KEYS.settings, settings);
  window.dispatchEvent(new Event('settingsChanged'));
}

export async function exportGallery() {
  const data = {
    generation: await getGalleryItems('generation'),
    analysis: await getGalleryItems('analysis'),
    swap: await getGalleryItems('swap'),
    history: await getGalleryItems('history'),
    collage: await getGalleryItems('collage'),
    stories: await getStories(),
    settings: await getSettings()
  };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `imagigen_export_${new Date().getTime()}.json`;
  a.click();
}

export async function importGallery(file: File): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        let importedSomething = false;
        
        const categories: GalleryCategory[] = ['generation', 'analysis', 'swap', 'history', 'collage'];
        for (const cat of categories) {
          if (data[cat] && Array.isArray(data[cat]) && data[cat].length > 0) {
            const currentItems = await getGalleryItems(cat);
            await set(STORAGE_KEYS[cat], [...currentItems, ...data[cat]]);
            importedSomething = true;
          }
        }
        
        if (data.stories && Array.isArray(data.stories) && data.stories.length > 0) {
          const currentStories = await getStories();
          await set(STORAGE_KEYS.stories, [...currentStories, ...data.stories]);
          importedSomething = true;
        }

        if (data.settings) {
          await set(STORAGE_KEYS.settings, data.settings);
          importedSomething = true;
        }
        
        resolve(importedSomething);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export async function clearAllData() {
  await clear();
}
