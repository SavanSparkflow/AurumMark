import React, { useState } from 'react';
import {
  Modal,
  Button,
  Badge,
} from './index.js';
import { Design } from '../../types/index.js';
import { resizerApi } from '../../api/index.js';
import {
  Instagram,
  Smartphone,
  ShoppingBag,
  Send,
  Download,
  Loader2,
  CheckSquare,
  Square,
  Sparkles,
  Archive,
  Layers,
  ShieldCheck,
  Check,
} from 'lucide-react';

interface MultiPlatformResizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  design?: Design | null;
  selectedDesigns?: Design[];
}

interface PresetCardInfo {
  key: string;
  name: string;
  dimensions: string;
  aspect: string;
  description: string;
  icon: React.ElementType;
  gradient: string;
  accentColor: string;
  badgeText: string;
}

const PRESETS: PresetCardInfo[] = [
  {
    key: 'instagram_post',
    name: 'Instagram Post',
    dimensions: '1080 × 1080 px',
    aspect: '1:1 Square',
    description: 'Perfect square framing for Instagram feed, multi-image carousels, and Facebook posts.',
    icon: Instagram,
    gradient: 'from-pink-500 via-rose-500 to-amber-500',
    accentColor: '#E1306C',
    badgeText: 'Social Feed',
  },
  {
    key: 'instagram_story',
    name: 'Story & Reels / WhatsApp Status',
    dimensions: '1080 × 1920 px',
    aspect: '9:16 Fullscreen',
    description: 'Tall 9:16 mobile canvas for Instagram Stories, Reels, TikTok, and WhatsApp Status.',
    icon: Smartphone,
    gradient: 'from-purple-600 to-indigo-600',
    accentColor: '#7C3AED',
    badgeText: 'Vertical 9:16',
  },
  {
    key: 'shopify_amazon',
    name: 'Shopify / Amazon / Website',
    dimensions: '2000 × 2000 px',
    aspect: '1:1 Studio Canvas',
    description: 'Compliant with Amazon standards: pure white background (#FFFFFF) with high-res zoom detail.',
    icon: ShoppingBag,
    gradient: 'from-emerald-600 to-teal-600',
    accentColor: '#059669',
    badgeText: 'E-Commerce Studio',
  },
  {
    key: 'whatsapp_optimized',
    name: 'WhatsApp Fast Share',
    dimensions: 'Max 1200 px',
    aspect: 'Lightweight MozJPEG',
    description: 'Ultra-compressed (<300KB) for lightning-fast sending on mobile networks without pixelation.',
    icon: Send,
    gradient: 'from-green-500 to-emerald-600',
    accentColor: '#25D366',
    badgeText: 'Fast Cellular',
  },
];

