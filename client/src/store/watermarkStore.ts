import { create } from 'zustand';
import {
  WatermarkConfiguration,
  PositionPreset,
  Asset,
  WatermarkFontFamily,
} from '../types/index.js';

export interface WatermarkFontOption {
  value: WatermarkFontFamily;
  label: string;
  category: 'Sans' | 'Serif' | 'Script';
  tag: string;
  description: string;
  fontFamilyCss: string;
}

/**
 * 7 Curated Watermark Font Families for Haute Joaillerie & Luxury Jewellery:
 * - Outfit (Luxury Sans)
 * - Poppins (Modern Geometric)
 * - Cinzel (Royal Luxury Serif) - [NEW]
 * - Playfair Display (Haute Joaillerie Serif) - [NEW]
 * - Montserrat (Classic Premium Sans) - [NEW]
 * - Cormorant Garamond (Artisan Heritage Serif) - [NEW]
 * - Great Vibes (Artisan Script Calligraphy) - [NEW]
 */
export const WATERMARK_FONT_OPTIONS: WatermarkFontOption[] = [
  // --- Modern & Luxury Sans-Serif ---
  {
    value: 'Outfit',
    label: 'Outfit (Luxury Sans)',
    category: 'Sans',
    tag: 'Modern Sans',
    description: 'Clean modern luxury geometric sans, ideal for contemporary jewellery',
    fontFamilyCss: "'Outfit', sans-serif",
  },
  {
    value: 'Poppins',
    label: 'Poppins (Modern Geometric)',
    category: 'Sans',
    tag: 'Geometric',
    description: 'Balanced modern geometric sans with high legibility across resolutions',
    fontFamilyCss: "'Poppins', sans-serif",
  },
  {
    value: 'Montserrat',
    label: 'Montserrat (Classic Premium Sans)',
    category: 'Sans',
    tag: 'Caps Minimal',
    description: 'Crisp architectural uppercase typography with superior clarity',
    fontFamilyCss: "'Montserrat', sans-serif",
  },

  // --- Royal & Heritage Luxury Serif ---
  {
    value: 'Cinzel',
    label: 'Cinzel (Royal Luxury Serif)',
    category: 'Serif',
    tag: 'Royal Luxury',
    description: 'Classical Roman inscriptional serif, gold standard for royal & luxury goldsmiths',
    fontFamilyCss: "'Cinzel', serif",
  },
  {
    value: 'Playfair Display',
    label: 'Playfair Display (Haute Joaillerie)',
    category: 'Serif',
    tag: 'Haute Joaillerie',
    description: 'High-contrast editorial serif, exquisite for diamonds & bridal collections',
    fontFamilyCss: "'Playfair Display', serif",
  },
  {
    value: 'Cormorant Garamond',
    label: 'Cormorant Garamond (Artisan Heritage)',
    category: 'Serif',
    tag: 'Heritage',
    description: 'Delicate, graceful vintage serif evoking fine European atelier craftsmanship',
    fontFamilyCss: "'Cormorant Garamond', serif",
  },

  // --- Artisan Designer Signature Script ---
  {
    value: 'Great Vibes',
    label: 'Great Vibes (Artisan Script Calligraphy)',
    category: 'Script',
    tag: 'Signature Script',
    description: 'Flowing handcrafted designer signature for bespoke atelier pieces',
    fontFamilyCss: "'Great Vibes', cursive",
  },
];

export const DEFAULT_WATERMARK_CONFIG: WatermarkConfiguration = {
  watermarkType: 'text',
  positionPreset: 'bottom-right',
  scalingPolicy: 'relative',
  marginPercent: 0.04,
  textConfig: {
    enabled: true,
    text: 'AURUM JEWELLERY',
    fontFamily: 'Outfit',
    fontSizeRatio: 0.045,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.85,
    rotation: 0,
    letterSpacing: 2,
    alignment: 'center',
    normalizedX: 0.82,
    normalizedY: 0.9,
    shadow: {
      color: 'rgba(0,0,0,0.4)',
      blur: 4,
      offsetX: 2,
      offsetY: 2,
    },
    stroke: {
      color: '#000000',
      width: 0,
    },
  },
  logoConfig: {
    enabled: false,
    logoAssetId: null,
    logoUrl: '',
    scaleRatio: 0.15,
    opacity: 0.85,
    rotation: 0,
    normalizedX: 0.85,
    normalizedY: 0.85,
  },
  tiledConfig: {
    enabled: false,
    text: 'AURUM JEWELS',
    fontFamily: 'Outfit',
    fontSizeRatio: 0.03,
    opacity: 0.18,
    angle: -30,
    spacingX: 160,
    spacingY: 120,
    color: '#FFFFFF',
  },
};

