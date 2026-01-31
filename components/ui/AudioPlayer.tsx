"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, Volume1, VolumeX } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface AudioPlayerProps {
  src: string;
  title?: string;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function AudioPlayer({ src, title }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [prevVolume, setPrevVolume] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);

    const onDurationChange = () => {
      // WebM 파일은 loadedmetadata에서 duration이 Infinity일 수 있음
      // durationchange 이벤트에서 유한한 값이 되면 업데이트
      if (isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const onLoadedMetadata = () => {
      if (isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      } else {
        // WebM 등에서 duration이 Infinity인 경우:
        // 끝까지 시크하여 실제 길이를 알아낸 뒤 복원
        const handleFallback = () => {
          if (isFinite(audio.duration) && audio.duration > 0) {
            setDuration(audio.duration);
          }
          audio.currentTime = 0;
          audio.removeEventListener("timeupdate", handleFallback);
        };
        audio.addEventListener("timeupdate", handleFallback);
        audio.currentTime = 1e10; // 끝으로 시크하여 duration 계산 트리거
      }
    };

    const onEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleSeek = useCallback((value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value[0];
    setCurrentTime(value[0]);
  }, []);

  const handleVolumeChange = useCallback((value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    const v = value[0];
    audio.volume = v;
    setVolume(v);
    if (v > 0) setPrevVolume(v);
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (volume > 0) {
      setPrevVolume(volume);
      audio.volume = 0;
      setVolume(0);
    } else {
      audio.volume = prevVolume;
      setVolume(prevVolume);
    }
  }, [volume, prevVolume]);

  return (
    <div className="flex items-center gap-3 p-3 bg-muted rounded-lg border border-border my-3 not-prose">
      <button
        onClick={togglePlay}
        className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
        aria-label={isPlaying ? "일시정지" : "재생"}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4 ml-0.5" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        {title && (
          <p className="text-sm font-medium truncate mb-1">{title}</p>
        )}
        <Slider
          value={[currentTime]}
          max={duration || 1}
          step={0.1}
          onValueChange={handleSeek}
          className="cursor-pointer"
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-muted-foreground">
            {formatTime(currentTime)}
          </span>
          <span className="text-xs text-muted-foreground">
            {duration > 0 ? formatTime(duration) : "--:--"}
          </span>
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-1.5">
        <button
          onClick={toggleMute}
          className="p-1.5 rounded hover:bg-background/50 transition-colors cursor-pointer"
          aria-label={volume === 0 ? "음소거 해제" : "음소거"}
        >
          {volume === 0 ? (
            <VolumeX className="h-4 w-4 text-muted-foreground" />
          ) : volume < 0.5 ? (
            <Volume1 className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Volume2 className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        <Slider
          value={[volume]}
          max={1}
          step={0.05}
          onValueChange={handleVolumeChange}
          className="w-16 cursor-pointer"
        />
      </div>

      <audio ref={audioRef} src={src} preload="auto" />
    </div>
  );
}
