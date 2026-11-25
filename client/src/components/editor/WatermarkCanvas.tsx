import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Text as KonvaText, Group } from 'react-konva';
import useImage from 'use-image';
import { useWatermarkStore } from '../../store/watermarkStore.js';
import { assetsApi } from '../../api/index.js';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  SplitSquareVertical,
  Image as ImageIcon,
  Play,
  Pause,
  Repeat,
  Volume2,
  VolumeX,
  RotateCcw,
  Gauge,
  Film,
} from 'lucide-react';
import { Design } from '../../types/index.js';

interface WatermarkCanvasProps {
  canvasWidth?: number;
  canvasHeight?: number;
  designs?: Design[];
}

export const WatermarkCanvas: React.FC<WatermarkCanvasProps> = ({ designs = [] }) => {
  const { config, referenceImage, setReferenceImage, setNormalizedPosition, zoom, setZoom } =
    useWatermarkStore();
  const [showBeforeAfter, setShowBeforeAfter] = useState(false);

  // Match current design from catalogue
  const currentDesign = designs.find((d) => {
    const origId =
      typeof d.originalAssetId === 'string' ? d.originalAssetId : d.originalAssetId?._id;
    return origId === referenceImage?._id;
  });

  const isVideo =
    currentDesign?.mediaType === 'video' ||
    referenceImage?.mimeType?.startsWith('video/') ||
    false;

  // Media URL (image or video)
  const mediaUrl = referenceImage ? assetsApi.getViewUrl(referenceImage) : '';

  // Use hook only for static images; videos use HTML5 <video>
  const [image] = useImage(!isVideo && mediaUrl ? mediaUrl : '', 'anonymous');

  // Video playback states
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(
    null
  );
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(true);
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [isVideoMuted, setIsVideoMuted] = useState<boolean>(true);
  const [videoSpeed, setVideoSpeed] = useState<number>(1.0);

  // Logo image URL if enabled
  const logoUrl =
    config.logoConfig?.logoUrl ||
    (config.logoConfig?.logoAssetId ? assetsApi.getViewUrl(config.logoConfig.logoAssetId) : '');

  const [logoImg] = useImage(logoUrl, 'anonymous');

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 700, height: 500 });
  const textRef = useRef<any>(null);

  // Measure container dimensions
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: Math.max(260, Math.floor(entry.contentRect.width)),
          height: Math.max(260, Math.floor(entry.contentRect.height)),
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Update video playback speed
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = videoSpeed;
    }
  }, [videoSpeed]);

  // Compute media placement within canvas to maintain aspect ratio
  const mediaWidth = isVideo
    ? videoDimensions?.width || currentDesign?.metadata?.width || 1200
    : image?.width || 1200;
  const mediaHeight = isVideo
    ? videoDimensions?.height || currentDesign?.metadata?.height || 900
    : image?.height || 900;
  const mediaAspect = mediaWidth / mediaHeight;
  const containerAspect = containerSize.width / containerSize.height;

  let renderWidth = containerSize.width;
  let renderHeight = containerSize.height;

  if (containerAspect > mediaAspect) {
    renderHeight = containerSize.height;
    renderWidth = renderHeight * mediaAspect;
  } else {
    renderWidth = containerSize.width;
    renderHeight = renderWidth / mediaAspect;
  }

  // Position offset to center the jewellery item in the canvas
  const offsetX = (containerSize.width - renderWidth) / 2;
  const offsetY = (containerSize.height - renderHeight) / 2;

  // Calculate text placement from normalized coordinates
  const textNormX = config.textConfig?.normalizedX ?? 0.82;
  const textNormY = config.textConfig?.normalizedY ?? 0.9;
  const textCanvasX = offsetX + renderWidth * textNormX;
  const textCanvasY = offsetY + renderHeight * textNormY;
  const textFontSize = Math.max(
    12,
    Math.round(renderHeight * (config.textConfig?.fontSizeRatio || 0.045))
  );

  // Calculate logo placement
  const logoNormX = config.logoConfig?.normalizedX ?? 0.85;
  const logoNormY = config.logoConfig?.normalizedY ?? 0.85;
  const logoScale = config.logoConfig?.scaleRatio || 0.15;
  const logoTargetW = Math.max(30, renderWidth * logoScale);
  const logoTargetH = logoImg
    ? (logoTargetW / (logoImg.width || 1)) * (logoImg.height || 1)
    : logoTargetW;
  const logoCanvasX = offsetX + renderWidth * logoNormX - logoTargetW / 2;
  const logoCanvasY = offsetY + renderHeight * logoNormY - logoTargetH / 2;

  // Handle Dragging
  const handleTextDragEnd = (e: any) => {
    const node = e.target;
    const newCanvasX = node.x();
    const newCanvasY = node.y();

    const normX = Math.max(0.02, Math.min(0.98, (newCanvasX - offsetX) / renderWidth));
    const normY = Math.max(0.02, Math.min(0.98, (newCanvasY - offsetY) / renderHeight));

    setNormalizedPosition(Number(normX.toFixed(3)), Number(normY.toFixed(3)));
  };

  const handleLogoDragEnd = (e: any) => {
    const node = e.target;
    const newCanvasX = node.x() + logoTargetW / 2;
    const newCanvasY = node.y() + logoTargetH / 2;

    const normX = Math.max(0.02, Math.min(0.98, (newCanvasX - offsetX) / renderWidth));
    const normY = Math.max(0.02, Math.min(0.98, (newCanvasY - offsetY) / renderHeight));

    setNormalizedPosition(Number(normX.toFixed(3)), Number(normY.toFixed(3)));
  };

  // Video play/pause toggle
  const toggleVideoPlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) {
      video.play().then(() => setIsVideoPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsVideoPlaying(false);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
      {/* Editor Top Toolbar */}
      <div className="h-12 border-b border-[#E2E8F0] px-4 flex items-center justify-between bg-[#F8FAFC] flex-shrink-0">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#64748B] font-heading">
          <span
            className={`w-2 h-2 rounded-full ${
              referenceImage ? (isVideo ? 'bg-purple-600 animate-pulse' : 'bg-[#7C3AED]') : 'bg-[#94A3B8]'
            }`}
          />
          {isVideo ? (
            <span className="flex items-center gap-1.5 text-purple-700 font-bold">
              <Film className="w-3.5 h-3.5" />
              Live 360° Video Preview
            </span>
          ) : (
            <span>Visual Canvas Parity</span>
          )}

          <span className="text-[11px] font-normal text-[#64748B] bg-white px-2 py-0.5 rounded border border-[#E2E8F0]">
            {referenceImage
              ? `Normalized: (${textNormX.toFixed(2)}, ${textNormY.toFixed(2)})`
              : 'No Media Selected'}
          </span>

          {isVideo && videoDuration > 0 && (
            <span className="text-[10px] font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 hidden sm:inline-flex items-center gap-1">
              <span>{Math.round(videoDuration)}s Duration</span>
              {videoDimensions && (
                <span>• {videoDimensions.width}x{videoDimensions.height}</span>
              )}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Before/After Toggle */}
          <button
            onClick={() => setShowBeforeAfter(!showBeforeAfter)}
            className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              showBeforeAfter
                ? 'bg-[#7C3AED] text-white'
                : 'bg-white text-[#64748B] border border-[#E2E8F0] hover:bg-[#F1F5F9]'
            }`}
            title="Toggle watermark overlay visibility to compare with master"
          >
            <SplitSquareVertical className="w-3.5 h-3.5" />
            Compare
          </button>

          {/* Zoom controls */}
          <div className="flex items-center border border-[#E2E8F0] rounded-lg bg-white overflow-hidden text-xs">
            <button
              onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
              className="p-1 hover:bg-[#F1F5F9] text-[#64748B] cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 py-0.5 text-[11px] font-semibold text-[#1E293B]">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(Math.min(2.0, zoom + 0.1))}
              className="p-1 hover:bg-[#F1F5F9] text-[#64748B] cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(1.0)}
              className="p-1 border-l border-[#E2E8F0] hover:bg-[#F1F5F9] text-[#64748B] cursor-pointer"
              title="Fit to Screen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas Viewport or Empty State */}
      {!referenceImage ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-[#F8FAFC] select-none">
          <div className="w-14 h-14 rounded-2xl bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center mb-3 border border-[#7C3AED]/20 shadow-xs">
            <ImageIcon className="w-7 h-7 text-[#7C3AED]" />
          </div>
          <h3 className="text-base font-bold text-[#1E293B] font-heading mb-1">
            No Reference Media Selected
          </h3>
          <p className="text-xs text-[#64748B] max-w-sm mb-4">
            Select a jewellery master photo or 360° video from the catalogue below:
          </p>

          {designs && designs.length > 0 ? (
            <div className="w-full max-w-md bg-white p-3 rounded-xl border border-[#E2E8F0] shadow-xs">
              <div className="text-[11px] font-semibold text-[#64748B] mb-2 text-left flex items-center justify-between">
                <span>Select from catalogue ({designs.length} available):</span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-36 overflow-y-auto p-1">
                {designs.slice(0, 12).map((d) => {
                  const isItemVideo = d.mediaType === 'video';
                  const thumb =
                    isItemVideo && d.thumbnailAssetId
                      ? assetsApi.getViewUrl(d.thumbnailAssetId)
                      : assetsApi.getViewUrl(d.originalAssetId);

                  return (
                    <button
                      key={d._id}
                      type="button"
                      onClick={() => {
                        if (d.originalAssetId) {
                          setReferenceImage(d.originalAssetId);
                        }
                      }}
                      className="group relative aspect-square rounded-lg border border-[#E2E8F0] hover:border-[#7C3AED] hover:ring-2 hover:ring-[#7C3AED]/20 overflow-hidden bg-[#F1F5F9] transition p-1 cursor-pointer flex items-center justify-center"
                      title={`${d.filename}${isItemVideo ? ' (Video Showcase)' : ''}`}
                    >
                      {isItemVideo ? (
                        d.thumbnailAssetId ? (
                          <img
                            src={thumb}
                            alt={d.filename}
                            className="w-full h-full object-cover rounded"
                          />
                        ) : (
                          <video
                            src={assetsApi.getViewUrl(d.originalAssetId)}
                            muted
                            className="w-full h-full object-cover rounded pointer-events-none"
                          />
                        )
                      ) : thumb ? (
                        <img
                          src={thumb}
                          alt={d.filename}
                          className="w-full h-full object-cover rounded"
                        />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-[#94A3B8]" />
                      )}

                      {/* Video indicator badge */}
                      {isItemVideo && (
                        <div className="absolute bottom-1 left-1 bg-black/80 text-white text-[8px] font-bold px-1 py-0.5 rounded flex items-center gap-0.5 pointer-events-none shadow-xs">
                          <Play className="w-2 h-2 fill-white" />
                          <span>VID</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-xs text-[#64748B] bg-white px-4 py-2.5 rounded-xl border border-[#E2E8F0]">
              No jewellery media found in your workspace catalogue.
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 relative">
          {/* Main Visual Workspace Area */}
          <div
            ref={containerRef}
            className="flex-1 relative flex items-center justify-center bg-[#F1F5F9]/60 overflow-hidden cursor-crosshair select-none"
          >
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
                transition: 'transform 0.15s ease-out',
                width: containerSize.width,
                height: containerSize.height,
              }}
              className="relative flex items-center justify-center"
            >
              {/* Background Video Element (Rendered under transparent Konva Stage) */}
              {isVideo && mediaUrl && (
                <div
                  style={{
                    position: 'absolute',
                    left: offsetX,
                    top: offsetY,
                    width: renderWidth,
                    height: renderHeight,
                  }}
                  className="overflow-hidden rounded-lg shadow-md bg-black pointer-events-none z-0"
                >
                  <video
                    ref={videoRef}
                    src={mediaUrl}
                    poster={
                      currentDesign?.thumbnailAssetId
                        ? assetsApi.getViewUrl(currentDesign.thumbnailAssetId)
                        : undefined
                    }
                    playsInline
                    loop={isLooping}
                    muted={isVideoMuted}
                    autoPlay
                    onTimeUpdate={() => {
                      if (videoRef.current) setVideoCurrentTime(videoRef.current.currentTime);
                    }}
                    onLoadedMetadata={(e) => {
                      const v = e.currentTarget;
                      setVideoDuration(v.duration || 0);
                      if (v.videoWidth && v.videoHeight) {
                        setVideoDimensions({ width: v.videoWidth, height: v.videoHeight });
                      }
                    }}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              {/* Konva Stage for Interactive Watermark Drag & Position */}
              <Stage
                width={containerSize.width}
                height={containerSize.height}
                className={`rounded-lg overflow-hidden z-10 ${
                  isVideo ? 'bg-transparent' : 'shadow-md rounded-lg bg-white'
                }`}
              >
                {/* Base Jewellery Image (Only for static images; video renders in HTML5 element) */}
                {!isVideo && (
                  <Layer>
                    {image && (
                      <KonvaImage
                        image={image}
                        x={offsetX}
                        y={offsetY}
                        width={renderWidth}
                        height={renderHeight}
                      />
                    )}
                  </Layer>
                )}

                {/* Watermark Overlay Layer (hidden when showing compare before image) */}
                {!showBeforeAfter && (
                  <Layer>
                    {/* Tiled Watermark if enabled */}
                    {config.tiledConfig?.enabled && (
                      <Group>
                        {Array.from({ length: 6 }).map((_, rIdx) =>
                          Array.from({ length: 6 }).map((_, cIdx) => (
                            <KonvaText
                              key={`tile-${rIdx}-${cIdx}`}
                              text={config.tiledConfig.text || 'AURUM JEWELS'}
                              x={offsetX + cIdx * (renderWidth / 4)}
                              y={offsetY + rIdx * (renderHeight / 4)}
                              fontFamily={config.tiledConfig.fontFamily || 'Outfit'}
                              fontSize={Math.max(
                                10,
                                renderHeight * (config.tiledConfig.fontSizeRatio || 0.03)
                              )}
                              fill={config.tiledConfig.color || '#FFFFFF'}
                              opacity={config.tiledConfig.opacity ?? 0.18}
                              rotation={config.tiledConfig.angle || -30}
                              align="center"
                            />
                          ))
                        )}
                      </Group>
                    )}

                    {/* Logo Watermark if enabled */}
                    {config.logoConfig?.enabled && logoImg && (
                      <KonvaImage
                        image={logoImg}
                        x={logoCanvasX}
                        y={logoCanvasY}
                        width={logoTargetW}
                        height={logoTargetH}
                        opacity={config.logoConfig.opacity ?? 0.85}
                        rotation={config.logoConfig.rotation || 0}
                        draggable
                        onDragEnd={handleLogoDragEnd}
                      />
                    )}

                    {/* Interactive Text Watermark */}
                    {config.textConfig?.enabled && config.textConfig.text && (
                      <KonvaText
                        ref={textRef}
                        text={config.textConfig.text}
                        x={textCanvasX}
                        y={textCanvasY}
                        offsetX={textRef.current ? textRef.current.width() / 2 : 50}
                        offsetY={textRef.current ? textRef.current.height() / 2 : 10}
                        fontFamily={config.textConfig.fontFamily || 'Outfit'}
                        fontSize={textFontSize}
                        fontStyle={config.textConfig.fontWeight || '600'}
                        fill={config.textConfig.color || '#FFFFFF'}
                        opacity={config.textConfig.opacity ?? 0.85}
                        rotation={config.textConfig.rotation || 0}
                        letterSpacing={config.textConfig.letterSpacing || 2}
                        align={config.textConfig.alignment || 'center'}
                        shadowEnabled={Boolean(config.textConfig.shadow)}
                        shadowColor={
                          config.textConfig.shadow
                            ? config.textConfig.shadow.color || 'rgba(0,0,0,0.6)'
                            : undefined
                        }
                        shadowBlur={
                          config.textConfig.shadow ? config.textConfig.shadow.blur ?? 4 : 0
                        }
                        shadowOffsetX={
                          config.textConfig.shadow ? config.textConfig.shadow.offsetX ?? 2 : 0
                        }
                        shadowOffsetY={
                          config.textConfig.shadow ? config.textConfig.shadow.offsetY ?? 2 : 0
                        }
                        stroke={
                          config.textConfig.stroke && config.textConfig.stroke.width > 0
                            ? config.textConfig.stroke.color
                            : undefined
                        }
                        strokeWidth={
                          config.textConfig.stroke && config.textConfig.stroke.width > 0
                            ? config.textConfig.stroke.width
                            : 0
                        }
                        draggable
                        onDragEnd={handleTextDragEnd}
                      />
                    )}
                  </Layer>
                )}
              </Stage>
            </div>

            {/* Live Drag Instruction Floating Pill */}
            <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm border border-[#E2E8F0] px-3 py-1.5 rounded-lg shadow-sm text-xs font-mono text-[#64748B] pointer-events-none z-20">
              {isVideo ? '✨ Drag watermark over live rotating video' : 'Drag to reposition watermark'}
            </div>
          </div>

          {/* Integrated Video Playback Controls Bar (Only when viewing video) */}
          {isVideo && (
            <div className="border-t border-[#E2E8F0] bg-white px-3 py-2 flex items-center justify-between gap-3 text-xs flex-shrink-0 shadow-2xs">
              <div className="flex items-center gap-2">
                {/* Play / Pause Toggle */}
                <button
                  type="button"
                  onClick={toggleVideoPlay}
                  className="p-1.5 rounded-lg bg-[#7C3AED]/10 hover:bg-[#7C3AED]/20 text-[#7C3AED] transition cursor-pointer"
                  title={isVideoPlaying ? 'Pause Video' : 'Play Video'}
                >
                  {isVideoPlaying ? (
                    <Pause className="w-3.5 h-3.5 fill-[#7C3AED]" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-[#7C3AED] translate-x-0.2" />
                  )}
                </button>

                {/* Restart Video */}
                <button
                  type="button"
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = 0;
                      videoRef.current.play().then(() => setIsVideoPlaying(true)).catch(() => {});
                    }
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                  title="Restart to Beginning"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                {/* Video Mute Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    if (videoRef.current) {
                      const next = !isVideoMuted;
                      videoRef.current.muted = next;
                      setIsVideoMuted(next);
                    }
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                  title={isVideoMuted ? 'Unmute Audio' : 'Mute Audio'}
                >
                  {isVideoMuted ? (
                    <VolumeX className="w-3.5 h-3.5 text-rose-500" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                </button>

                {/* Timestamp */}
                <span className="text-[11px] font-mono font-medium text-slate-600 pl-1">
                  {formatTime(videoCurrentTime)} / {formatTime(videoDuration)}
                </span>
              </div>

              {/* Video Timeline Scrubber */}
              <div className="flex-1 max-w-xs sm:max-w-md mx-2 flex items-center">
                <input
                  type="range"
                  min="0"
                  max={videoDuration || 100}
                  step="0.1"
                  value={videoCurrentTime}
                  onChange={(e) => {
                    const target = parseFloat(e.target.value);
                    setVideoCurrentTime(target);
                    if (videoRef.current) {
                      videoRef.current.currentTime = target;
                    }
                  }}
                  className="w-full h-1.5 accent-[#7C3AED] bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  title="Seek Video Frame"
                />
              </div>

              {/* Right Video Controls: Speed & Loop */}
              <div className="flex items-center gap-1.5">
                {/* Speed buttons (1x, 2x, 3x) */}
                <div className="flex items-center rounded-lg border border-[#E2E8F0] p-0.5 bg-[#F8FAFC]">
                  {[1.0, 2.0, 3.0].map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => setVideoSpeed(spd)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                        videoSpeed === spd
                          ? 'bg-[#7C3AED] text-white shadow-xs'
                          : 'text-[#64748B] hover:text-[#1E293B]'
                      }`}
                      title={`Playback Speed ${spd}x`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>

                {/* Loop Button */}
                <button
                  type="button"
                  onClick={() => setIsLooping(!isLooping)}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    isLooping
                      ? 'bg-purple-100 text-purple-700'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                  }`}
                  title={isLooping ? 'Looping 360° Enabled' : 'Loop Disabled'}
                >
                  <Repeat className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
