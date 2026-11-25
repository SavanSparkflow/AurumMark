import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  Repeat,
  RotateCcw,
  Gauge,
  Check,
  Loader2,
} from 'lucide-react';

export interface CustomVideoPlayerProps {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  className?: string;
  compact?: boolean;
  title?: string;
  onEnded?: () => void;
}

const SPEED_OPTIONS = [
  { label: '0.5x (Slow)', value: 0.5, badge: '0.5x' },
  { label: '1x (Normal)', value: 1.0, badge: '1x' },
  { label: '1.5x (Speed)', value: 1.5, badge: '1.5x' },
  { label: '2x (Fast)', value: 2.0, badge: '2x' },
  { label: '3x (Ultra Fast)', value: 3.0, badge: '3x' },
];

export const CustomVideoPlayer: React.FC<CustomVideoPlayerProps> = ({
  src,
  poster,
  autoPlay = true,
  loop = true,
  muted = false,
  className = '',
  compact = false,
  title,
  onEnded,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(muted);
  const [volume, setVolume] = useState<number>(muted ? 0 : 1);
  const [prevVolume, setPrevVolume] = useState<number>(1);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [bufferedPercent, setBufferedPercent] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isLooping, setIsLooping] = useState<boolean>(loop);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [showCenterFeedback, setShowCenterFeedback] = useState<'play' | 'pause' | null>(null);

  // Time formatter helper mm:ss
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Sync playback speed
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Sync loop setting
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.loop = isLooping;
    }
  }, [isLooping]);

  // AutoPlay attempt on mount / source change
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (autoPlay) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch(() => {
            video.muted = true;
            setIsMuted(true);
            video.play().then(() => setIsPlaying(true)).catch(() => {});
          });
      }
    }
  }, [src, autoPlay]);

  // Fullscreen listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Controls auto-hide timer
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    if (isPlaying && !isSpeedMenuOpen && !isScrubbing) {
      hideTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 2500);
    }
  }, [isPlaying, isSpeedMenuOpen, isScrubbing]);

  const handleMouseMove = () => {
    resetHideTimer();
  };

  const handleMouseLeave = () => {
    if (isPlaying && !isSpeedMenuOpen && !isScrubbing) {
      setShowControls(false);
    }
  };

  // Toggle Play / Pause
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused || video.ended) {
      video.play().then(() => {
        setIsPlaying(true);
        setShowCenterFeedback('play');
        setTimeout(() => setShowCenterFeedback(null), 500);
      }).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
      setShowCenterFeedback('pause');
      setTimeout(() => setShowCenterFeedback(null), 500);
    }
    resetHideTimer();
  }, [resetHideTimer]);

  // Toggle Mute / Volume
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isMuted || volume === 0) {
      const restored = prevVolume > 0 ? prevVolume : 1;
      video.muted = false;
      video.volume = restored;
      setVolume(restored);
      setIsMuted(false);
    } else {
      setPrevVolume(volume);
      video.muted = true;
      video.volume = 0;
      setVolume(0);
      setIsMuted(true);
    }
    resetHideTimer();
  };

  const handleVolumeChange = (newVol: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = newVol;
    setVolume(newVol);
    if (newVol === 0) {
      video.muted = true;
      setIsMuted(true);
    } else {
      video.muted = false;
      setIsMuted(false);
      setPrevVolume(newVol);
    }
    resetHideTimer();
  };

  // Toggle Fullscreen (container-level to retain custom controls)
  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
    resetHideTimer();
  };

  // Skip Seek
  const handleSeekDelta = (deltaSeconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const target = Math.max(0, Math.min(video.currentTime + deltaSeconds, video.duration || 0));
    video.currentTime = target;
    setCurrentTime(target);
    resetHideTimer();
  };

  // Scrubber actions
  const handleScrubberAction = (e: React.PointerEvent<HTMLDivElement> | PointerEvent) => {
    if (!progressBarRef.current || !videoRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percent = pos / rect.width;
    const targetTime = percent * (videoRef.current.duration || 0);

    videoRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsScrubbing(true);
    handleScrubberAction(e);

    const onPointerMove = (moveEvt: PointerEvent) => {
      handleScrubberAction(moveEvt);
    };

    const onPointerUp = () => {
      setIsScrubbing(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      resetHideTimer();
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const handleTimelineHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !videoRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percent = pos / rect.width;
    setHoverPosition(percent * 100);
    setHoverTime(percent * (videoRef.current.duration || 0));
  };

  // Video element events
  const handleTimeUpdate = () => {
    if (!videoRef.current || isScrubbing) return;
    setCurrentTime(videoRef.current.currentTime);

    if (videoRef.current.buffered.length > 0) {
      const end = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
      const total = videoRef.current.duration || 1;
      setBufferedPercent(Math.min((end / total) * 100, 100));
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration || 0);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case ' ':
      case 'k':
        e.preventDefault();
        togglePlay();
        break;
      case 'm':
        e.preventDefault();
        toggleMute();
        break;
      case 'f':
        e.preventDefault();
        toggleFullscreen();
        break;
      case 'l':
        e.preventDefault();
        setIsLooping((prev) => !prev);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        handleSeekDelta(-5);
        break;
      case 'ArrowRight':
        e.preventDefault();
        handleSeekDelta(5);
        break;
      case 'ArrowUp':
        e.preventDefault();
        handleVolumeChange(Math.min(1, volume + 0.1));
        break;
      case 'ArrowDown':
        e.preventDefault();
        handleVolumeChange(Math.max(0, volume - 0.1));
        break;
      default:
        break;
    }
  };

  const currentPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onContextMenu={(e) => {
        // Prevent default browser right-click "Save video as..."
        e.preventDefault();
        return false;
      }}
      className={`relative group select-none bg-black rounded-xl overflow-hidden flex items-center justify-center focus:outline-none ${className}`}
    >
      {/* Native HTML5 Video Element with download/PiP disabled */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        playsInline
        loop={isLooping}
        muted={isMuted}
        controls={false}
        disablePictureInPicture
        controlsList="nodownload nofullscreen noplaybackrate"
        onContextMenu={(e) => e.preventDefault()}
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onEnded={() => {
          setIsPlaying(false);
          if (onEnded) onEnded();
        }}
        className="w-full h-full object-contain cursor-pointer"
      />

      {/* Buffering Indicator */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none z-20">
          <div className="p-3.5 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 text-white flex items-center gap-2.5 shadow-xl">
            <Loader2 className="w-5 h-5 animate-spin text-[#A78BFA]" />
            <span className="text-xs font-semibold">Buffering...</span>
          </div>
        </div>
      )}

      {/* Large Center Play / Pause Animated Icon Feedback */}
      {showCenterFeedback && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 animate-out fade-out zoom-out-95 duration-500">
          <div className="w-16 h-16 rounded-full bg-black/65 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-2xl">
            {showCenterFeedback === 'play' ? (
              <Play className="w-8 h-8 fill-white translate-x-0.5 text-white" />
            ) : (
              <Pause className="w-8 h-8 fill-white text-white" />
            )}
          </div>
        </div>
      )}

      {/* Center Big Play Button when paused */}
      {!isPlaying && !isBuffering && (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 m-auto w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#7C3AED]/90 hover:bg-[#6D28D9] text-white flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all z-10 backdrop-blur-xs cursor-pointer border border-white/25"
          title="Play Video"
        >
          <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-white translate-x-0.5" />
        </button>
      )}

      {/* Video Title Header Overlay (shown on hover) */}
      {title && (
        <div
          className={`absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent z-20 transition-opacity duration-300 pointer-events-none flex items-center justify-between ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <span className="text-xs font-semibold text-white/90 drop-shadow-md truncate max-w-[80%]">
            {title}
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/80 backdrop-blur-xs border border-white/10">
            JEWELLERY VIDEO
          </span>
        </div>
      )}

      {/* Custom Bottom Controls Bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/65 to-transparent ${
          compact ? 'px-2 pb-2 pt-4' : 'px-3 pb-3 pt-6'
        } z-20 transition-all duration-300 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        }`}
      >
        {/* Timeline Scrubber Bar */}
        <div
          ref={progressBarRef}
          onPointerDown={handlePointerDown}
          onMouseMove={handleTimelineHover}
          onMouseLeave={() => setHoverTime(null)}
          className="relative w-full h-2.5 flex items-center cursor-pointer group/bar mb-2 py-1"
        >
          {/* Timeline Background Track */}
          <div className="relative w-full h-1 group-hover/bar:h-1.5 transition-all rounded-full bg-white/25 overflow-hidden">
            {/* Buffered Progress */}
            <div
              className="absolute top-0 left-0 bottom-0 bg-white/35 rounded-full transition-all duration-150"
              style={{ width: `${bufferedPercent}%` }}
            />
            {/* Played Progress (Purple-to-Gold AurumMark gradient) */}
            <div
              className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-[#A78BFA] via-[#7C3AED] to-[#D4AF37] rounded-full"
              style={{ width: `${currentPercent}%` }}
            />
          </div>

          {/* Scrubber Thumb */}
          <div
            className="absolute w-3.5 h-3.5 rounded-full bg-white shadow-md border-2 border-[#7C3AED] scale-0 group-hover/bar:scale-100 transition-transform -translate-x-1/2 pointer-events-none"
            style={{ left: `${currentPercent}%` }}
          />

          {/* Scrubber Tooltip Time Preview */}
          {hoverTime !== null && (
            <div
              className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded bg-black/90 text-white text-[10px] font-mono font-semibold pointer-events-none border border-white/15 shadow-md whitespace-nowrap"
              style={{ left: `${hoverPosition}%` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        {/* Controls Row */}
        <div
          className={`flex items-center justify-between text-white ${
            compact ? 'text-[11px] gap-1' : 'text-xs gap-2'
          }`}
        >
          {/* Left Controls: Play/Pause, Replay, Volume, Time Display */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Play / Pause Button */}
            <button
              type="button"
              onClick={togglePlay}
              className="p-1 sm:p-1.5 rounded-lg hover:bg-white/15 text-white transition active:scale-95 cursor-pointer"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-white" />
              ) : (
                <Play className="w-4 h-4 fill-white translate-x-0.5" />
              )}
            </button>

            {/* Replay / Restart */}
            <button
              type="button"
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = 0;
                  videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
                }
              }}
              className="p-1 sm:p-1.5 rounded-lg hover:bg-white/15 text-white/80 hover:text-white transition active:scale-95 cursor-pointer"
              title="Restart Video"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Volume Control with hover slider */}
            <div className="relative flex items-center group/vol">
              <button
                type="button"
                onClick={toggleMute}
                className="p-1 sm:p-1.5 rounded-lg hover:bg-white/15 text-white/90 hover:text-white transition active:scale-95 cursor-pointer"
                title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : volume < 0.5 ? (
                  <Volume1 className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>

              {/* Smooth Volume Slider */}
              <div className="w-0 group-hover/vol:w-14 sm:group-hover/vol:w-16 overflow-hidden transition-all duration-200 flex items-center pl-1">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-12 sm:w-14 h-1 accent-[#A78BFA] bg-white/30 rounded-lg appearance-none cursor-pointer"
                  title="Volume"
                />
              </div>
            </div>

            {/* Time Stamp mm:ss / mm:ss */}
            <div className="text-[10px] sm:text-[11px] font-mono text-white/85 tracking-tight shrink-0 pl-1">
              <span>{formatTime(currentTime)}</span>
              <span className="mx-1 text-white/40">/</span>
              <span className="text-white/60">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Controls: Speed Selector (1x, 2x, 3x options), Loop, Fullscreen */}
          {/* NOTE: DOWNLOAD FUNCTIONALITY IS EXCLUDED AS REQUESTED */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Playback Speed Popover (with 1x, 2x, 3x options) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsSpeedMenuOpen((prev) => !prev);
                  resetHideTimer();
                }}
                className={`px-1.5 sm:px-2 py-1 rounded-lg text-[10px] sm:text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                  playbackRate !== 1.0
                    ? 'bg-[#7C3AED] text-white shadow-xs'
                    : 'bg-white/10 hover:bg-white/20 text-white/90'
                }`}
                title="Playback Speed (1x, 2x, 3x)"
              >
                <Gauge className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>{playbackRate}x</span>
              </button>

              {/* Speed Popover Menu */}
              {isSpeedMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setIsSpeedMenuOpen(false)}
                  />
                  <div className="absolute bottom-9 right-0 bg-[#0F172A]/95 backdrop-blur-md border border-white/15 rounded-xl shadow-2xl py-1.5 w-36 z-30 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-2.5 py-1 text-[10px] font-bold text-white/50 uppercase tracking-wider border-b border-white/10 mb-1">
                      Playback Speed
                    </div>
                    {SPEED_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setPlaybackRate(opt.value);
                          setIsSpeedMenuOpen(false);
                          resetHideTimer();
                        }}
                        className={`w-full px-2.5 py-1.5 text-xs text-left flex items-center justify-between hover:bg-white/15 transition cursor-pointer ${
                          playbackRate === opt.value
                            ? 'text-[#A78BFA] font-bold bg-white/10'
                            : 'text-white/80 font-medium'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {playbackRate === opt.value && (
                          <Check className="w-3.5 h-3.5 text-[#A78BFA]" />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Loop Toggle */}
            <button
              type="button"
              onClick={() => {
                setIsLooping((prev) => !prev);
                resetHideTimer();
              }}
              className={`p-1 sm:p-1.5 rounded-lg transition active:scale-95 cursor-pointer ${
                isLooping
                  ? 'bg-[#7C3AED]/30 text-[#A78BFA] border border-[#7C3AED]/40'
                  : 'text-white/60 hover:text-white hover:bg-white/15'
              }`}
              title={isLooping ? 'Continuous 360° Loop Enabled' : 'Loop Disabled'}
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1 sm:p-1.5 rounded-lg hover:bg-white/15 text-white/90 hover:text-white transition active:scale-95 cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
            >
              {isFullscreen ? (
                <Minimize className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              ) : (
                <Maximize className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
