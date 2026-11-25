import React from 'react';
import { useWatermarkStore, WATERMARK_FONT_OPTIONS } from '../../store/watermarkStore.js';
import { Type, AlignLeft, AlignCenter, AlignRight, Sliders, Sun } from 'lucide-react';

export const TextSettings: React.FC = () => {
  const { config, updateTextConfig } = useWatermarkStore();
  const textConfig = config.textConfig;

  return (
    <div className="space-y-4">
      {/* Enable toggle */}
      <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
        <label className="text-xs font-semibold text-[#1E293B] font-heading flex items-center gap-1.5">
          <Type className="w-3.5 h-3.5 text-[#7C3AED]" />
          Text Watermark
        </label>
        <input
          type="checkbox"
          checked={textConfig.enabled}
          onChange={(e) => updateTextConfig({ enabled: e.target.checked })}
          className="w-4 h-4 rounded text-[#7C3AED] focus:ring-[#7C3AED] border-[#E2E8F0]"
        />
      </div>

      {textConfig.enabled && (
        <div className="space-y-3.5">
          {/* Watermark Text Input */}
          <div>
            <label className="text-xs font-semibold text-[#64748B] block mb-1">
              Watermark Text
            </label>
            <input
              type="text"
              value={textConfig.text}
              onChange={(e) => updateTextConfig({ text: e.target.value })}
              placeholder="e.g. AURUM JEWELLERY"
              className="w-full px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#1E293B] focus:outline-none focus:border-[#7C3AED]"
            />
          </div>

          {/* Typography: Curated Luxury Jewellery Font Families */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-[#64748B] block mb-1">
                Font Family
              </label>
              <select
                value={textConfig.fontFamily}
                onChange={(e) => updateTextConfig({ fontFamily: e.target.value as any })}
                className="w-full px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#1E293B] focus:outline-none focus:border-[#7C3AED]"
              >
                <optgroup label="✨ Luxury & Modern Sans">
                  {WATERMARK_FONT_OPTIONS.filter((f) => f.category === 'Sans').map((font) => (
                    <option key={font.value} value={font.value}>
                      {font.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="👑 Royal & Haute Joaillerie Serif">
                  {WATERMARK_FONT_OPTIONS.filter((f) => f.category === 'Serif').map((font) => (
                    <option key={font.value} value={font.value}>
                      {font.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="✒️ Artisan Signature Script">
                  {WATERMARK_FONT_OPTIONS.filter((f) => f.category === 'Script').map((font) => (
                    <option key={font.value} value={font.value}>
                      {font.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#64748B] block mb-1">
                Weight
              </label>
              <select
                value={textConfig.fontWeight}
                onChange={(e) => updateTextConfig({ fontWeight: e.target.value as any })}
                className="w-full px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#1E293B] focus:outline-none focus:border-[#7C3AED]"
              >
                <option value="400">Regular (400)</option>
                <option value="500">Medium (500)</option>
                <option value="600">SemiBold (600)</option>
                <option value="700">Bold (700)</option>
                <option value="800">ExtraBold (800)</option>
              </select>
            </div>
          </div>

          {/* Active Font Description & Visual Live Sample */}
          {(() => {
            const activeFont = WATERMARK_FONT_OPTIONS.find((f) => f.value === textConfig.fontFamily);
            if (!activeFont) return null;
            return (
              <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] text-[11px]">
                <span className="font-semibold text-[#7C3AED] flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED]" />
                  {activeFont.tag}
                </span>
                <span
                  className="truncate ml-2 text-right text-[#1E293B] font-medium"
                  style={{ fontFamily: activeFont.fontFamilyCss }}
                  title={activeFont.description}
                >
                  {textConfig.text || 'AURUM JEWELLERY'}
                </span>
              </div>
            );
          })()}

          {/* Color & Opacity */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-[#64748B] block mb-1">
                Text Color
              </label>
              <div className="flex items-center gap-2 border border-[#E2E8F0] rounded-lg px-2 py-1 bg-white">
                <input
                  type="color"
                  value={textConfig.color.startsWith('#') ? textConfig.color : '#FFFFFF'}
                  onChange={(e) => updateTextConfig({ color: e.target.value })}
                  className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                />
                <span className="text-xs font-mono font-medium text-[#1E293B]">
                  {textConfig.color}
                </span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-[#64748B] mb-1">
                <span>Opacity</span>
                <span>{Math.round(textConfig.opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={textConfig.opacity}
                onChange={(e) => updateTextConfig({ opacity: parseFloat(e.target.value) })}
                className="w-full accent-[#7C3AED]"
              />
            </div>
          </div>

          {/* Size & Rotation */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex justify-between text-xs font-semibold text-[#64748B] mb-1">
                <span>Size Ratio</span>
                <span>{Math.round(textConfig.fontSizeRatio * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.02"
                max="0.1"
                step="0.005"
                value={textConfig.fontSizeRatio}
                onChange={(e) => updateTextConfig({ fontSizeRatio: parseFloat(e.target.value) })}
                className="w-full accent-[#7C3AED]"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-[#64748B] mb-1">
                <span>Rotation</span>
                <span>{textConfig.rotation}°</span>
              </div>
              <input
                type="range"
                min="-180"
                max="180"
                step="5"
                value={textConfig.rotation}
                onChange={(e) => updateTextConfig({ rotation: parseInt(e.target.value, 10) })}
                className="w-full accent-[#7C3AED]"
              />
            </div>
          </div>

          {/* Letter Spacing & Alignment */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex justify-between text-xs font-semibold text-[#64748B] mb-1">
                <span>Letter Spacing</span>
                <span>{textConfig.letterSpacing}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={textConfig.letterSpacing}
                onChange={(e) => updateTextConfig({ letterSpacing: parseInt(e.target.value, 10) })}
                className="w-full accent-[#7C3AED]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#64748B] block mb-1">
                Alignment
              </label>
              <div className="flex items-center gap-1 border border-[#E2E8F0] p-1 rounded-lg bg-white">
                {(['left', 'center', 'right'] as const).map((align) => (
                  <button
                    key={align}
                    onClick={() => updateTextConfig({ alignment: align })}
                    className={`flex-1 py-1 rounded flex items-center justify-center transition ${
                      textConfig.alignment === align
                        ? 'bg-[#7C3AED] text-white'
                        : 'text-[#64748B] hover:text-[#1E293B]'
                    }`}
                  >
                    {align === 'left' && <AlignLeft className="w-3.5 h-3.5" />}
                    {align === 'center' && <AlignCenter className="w-3.5 h-3.5" />}
                    {align === 'right' && <AlignRight className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Drop Shadow Contrast Panel */}
          {(() => {
            const parseShadowColor = (colorStr: string = 'rgba(0,0,0,0.75)') => {
              const match = colorStr.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
              if (match) {
                const r = parseInt(match[1], 10);
                const g = parseInt(match[2], 10);
                const b = parseInt(match[3], 10);
                const a = match[4] !== undefined ? parseFloat(match[4]) : 0.75;
                const hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
                return { hex, opacity: a, r, g, b };
              }
              if (colorStr.startsWith('#')) {
                const hex = colorStr.slice(0, 7);
                const r = parseInt(hex.slice(1, 3), 16) || 0;
                const g = parseInt(hex.slice(3, 5), 16) || 0;
                const b = parseInt(hex.slice(5, 7), 16) || 0;
                return { hex, opacity: 0.75, r, g, b };
              }
              return { hex: '#000000', opacity: 0.75, r: 0, g: 0, b: 0 };
            };

            const currentShadow = parseShadowColor(textConfig.shadow?.color);

            return (
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]/70 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-[#1E293B] block">Drop Shadow Contrast</span>
                    <span className="text-[10px] text-[#64748B]">Enhances watermark legibility against bright diamond & metal highlights</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!textConfig.shadow}
                    onChange={(e) =>
                      updateTextConfig({
                        shadow: e.target.checked
                          ? { color: 'rgba(0,0,0,0.75)', blur: 4, offsetX: 2, offsetY: 2 }
                          : undefined,
                      })
                    }
                    className="w-4 h-4 rounded text-[#7C3AED] focus:ring-[#7C3AED] border-[#E2E8F0]"
                  />
                </div>

                {textConfig.shadow && (
                  <div className="pt-2 border-t border-[#E2E8F0] space-y-3">
                    {/* Tone Preset Buttons */}
                    <div>
                      <div className="text-[11px] font-semibold text-[#64748B] mb-1.5 flex items-center justify-between">
                        <span>Shadow Tone</span>
                        <span className="text-[10px] font-mono text-[#7C3AED] font-semibold">
                          {currentShadow.hex.toUpperCase()} • {Math.round(currentShadow.opacity * 100)}%
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { label: 'Dark Contrast', hex: '#000000', r: 0, g: 0, b: 0 },
                          { label: 'White Halo', hex: '#FFFFFF', r: 255, g: 255, b: 255 },
                          { label: 'Royal Gold', hex: '#B8860B', r: 184, g: 134, b: 11 },
                        ].map((preset) => {
                          const isSelected = currentShadow.hex.toLowerCase() === preset.hex.toLowerCase();
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => {
                                updateTextConfig({
                                  shadow: {
                                    ...textConfig.shadow!,
                                    color: `rgba(${preset.r},${preset.g},${preset.b},${currentShadow.opacity})`,
                                  },
                                });
                              }}
                              className={`px-2 py-1.5 rounded-lg text-[10px] font-semibold border flex items-center justify-center gap-1.5 transition ${
                                isSelected
                                  ? 'bg-[#7C3AED]/10 text-[#7C3AED] border-[#7C3AED] font-bold shadow-xs'
                                  : 'bg-white text-[#64748B] border-[#E2E8F0] hover:bg-[#F8FAFC]'
                              }`}
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-black/15 shrink-0"
                                style={{ backgroundColor: preset.hex }}
                              />
                              <span>{preset.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Contrast Intensity (Opacity) & Softness (Blur) */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="flex justify-between text-[11px] font-semibold text-[#64748B] mb-1">
                          <span>Contrast Level</span>
                          <span className="text-[#1E293B] font-bold">{Math.round(currentShadow.opacity * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.2"
                          max="1.0"
                          step="0.05"
                          value={currentShadow.opacity}
                          onChange={(e) => {
                            const newOpacity = parseFloat(e.target.value);
                            updateTextConfig({
                              shadow: {
                                ...textConfig.shadow!,
                                color: `rgba(${currentShadow.r},${currentShadow.g},${currentShadow.b},${newOpacity})`,
                              },
                            });
                          }}
                          className="w-full accent-[#7C3AED]"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] font-semibold text-[#64748B] mb-1">
                          <span>Softness (Blur)</span>
                          <span className="text-[#1E293B] font-bold">{textConfig.shadow.blur ?? 4}px</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="12"
                          step="1"
                          value={textConfig.shadow.blur ?? 4}
                          onChange={(e) =>
                            updateTextConfig({
                              shadow: {
                                ...textConfig.shadow!,
                                blur: parseInt(e.target.value, 10),
                              },
                            })
                          }
                          className="w-full accent-[#7C3AED]"
                        />
                      </div>
                    </div>

                    {/* Shadow Distance */}
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-[#64748B] mb-1">
                        <span>Shadow Distance</span>
                        <span className="text-[#1E293B] font-bold">{textConfig.shadow.offsetX ?? 2}px</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="8"
                        step="1"
                        value={textConfig.shadow.offsetX ?? 2}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          updateTextConfig({
                            shadow: {
                              ...textConfig.shadow!,
                              offsetX: val,
                              offsetY: val,
                            },
                          });
                        }}
                        className="w-full accent-[#7C3AED]"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