export const MultiPlatformResizeModal: React.FC<MultiPlatformResizeModalProps> = ({
  isOpen,
  onClose,
  design,
  selectedDesigns = [],
}) => {
  const isBatch = !design && selectedDesigns.length > 0;
  const targetDesigns = isBatch ? selectedDesigns : design ? [design] : [];

  const [selectedPresets, setSelectedPresets] = useState<string[]>([
    'instagram_post',
    'instagram_story',
    'shopify_amazon',
    'whatsapp_optimized',
  ]);
  const [useOriginal, setUseOriginal] = useState<boolean>(false);
  const [backgroundPreference, setBackgroundPreference] = useState<'white' | 'dark'>('white');
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);
  const [exportingSingleKey, setExportingSingleKey] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen || targetDesigns.length === 0) return null;

  const togglePreset = (key: string) => {
    setSelectedPresets((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleSelectAll = () => {
    if (selectedPresets.length === PRESETS.length) {
      setSelectedPresets([]);
    } else {
      setSelectedPresets(PRESETS.map((p) => p.key));
    }
  };

  // Helper to trigger browser download from a response Blob
  const triggerBlobDownload = (blob: Blob, fallbackFilename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fallbackFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  // Export single preset for single design
  const handleDownloadSingle = async (presetKey: string) => {
    if (!design) return;
    try {
      setExportingSingleKey(presetKey);
      setStatusMessage('Generating resized asset...');

      const response = await resizerApi.exportSingle({
        designId: design._id,
        presetKey,
        useOriginal,
        backgroundPreference,
      });

      const cleanSku = (design.sku || design.filename).replace(/\.[^/.]+$/, '');
      const filename = `${cleanSku}_${presetKey}.jpg`;
      triggerBlobDownload(new Blob([response.data], { type: 'image/jpeg' }), filename);
      setStatusMessage('Download complete!');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed to export single preset:', err);
      setStatusMessage('Error exporting image. Please try again.');
    } finally {
      setExportingSingleKey(null);
    }
  };

  // Export selected presets as ZIP
  const handleDownloadZip = async () => {
    if (selectedPresets.length === 0) return;

    try {
      setIsExportingZip(true);
      setStatusMessage(
        isBatch
          ? `Processing ${targetDesigns.length} designs across ${selectedPresets.length} presets...`
          : `Compiling ${selectedPresets.length} platform variants into ZIP pack...`
      );

      if (isBatch) {
        const response = await resizerApi.exportBatchBundle({
          designIds: targetDesigns.map((d) => d._id),
          presetKeys: selectedPresets,
          useOriginal,
          backgroundPreference,
        });

        triggerBlobDownload(
          new Blob([response.data], { type: 'application/zip' }),
          `aurummark_batch_platform_pack_${Date.now()}.zip`
        );
      } else {
        const response = await resizerApi.exportBundle({
          designId: design!._id,
          presetKeys: selectedPresets,
          useOriginal,
          backgroundPreference,
        });

        const cleanSku = (design!.sku || design!.filename).replace(/\.[^/.]+$/, '');
        triggerBlobDownload(
          new Blob([response.data], { type: 'application/zip' }),
          `${cleanSku}_platform_pack.zip`
        );
      }

      setStatusMessage('ZIP download complete!');
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err: any) {
      console.error('Failed to export platform ZIP:', err);
      let errMsg = 'Error creating ZIP bundle. Please try again.';
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          if (parsed.message) errMsg = parsed.message;
        } catch {}
      } else if (err.message) {
        errMsg = err.message;
      }
      setStatusMessage(errMsg);
    } finally {
      setIsExportingZip(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Multi-Platform Auto-Resizer"
      description="Generate ready-to-publish image sizes for Social Media & E-Commerce in 1-Click."
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6">
        {/* Top Info Banner */}
        <div className="bg-gradient-to-r from-purple-50 via-amber-50/50 to-white p-4 rounded-xl border border-purple-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#7C3AED] text-white flex items-center justify-center shrink-0 shadow-md">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-bold text-sm text-[#1E293B]">
                  {isBatch
                    ? `${targetDesigns.length} Jewellery Designs Selected`
                    : design?.sku
                    ? `SKU: ${design.sku}`
                    : design?.filename}
                </span>
                <Badge variant="purple" size="sm">
                  {isBatch ? 'Batch Resize' : 'Single Item'}
                </Badge>
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">
                Aspect ratios and margins are automatically calibrated so jewellery is never cropped.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <span className="text-[11px] font-semibold text-[#64748B]">Source:</span>
            <button
              type="button"
              onClick={() => setUseOriginal(false)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                !useOriginal
                  ? 'bg-[#7C3AED] text-white shadow-xs'
                  : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#1E293B]'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Watermarked</span>
            </button>
            <button
              type="button"
              onClick={() => setUseOriginal(true)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                useOriginal
                  ? 'bg-[#7C3AED] text-white shadow-xs'
                  : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#1E293B]'
              }`}
            >
              <span>Original Master</span>
            </button>
          </div>
        </div>

        {/* Options Row: Background & Selection Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border-b border-[#E2E8F0] pb-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#64748B]">Canvas Background:</span>
            <button
              type="button"
              onClick={() => setBackgroundPreference('white')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer border flex items-center gap-1.5 ${
                backgroundPreference === 'white'
                  ? 'bg-white border-amber-400 text-[#1E293B] shadow-xs font-bold'
                  : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B]'
              }`}
            >
              <div className="w-3 h-3 rounded-full bg-white border border-slate-300" />
              <span>Studio White (#FFFFFF)</span>
            </button>
            <button
              type="button"
              onClick={() => setBackgroundPreference('dark')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer border flex items-center gap-1.5 ${
                backgroundPreference === 'dark'
                  ? 'bg-[#0F172A] border-amber-400 text-white shadow-xs font-bold'
                  : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B]'
              }`}
            >
              <div className="w-3 h-3 rounded-full bg-[#0F172A] border border-slate-600" />
              <span>Midnight Dark (#0F172A)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-[#7C3AED] hover:text-[#6D28D9] font-semibold cursor-pointer flex items-center gap-1"
            >
              {selectedPresets.length === PRESETS.length ? (
                <>
                  <CheckSquare className="w-4 h-4" />
                  <span>Deselect All</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4" />
                  <span>Select All Presets</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 4 Presets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {PRESETS.map((p) => {
            const Icon = p.icon;
            const isSelected = selectedPresets.includes(p.key);
            const isDownloadingThis = exportingSingleKey === p.key;

            return (
              <div
                key={p.key}
                className={`relative rounded-xl border p-4 transition flex flex-col justify-between ${
                  isSelected
                    ? 'border-[#7C3AED] bg-purple-50/20 shadow-xs'
                    : 'border-[#E2E8F0] bg-white hover:border-slate-300'
                }`}
              >
                <div>
                  {/* Top Bar of Card */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center text-white shadow-sm bg-gradient-to-br ${p.gradient}`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-heading font-bold text-sm text-[#1E293B]">
                          {p.name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-xs font-bold text-[#7C3AED]">
                            {p.dimensions}
                          </span>
                          <span className="text-[10px] text-[#94A3B8]">•</span>
                          <span className="text-[10px] text-[#64748B] font-medium">
                            {p.aspect}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Selection Checkbox */}
                    <button
                      type="button"
                      onClick={() => togglePreset(p.key)}
                      className="cursor-pointer p-1 text-[#64748B] hover:text-[#7C3AED] transition"
                      title={isSelected ? 'Included in bundle' : 'Click to include in bundle'}
                    >
                      {isSelected ? (
                        <div className="w-5 h-5 rounded bg-[#7C3AED] text-white flex items-center justify-center">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded border border-[#CBD5E1] bg-white hover:border-[#7C3AED]" />
                      )}
                    </button>
                  </div>

                  <p className="text-xs text-[#64748B] leading-relaxed mb-3">
                    {p.description}
                  </p>
                </div>

                {/* Card Action Row */}
                <div className="pt-2 border-t border-[#E2E8F0]/70 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                    {p.badgeText}
                  </span>

                  {!isBatch && design && (
                    <button
                      type="button"
                      disabled={isDownloadingThis || isExportingZip}
                      onClick={() => handleDownloadSingle(p.key)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#7C3AED] hover:text-[#6D28D9] disabled:opacity-50 cursor-pointer p-1 hover:bg-purple-50 rounded transition"
                      title={`Download ${p.name}`}
                    >
                      {isDownloadingThis ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Downloading...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>Download Image</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Status Notification if any */}
        {statusMessage && (
          <div className="p-3 bg-purple-50 border border-purple-200 text-[#7C3AED] rounded-lg text-xs font-medium flex items-center gap-2 animate-in fade-in">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Footer Action Bar */}
        <div className="pt-4 border-t border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-[#64748B]">
            <span className="font-bold text-[#1E293B]">{selectedPresets.length} of {PRESETS.length}</span>{' '}
            presets selected for ZIP bundle
          </div>

          <div className="flex items-center gap-2.5">
            <Button variant="outline" size="sm" onClick={onClose} disabled={isExportingZip}>
              Cancel
            </Button>

            <Button
              variant="primary"
              size="sm"
              disabled={selectedPresets.length === 0 || isExportingZip}
              onClick={handleDownloadZip}
              className="bg-gradient-to-r from-[#7C3AED] to-[#D4AF37] hover:from-[#6D28D9] hover:to-[#B8860B] text-white font-semibold"
            >
              {isExportingZip ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  <span>Building Platform ZIP...</span>
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4 mr-1.5" />
                  <span>
                    Download All Selected as ZIP ({selectedPresets.length * (isBatch ? targetDesigns.length : 1)} files)
                  </span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