interface WatermarkState {
  config: WatermarkConfiguration;
  referenceImage: Asset | null;
  sampleImages: Asset[];
  zoom: number;
  history: WatermarkConfiguration[];
  historyIndex: number;

  setConfig: (config: WatermarkConfiguration) => void;
  updateTextConfig: (partial: Partial<WatermarkConfiguration['textConfig']>) => void;
  updateLogoConfig: (partial: Partial<WatermarkConfiguration['logoConfig']>) => void;
  updateTiledConfig: (partial: Partial<WatermarkConfiguration['tiledConfig']>) => void;
  setPositionPreset: (preset: PositionPreset) => void;
  setNormalizedPosition: (x: number, y: number) => void;
  setReferenceImage: (asset: Asset | null) => void;
  setSampleImages: (assets: Asset[]) => void;
  setZoom: (zoom: number) => void;
  undo: () => void;
  redo: () => void;
  resetConfig: () => void;
}

export const useWatermarkStore = create<WatermarkState>((set, get) => ({
  config: DEFAULT_WATERMARK_CONFIG,
  referenceImage: null,
  sampleImages: [],
  zoom: 1,
  history: [DEFAULT_WATERMARK_CONFIG],
  historyIndex: 0,

  setConfig: (config) => {
    const { history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    set({
      config,
      history: [...newHistory, config],
      historyIndex: newHistory.length,
    });
  },

  updateTextConfig: (partial) => {
    const current = get().config;
    const updated: WatermarkConfiguration = {
      ...current,
      textConfig: { ...current.textConfig, ...partial },
    };
    get().setConfig(updated);
  },

  updateLogoConfig: (partial) => {
    const current = get().config;
    const updated: WatermarkConfiguration = {
      ...current,
      logoConfig: { ...current.logoConfig, ...partial },
    };
    get().setConfig(updated);
  },

  updateTiledConfig: (partial) => {
    const current = get().config;
    const updated: WatermarkConfiguration = {
      ...current,
      tiledConfig: { ...current.tiledConfig, ...partial },
    };
    get().setConfig(updated);
  },

  setPositionPreset: (preset: PositionPreset) => {
    const current = get().config;
    let normX = 0.5;
    let normY = 0.5;

    switch (preset) {
      case 'top-left':
        normX = 0.15;
        normY = 0.12;
        break;
      case 'top-center':
        normX = 0.5;
        normY = 0.12;
        break;
      case 'top-right':
        normX = 0.85;
        normY = 0.12;
        break;
      case 'center-left':
        normX = 0.15;
        normY = 0.5;
        break;
      case 'center':
        normX = 0.5;
        normY = 0.5;
        break;
      case 'center-right':
        normX = 0.85;
        normY = 0.5;
        break;
      case 'bottom-left':
        normX = 0.15;
        normY = 0.88;
        break;
      case 'bottom-center':
        normX = 0.5;
        normY = 0.88;
        break;
      case 'bottom-right':
        normX = 0.85;
        normY = 0.88;
        break;
      default:
        break;
    }

    const updated: WatermarkConfiguration = {
      ...current,
      positionPreset: preset,
      textConfig: { ...current.textConfig, normalizedX: normX, normalizedY: normY },
      logoConfig: { ...current.logoConfig, normalizedX: normX, normalizedY: normY },
    };

    get().setConfig(updated);
  },

  setNormalizedPosition: (x: number, y: number) => {
    const current = get().config;
    const updated: WatermarkConfiguration = {
      ...current,
      positionPreset: 'custom',
      textConfig: { ...current.textConfig, normalizedX: x, normalizedY: y },
      logoConfig: { ...current.logoConfig, normalizedX: x, normalizedY: y },
    };
    get().setConfig(updated);
  },

  setReferenceImage: (asset) => set({ referenceImage: asset }),
  setSampleImages: (assets) => set({ sampleImages: assets }),
  setZoom: (zoom) => set({ zoom }),

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      set({ config: history[newIndex], historyIndex: newIndex });
    }
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      set({ config: history[newIndex], historyIndex: newIndex });
    }
  },

  resetConfig: () => {
    set({
      config: DEFAULT_WATERMARK_CONFIG,
      history: [DEFAULT_WATERMARK_CONFIG],
      historyIndex: 0,
    });
  },
}));
