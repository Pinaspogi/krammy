import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Pause, Play, SkipBack, SkipForward } from 'lucide-react';

import { profile, type YoutubeMusic } from './member';

type LanyardProfile = {
    avatar?: string;
    banner?: string;
    username?: string;
    displayName?: string;
    decoration?: string;
    status?: 'online' | 'idle' | 'dnd' | 'offline';
    publicFlags?: number;
};

function discordAvatarUrl(userId: string, avatar: string | null | undefined) {
    if (!avatar) return `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(userId) % 6n)}.png`;
    const ext = avatar.startsWith('a_') ? 'gif' : 'webp';
    return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${ext}?size=512`;
}

function useLanyardProfile(userId: string) {
    const [state, setState] = useState<LanyardProfile | null>(null);

    useEffect(() => {
        if (!userId || userId === 'YOUR_DISCORD_ID') return;
        let cancelled = false;

        const load = async () => {
            try {
                const response = await fetch(`https://api.lanyard.rest/v1/users/${userId}`, { cache: 'no-store' });
                const payload = await response.json();
                const data = payload?.data;
                const user = data?.discord_user;
                if (!payload?.success || !user || cancelled) return;

                const decorationAsset = user.avatar_decoration_data?.asset;
                setState({
                    avatar: discordAvatarUrl(userId, user.avatar),
                    username: user.username,
                    displayName: user.global_name || user.username,
                    decoration: decorationAsset
                        ? `https://cdn.discordapp.com/avatar-decoration-presets/${decorationAsset}.png?size=512`
                        : undefined,
                    status: data.discord_status || 'offline',
                    publicFlags: Number(user.public_flags || 0),
                });
            } catch {
                // Keep the configured fallback profile when Lanyard is unavailable.
            }
        };

        load();
        const timer = window.setInterval(load, 30_000);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [userId]);

    return state;
}

const DISCORD_BADGES: Array<{ bit: number; label: string; mark: string }> = [
    { bit: 1 << 0, label: 'Discord Staff', mark: 'ST' },
    { bit: 1 << 1, label: 'Partner', mark: 'PT' },
    { bit: 1 << 2, label: 'HypeSquad', mark: 'HS' },
    { bit: 1 << 3, label: 'Bug Hunter', mark: 'BH' },
    { bit: 1 << 6, label: 'HypeSquad Events', mark: 'EV' },
    { bit: 1 << 7, label: 'House Bravery', mark: 'BR' },
    { bit: 1 << 8, label: 'House Brilliance', mark: 'BL' },
    { bit: 1 << 9, label: 'House Balance', mark: 'BA' },
    { bit: 1 << 14, label: 'Active Developer', mark: 'AD' },
    { bit: 1 << 22, label: 'Verified Bot', mark: 'VB' },
];

function DiscordBadges({ flags = 0 }: { flags?: number }) {
    const badges = DISCORD_BADGES.filter((badge) => (flags & badge.bit) === badge.bit);
    if (!badges.length) return null;
    return (
        <div className="discord-badges" aria-label="Discord badges" data-testid="list-discord-badges">
            {badges.map((badge) => (
                <span className="discord-badge" title={badge.label} aria-label={badge.label} key={badge.label}>{badge.mark}</span>
            ))}
        </div>
    );
}

function socialSlug(label: string) {
    const value = label.toLowerCase().trim();
    const slugs: Record<string, string> = {
        instagram: 'instagram',
        tiktok: 'tiktok',
        youtube: 'youtube',
        twitch: 'twitch',
        kick: 'kick',
        discord: 'discord',
        spotify: 'spotify',
        github: 'github',
        twitter: 'x',
        x: 'x',
        telegram: 'telegram',
        snapchat: 'snapchat',
        reddit: 'reddit',
        pinterest: 'pinterest',
        linkedin: 'linkedin',
        threads: 'threads',
        soundcloud: 'soundcloud',
        steam: 'steam',
        roblox: 'roblox',
    };
    return slugs[value] ?? null;
}

function SocialIcon({ label }: { label: string }) {
    const slug = socialSlug(label);
    if (!slug) return <ExternalLink size={18} />;
    return (
        <img
            src={`https://cdn.simpleicons.org/${slug}/7b1e2b`}
            alt=""
            aria-hidden="true"
            className="social-icon-image"
        />
    );
}

function youtubeVideoId(url: string) {
    try {
        const parsed = new URL(url);
        if (parsed.hostname === 'youtu.be') return parsed.pathname.slice(1);
        if (parsed.pathname === '/watch') return parsed.searchParams.get('v') || '';
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts[0] === 'embed' || parts[0] === 'shorts') return parts[1] || '';
        return '';
    } catch {
        return '';
    }
}

function youtubeEmbed(url: string) {
    const videoId = youtubeVideoId(url);
    if (!videoId) return '';
    const origin = typeof window === 'undefined' ? '' : `&origin=${encodeURIComponent(window.location.origin)}`;
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&disablekb=1&enablejsapi=1&loop=1&modestbranding=1&playsinline=1&rel=0${origin}`;
}

type LyricsResponse = {
    plainLyrics?: string | null;
    syncedLyrics?: string | null;
};

type LyricLine = {
    timeMs?: number;
    text: string;
};

function parseLyrics(rawLyrics: string | null | undefined): LyricLine[] {
    if (!rawLyrics) return [];

    return rawLyrics
        .split('\n')
        .flatMap((line) => {
            const matches = [...line.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]\s*(.*)$/g)];
            if (!matches.length) {
                const text = line.trim();
                return text && !/^\[[a-z]+:/i.test(text) ? [{ text }] : [];
            }

            return matches.map((match) => {
                const fraction = (match[3] || '').padEnd(3, '0').slice(0, 3);
                return {
                    timeMs: Number(match[1]) * 60_000 + Number(match[2]) * 1_000 + Number(fraction || 0),
                    text: match[4].trim(),
                };
            }).filter((line) => line.text);
        });
}

function normalizeLyricsValue(value: string) {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]/g, '');
}

function useTrackLyrics(track?: YoutubeMusic) {
    const [state, setState] = useState<LyricsResponse | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!track?.url) {
            setState(null);
            setLoading(false);
            return;
        }

        const controller = new AbortController();

        const loadLyrics = async () => {
            setLoading(true);
            setState(null);

            try {
                // Read the user's local LRC file. Put it at:
                // public/assets/lyrics.lrc
                const response = await fetch(track.lyricsFile || '/assets/lyrics.lrc', {
                    cache: 'no-store',
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(
                        `Could not load ${track.lyricsFile || '/assets/lyrics.lrc'} (${response.status})`,
                    );
                }

                const lrc = await response.text();
                const trimmed = lrc.trim();

                if (!trimmed) {
                    throw new Error(`${track.lyricsFile || '/assets/lyrics.lrc'} is empty`);
                }

                setState({
                    syncedLyrics: trimmed,
                    plainLyrics: null,
                });
            } catch (error: unknown) {
                if (
                    error instanceof DOMException &&
                    error.name === 'AbortError'
                ) {
                    return;
                }

                console.error('Local LRC lyrics error:', error);
                setState(null);
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        loadLyrics();

        return () => controller.abort();
    }, [track?.url, track?.lyricsFile]);

    return { lyrics: state, loading };
}

declare global {
    interface Window {
        YT?: {
            Player: new (element: HTMLElement | string, options: {
                videoId: string;
                playerVars?: Record<string, number | string>;
                events?: {
                    onReady?: (event: { target: YouTubePlayer }) => void;
                    onStateChange?: (event: { data: number }) => void;
                };
            }) => YouTubePlayer;
            PlayerState?: {
                UNSTARTED: number;
                ENDED: number;
                PLAYING: number;
                PAUSED: number;
                BUFFERING: number;
                CUED: number;
            };
        };
        onYouTubeIframeAPIReady?: () => void;
        __krammyYoutubeApiPromise?: Promise<void>;
    }
}

type YouTubePlayer = {
    playVideo: () => void;
    pauseVideo: () => void;
    seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
    getCurrentTime: () => number;
    destroy: () => void;
};

function loadYouTubeIframeApi() {
    if (window.YT?.Player) return Promise.resolve();
    if (window.__krammyYoutubeApiPromise) return window.__krammyYoutubeApiPromise;

    window.__krammyYoutubeApiPromise = new Promise<void>((resolve) => {
        const previous = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            previous?.();
            resolve();
        };

        const existing = document.querySelector(
            'script[src="https://www.youtube.com/iframe_api"]',
        );

        if (!existing) {
            const script = document.createElement('script');
            script.src = 'https://www.youtube.com/iframe_api';
            document.head.appendChild(script);
        }
    });

    return window.__krammyYoutubeApiPromise;
}

function YoutubeMusicPanel({ track, onEnded }: { track: YoutubeMusic; onEnded: () => void }) {
    const playerHostRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<YouTubePlayer | null>(null);
    const timeRef = useRef(0);
    const updateTimerRef = useRef<number | null>(null);
    const onEndedRef = useRef(onEnded);
    onEndedRef.current = onEnded;

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);

    const videoId = youtubeVideoId(track.url);
    const artwork = track.artwork || profile.avatar;

    const { lyrics, loading } = useTrackLyrics(track);
    const lyricLines = parseLyrics(lyrics?.syncedLyrics);
    const hasSyncedLyrics = lyricLines.length > 0;

    useEffect(() => {
        let cancelled = false;

        const stopPolling = () => {
            if (updateTimerRef.current !== null) {
                window.clearInterval(updateTimerRef.current);
                updateTimerRef.current = null;
            }
        };

        const pollTime = () => {
            if (!playerRef.current) return;
            try {
                const seconds = playerRef.current.getCurrentTime();
                if (Number.isFinite(seconds)) {
                    timeRef.current = seconds;
                    setCurrentTime(seconds);
                }
            } catch {
                // Player may not be ready between state changes.
            }
        };

        const startPolling = () => {
            stopPolling();
            updateTimerRef.current = window.setInterval(pollTime, 50);
            pollTime();
        };

        const createPlayer = async () => {
            if (!videoId || !playerHostRef.current) return;

            try {
                await loadYouTubeIframeApi();
            } catch {
                return;
            }

            if (
                cancelled ||
                !playerHostRef.current ||
                !window.YT?.Player
            ) {
                return;
            }

            playerRef.current?.destroy();
            playerRef.current = null;
            playerHostRef.current.innerHTML = '';

            const player = new window.YT.Player(playerHostRef.current, {
                videoId,
                playerVars: {
                    autoplay: 1,
                    controls: 0,
                    disablekb: 1,
                    enablejsapi: 1,
                    loop: 0,
                    modestbranding: 1,
                    playsinline: 1,
                    rel: 0,
                },
                events: {
                    onReady: ({ target }) => {
                        if (cancelled) return;
                        playerRef.current = target;
                        try {
                            target.playVideo();
                        } catch {
                            // Browser autoplay policy may block this.
                        }
                        startPolling();
                    },
                    onStateChange: ({ data }) => {
                        if (cancelled) return;
                        const ended = data === 0;
                        const playing = data === 1;
                        setIsPlaying(playing);
                        pollTime();
                        if (ended) {
                            onEndedRef.current();
                        }
                    },
                },
            });

            playerRef.current = player;
        };

        createPlayer();

        return () => {
            cancelled = true;
            stopPolling();
            playerRef.current?.destroy();
            playerRef.current = null;
        };
    }, [videoId]);

    const activeIndex = hasSyncedLyrics
        ? lyricLines.reduce((active, line, index) => {
            if (
                typeof line.timeMs === 'number' &&
                currentTime * 1000 >= line.timeMs
            ) {
                return index;
            }
            return active;
        }, -1)
        : -1;

    const visibleLines =
        activeIndex >= 0
            ? lyricLines.slice(
                Math.max(0, activeIndex - 1),
                Math.min(lyricLines.length, activeIndex + 2),
            )
            : lyricLines.slice(0, 3);

    const togglePlayback = () => {
        const player = playerRef.current;
        if (!player) return;

        try {
            if (isPlaying) {
                player.pauseVideo();
                setIsPlaying(false);
            } else {
                player.playVideo();
                setIsPlaying(true);
            }
        } catch {
            // Ignore unavailable player state.
        }
    };

    const seek = (amount: number) => {
        const player = playerRef.current;
        if (!player) return;

        const next = Math.max(0, timeRef.current + amount);

        try {
            player.seekTo(next, true);
            timeRef.current = next;
            setCurrentTime(next);
        } catch {
            // Ignore unavailable player state.
        }
    };

    return (
        <aside className="youtube-panel" aria-label="YouTube Music player">
            <div className="panel-title">NOW PLAYING</div>

            <div className="youtube-track">
                <img src={artwork} alt="" className="youtube-artwork" />
                <div className="youtube-track-copy">
                    <span className="youtube-eyebrow">YOUTUBE MUSIC</span>
                    <strong>{track.title || 'Add a YouTube Music track'}</strong>
                    <span>{track.artist || 'Your artist name'}</span>
                </div>
            </div>

            <div className="lyrics-block" aria-live="polite">
                <div className="lyrics-heading">
                    <span>LYRICS</span>
                    {loading ? (
                        <span className="lyrics-state">LOADING</span>
                    ) : hasSyncedLyrics ? (
                        <span className="lyrics-state">SYNCED</span>
                    ) : null}
                </div>

                {hasSyncedLyrics && visibleLines.length ? (
                    <div
                        className="lyrics-window"
                        style={{
                            overflow: 'hidden',
                            height: '7.5em',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            gap: '0.35em',
                        }}
                    >
                        {visibleLines.map((line, localIndex) => {
                            const absoluteIndex =
                                Math.max(0, activeIndex - 1) + localIndex;
                            const active = absoluteIndex === activeIndex;

                            return (
                                <p
                                    key={`${line.timeMs ?? 'plain'}-${absoluteIndex}`}
                                    style={{
                                        margin: 0,
                                        textAlign: 'center',
                                        lineHeight: 1.35,
                                        opacity: active ? 1 : 0.3,
                                        transform: active ? 'scale(1.04)' : 'scale(0.98)',
                                        fontWeight: active ? 700 : 500,
                                        color: active ? '#ff304f' : 'rgba(255,255,255,0.7)',
                                        textShadow: active
                                            ? '0 0 5px rgba(255,48,79,.95), 0 0 14px rgba(255,48,79,.8), 0 0 30px rgba(255,48,79,.5)'
                                            : 'none',
                                        transition:
                                            'opacity 90ms linear, transform 90ms ease, color 90ms linear, text-shadow 90ms linear',
                                    }}
                                >
                                    {line.text}
                                </p>
                            );
                        })}
                    </div>
                ) : (
                    <p className="lyrics-empty">
                        {loading
                            ? 'Loading lyrics...'
                            : track.title
                                ? 'No synced lyrics found for this track.'
                                : 'Add your YouTube Music details to show lyrics here.'}
                    </p>
                )}
            </div>

            <div
                ref={playerHostRef}
                className="youtube-frame"
                aria-label="YouTube player"
            />

            <div className="music-controls" aria-label="Music controls">
                <button
                    type="button"
                    onClick={() => seek(-10)}
                    disabled={!videoId}
                    aria-label="Rewind ten seconds"
                    title="Rewind 10 seconds"
                >
                    <SkipBack size={15} />
                </button>

                <button
                    type="button"
                    className="music-play"
                    onClick={togglePlayback}
                    disabled={!videoId}
                    aria-label={isPlaying ? 'Pause music' : 'Play music'}
                >
                    {isPlaying ? <Pause size={17} /> : <Play size={17} />}
                </button>

                <button
                    type="button"
                    onClick={() => seek(10)}
                    disabled={!videoId}
                    aria-label="Skip ten seconds"
                    title="Skip 10 seconds"
                >
                    <SkipForward size={15} />
                </button>
            </div>
        </aside>
    );
}

const DIVINEBLOOD_ASCII_HTML = `<pre style="font-family:'Courier New',Courier,monospace;font-size:12px;line-height:1.17;white-space:pre;background-color:#000;color:#fff;padding:8px;margin:0;"><span style="color:#8c2636">▄▄▄▄▄▄</span><span style="color:#8b0f25">        </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">▄▄▄▄▄▄</span><span style="color:#ff7a86"> </span><span style="color:#8c2636">▄▄▄▄</span><span style="color:#8b0f25">  </span><span style="color:#8c2636">▄▄▄▄</span><span style="color:#ff7a86"> </span><span style="color:#8c2636">▄▄▄▄▄▄</span><span style="color:#ff7a86"> </span><span style="color:#8c2636">▄▄▄▄▄▄▄▄</span><span style="color:#8b0f25">  </span><span style="color:#ff7a86"> </span><span style="color:#8b0f25">              </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">▄▄▄▄▄▄</span><span style="color:#8b0f25">        </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">▄▄▄▄</span><span style="color:#8b0f25">      </span><span style="color:#ff7a86"> </span><span style="color:#8b0f25">                </span><span style="color:#ff7a86"> </span><span style="color:#8b0f25">                </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">▄▄▄▄▄▄</span><span style="color:#8b0f25">        </span>
<span style="color:#8c2636">█</span><span style="color:#8c2636;background-color:#8b0f25">▄░▒</span><span style="color:#8b0f25">▓</span><span style="color:#8c2636;background-color:#8b0f25">▒▀▀▀</span><span style="color:#8c2636">▄▄</span><span style="color:#8b0f25">   </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#8c2636;background-color:#8b0f25">▄░▒▄</span><span style="color:#8c2636">█</span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#8c2636;background-color:#8b0f25">░▒</span><span style="color:#8c2636">█</span><span style="color:#8b0f25">  </span><span style="color:#8c2636">█</span><span style="color:#8c2636;background-color:#8b0f25">▒░</span><span style="color:#8c2636">█</span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#8c2636;background-color:#8b0f25">▄░▒▄</span><span style="color:#8c2636">█</span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#8c2636;background-color:#8b0f25">░▒▄▄</span><span style="color:#ff9aa3;background-color:#8b0f25">░░</span><span style="color:#8b0f25">█</span><span style="color:#8c2636;background-color:#8b0f25">▀</span><span style="color:#8c2636">▄</span><span style="color:#ff7a86"> </span><span style="color:#8b0f25">   </span><span style="color:#8c2636">▄▄</span><span style="color:#8c2636;background-color:#8b0f25">▀▒▒▒▒</span><span style="color:#8c2636">▄▄</span><span style="color:#8b0f25">  </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#8c2636;background-color:#8b0f25">▄░▒</span><span style="color:#8b0f25">▓</span><span style="color:#8c2636;background-color:#8b0f25">▒▀▀▀</span><span style="color:#8c2636">▄▄</span><span style="color:#8b0f25">   </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#8c2636;background-color:#8b0f25">░▒</span><span style="color:#8c2636">█</span><span style="color:#8b0f25">      </span><span style="color:#ff7a86"> </span><span style="color:#8b0f25">   </span><span style="color:#8c2636">▄▄</span><span style="color:#8c2636;background-color:#8b0f25">▀▒▒▒▒</span><span style="color:#8c2636">▄▄</span><span style="color:#8b0f25">    </span><span style="color:#ff7a86"> </span><span style="color:#8b0f25">   </span><span style="color:#8c2636">▄▄</span><span style="color:#8c2636;background-color:#8b0f25">▀▒▒▒▒</span><span style="color:#8c2636">▄▄</span><span style="color:#8b0f25">    </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#8c2636;background-color:#8b0f25">▄░▒</span><span style="color:#8b0f25">▓</span><span style="color:#8c2636;background-color:#8b0f25">▒▀▀▀</span><span style="color:#8c2636">▄▄</span><span style="color:#8b0f25">   </span>
<span style="color:#8b0f25"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">░</span><span style="color:#8c2636;background-color:#8b0f25">░▄▄▄▄░</span><span style="color:#ff9aa3;background-color:#8b0f25">░░</span><span style="color:#8c2636;background-color:#8b0f25">▀</span><span style="color:#8c2636">▄</span><span style="color:#8b0f25"> </span><span style="color:#ff7a86"> </span><span style="color:#8b0f25"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">░</span><span style="color:#8c2636;background-color:#8b0f25">░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25"> </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">░</span><span style="color:#8c2636;background-color:#8b0f25">░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25">  </span><span style="color:#8c2636">█</span><span style="color:#8c2636;background-color:#8b0f25">░</span><span style="color:#ff9aa3;background-color:#8b0f25">░</span><span style="color:#8c2636">█</span><span style="color:#ff7a86"> </span><span style="color:#8b0f25"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">░</span><span style="color:#8c2636;background-color:#8b0f25">░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25"> </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">░</span><span style="color:#8c2636;background-color:#8b0f25">░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25"> </span><span style="color:#8c2636">▀</span><span style="color:#8c2636;background-color:#8b0f25">▄</span><span style="color:#ff9aa3;background-color:#8b0f25">░</span><span style="color:#8b0f25">█</span><span style="color:#8c2636">█</span><span style="color:#ff7a86"> </span><span style="color:#8b0f25"> </span><span style="color:#8c2636">▄</span><span style="color:#8c2636;background-color:#8b0f25">▀</span><span style="color:#ff9aa3;background-color:#8b0f25">░░</span><span style="color:#8c2636;background-color:#8b0f25">░▄▄▄▒▒▓▓</span><span style="color:#8c2636">▄</span><span style="color:#ff7a86"> </span><span style="color:#8b0f25"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">░</span><span style="color:#8c2636;background-color:#8b0f25">░▄▄▄▄░</span><span style="color:#ff9aa3;background-color:#8b0f25">░░</span><span style="color:#8c2636;background-color:#8b0f25">▀</span><span style="color:#8c2636">▄</span><span style="color:#8b0f25"> </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">░</span><span style="color:#8c2636;background-color:#8b0f25">░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25">      </span><span style="color:#ff7a86"> </span><span style="color:#8b0f25"> </span><span style="color:#8c2636">▄</span><span style="color:#8c2636;background-color:#8b0f25">▀</span><span style="color:#ff9aa3;background-color:#8b0f25">░░</span><span style="color:#8c2636;background-color:#8b0f25">░▄▄▄▒▒▓▓</span><span style="color:#8c2636">▄</span><span style="color:#8b0f25">  </span><span style="color:#ff7a86"> </span><span style="color:#8b0f25"> </span><span style="color:#8c2636">▄</span><span style="color:#8c2636;background-color:#8b0f25">▀</span><span style="color:#ff9aa3;background-color:#8b0f25">░░</span><span style="color:#8c2636;background-color:#8b0f25">░▄▄▄▒▒▓▓</span><span style="color:#8c2636">▄</span><span style="color:#8b0f25">  </span><span style="color:#ff7a86"> </span><span style="color:#8b0f25"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">░</span><span style="color:#8c2636;background-color:#8b0f25">░▄▄▄▄░</span><span style="color:#ff9aa3;background-color:#8b0f25">░░</span><span style="color:#8c2636;background-color:#8b0f25">▀</span><span style="color:#8c2636">▄</span><span style="color:#8b0f25"> </span>
<span style="color:#8b0f25"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">▒░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25">   </span><span style="color:#8c2636">▀</span><span style="color:#8c2636;background-color:#8b0f25">▄</span><span style="color:#ff9aa3;background-color:#8b0f25">░▒</span><span style="color:#8c2636;background-color:#8b0f25">▀</span><span style="color:#8c2636">▄</span><span style="color:#ff7a86"> </span><span style="color:#8b0f25"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">▒░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25"> </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">▒░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25">  </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">░▒</span><span style="color:#8c2636">█</span><span style="color:#ff7a86"> </span><span style="color:#8b0f25"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">▒░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25"> </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">▒░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25">  </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">░▒</span><span style="color:#8c2636">█</span><span style="color:#ff7a86"> </span><span style="color:#8c2636">▄</span><span style="color:#8c2636;background-color:#8b0f25">▀</span><span style="color:#ff9aa3;background-color:#8b0f25">▒░</span><span style="color:#8c2636;background-color:#8b0f25">▄</span><span style="color:#8c2636">▀</span><span style="color:#8b0f25">   </span><span style="color:#8c2636">▀▀</span><span style="color:#8c2636;background-color:#8b0f25">▓</span><span style="color:#8c2636">▀</span><span style="color:#8b0f25"> </span><span style="color:#ff7a86"> </span><span style="color:#8b0f25"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">▒░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25">   </span><span style="color:#8c2636">▀</span><span style="color:#8c2636;background-color:#8b0f25">▄</span><span style="color:#ff9aa3;background-color:#8b0f25">░▒</span><span style="color:#8c2636;background-color:#8b0f25">▒</span><span style="color:#8c2636">▌</span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">▒░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25">      </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">▄</span><span style="color:#8c2636;background-color:#8b0f25">▀</span><span style="color:#ff9aa3;background-color:#8b0f25">▒░</span><span style="color:#8c2636;background-color:#8b0f25">▄</span><span style="color:#8c2636">▀</span><span style="color:#8b0f25">   </span><span style="color:#8c2636">▀▀</span><span style="color:#8c2636;background-color:#8b0f25">▓▓▓</span><span style="color:#8c2636">█</span><span style="color:#8b0f25"> </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">▄</span><span style="color:#8c2636;background-color:#8b0f25">▀</span><span style="color:#ff9aa3;background-color:#8b0f25">▒░</span><span style="color:#8c2636;background-color:#8b0f25">▄</span><span style="color:#8c2636">▀</span><span style="color:#8b0f25">   </span><span style="color:#8c2636">▀▀</span><span style="color:#8c2636;background-color:#8b0f25">▓▓▓</span><span style="color:#8c2636">█</span><span style="color:#8b0f25"> </span><span style="color:#ff7a86"> </span><span style="color:#8b0f25"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">▒░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25">   </span><span style="color:#8c2636">▀</span><span style="color:#8c2636;background-color:#8b0f25">▄</span><span style="color:#ff9aa3;background-color:#8b0f25">░▒</span><span style="color:#8c2636;background-color:#8b0f25">▀</span><span style="color:#8c2636">▄</span>
<span style="color:#8b0f25"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">▓▒</span><span style="color:#8c2636">█</span><span style="color:#8b0f25">    </span><span style="color:#8c2636">▐</span><span style="color:#8c2636;background-color:#8b0f25">▌</span><span style="color:#ff9aa3;background-color:#8b0f25">▒▓</span><span style="color:#8c2636">█</span><span style="color:#ff7a86"> </span><span style="color:#8b0f25"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">▓▒</span><span style="color:#8c2636">█</span><span style="color:#8b0f25"> </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">▓▒</span><span style="color:#8c2636">█</span><span style="color:#8b0f25">  </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">▒▓</span><span style="color:#8c2636">█</span><span style="color:#ff7a86"> </span><span style="color:#8b0f25"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">▓▒</span><span style="color:#8c2636">█</span><span style="color:#8b0f25"> </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">▓▒</span><span style="color:#8c2636;background-color:#8b0f25">█</span><span style="color:#8b0f25">  </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">▒▓</span><span style="color:#8c2636;background-color:#8b0f25">█</span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">▓▒</span><span style="color:#8b0f25">████▓</span><span style="color:#8c2636">▌</span><span style="color:#8b0f25">     </span><span style="color:#ff7a86"> </span><span style="color:#8b0f25"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">▓▒</span><span style="color:#8c2636">█</span><span style="color:#8b0f25"> </span><span style="color:#8c2636">▄▄▄█</span><span style="color:#8c2636;background-color:#8b0f25">░▄</span><span style="color:#8c2636">▀</span><span style="color:#8b0f25"> </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">▓▒</span><span style="color:#8c2636">█</span><span style="color:#8b0f25">      </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">▓▒</span><span style="color:#8c2636;background-color:#8b0f25">▐</span><span style="color:#8c2636">▌</span><span style="color:#8b0f25">      </span><span style="color:#8c2636">▐</span><span style="color:#8c2636;background-color:#8b0f25">▒▓▓</span><span style="color:#8c2636">█</span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">▓▒</span><span style="color:#8c2636;background-color:#8b0f25">▐</span><span style="color:#8c2636">▌</span><span style="color:#8b0f25">      </span><span style="color:#8c2636">▐</span><span style="color:#8c2636;background-color:#8b0f25">▒▓▓</span><span style="color:#8c2636">█</span><span style="color:#ff7a86"> </span><span style="color:#8b0f25"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">▓▒</span><span style="color:#8c2636">█</span><span style="color:#8b0f25">    </span><span style="color:#8c2636">▐</span><span style="color:#8c2636;background-color:#8b0f25">▌</span><span style="color:#ff9aa3;background-color:#8b0f25">▒▓</span><span style="color:#8c2636">█</span>
<span style="color:#8b0f25"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">▒░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25">    </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">░░▒</span><span style="color:#8c2636">█</span><span style="color:#ff7a86"> </span><span style="color:#8b0f25"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">▒░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25"> </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">▒░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25">  </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">░▒</span><span style="color:#8c2636">█</span><span style="color:#ff7a86"> </span><span style="color:#8b0f25"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">▒░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25"> </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">▒░</span><span style="color:#8c2636;background-color:#8b0f25">█</span><span style="color:#8b0f25">  </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">░▒</span><span style="color:#8c2636">█</span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">▒░░</span><span style="color:#8c2636">█▀▀▀</span><span style="color:#8b0f25">  </span><span style="color:#8c2636">▄</span><span style="color:#8b0f25">   </span><span style="color:#ff7a86"> </span><span style="color:#8b0f25"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">▒░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25"> </span><span style="color:#8c2636">█</span><span style="color:#8c2636;background-color:#8b0f25">▓░░</span><span style="color:#ff9aa3;background-color:#8b0f25">░</span><span style="color:#8c2636;background-color:#8b0f25">▀</span><span style="color:#8c2636">▄</span><span style="color:#8b0f25"> </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">▒░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25">      </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">▒░░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25">      </span><span style="color:#8c2636">▄</span><span style="color:#8c2636;background-color:#8b0f25">░░░</span><span style="color:#8c2636">█</span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">▒░░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25">      </span><span style="color:#8c2636">▄</span><span style="color:#8c2636;background-color:#8b0f25">░░░</span><span style="color:#8c2636">█</span><span style="color:#ff7a86"> </span><span style="color:#8b0f25"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">▒░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25">    </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">░░▒</span><span style="color:#8c2636">█</span>
<span style="color:#8b0f25"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">░</span><span style="color:#8c2636;background-color:#8b0f25">░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25"> </span><span style="color:#8c2636">▄▄</span><span style="color:#8c2636;background-color:#8b0f25">▀</span><span style="color:#ff9aa3;background-color:#8b0f25">░░░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25"> </span><span style="color:#ff7a86"> </span><span style="color:#8b0f25"> </span><span style="color:#8c2636">█</span><span style="color:#8c2636;background-color:#8b0f25">░░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25"> </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">░</span><span style="color:#8c2636;background-color:#8b0f25">░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25"> </span><span style="color:#8c2636">▐</span><span style="color:#8c2636;background-color:#8b0f25">▌░</span><span style="color:#ff9aa3;background-color:#8b0f25">░</span><span style="color:#8c2636">█</span><span style="color:#ff7a86"> </span><span style="color:#8b0f25"> </span><span style="color:#8c2636">█</span><span style="color:#8c2636;background-color:#8b0f25">░░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25"> </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#8c2636;background-color:#8b0f25">░░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25">  </span><span style="color:#8c2636">█</span><span style="color:#8c2636;background-color:#8b0f25">░</span><span style="color:#ff9aa3;background-color:#8b0f25">░</span><span style="color:#8c2636">█</span><span style="color:#ff7a86"> </span><span style="color:#8b0f25"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">░░░</span><span style="color:#8c2636;background-color:#8b0f25">▀</span><span style="color:#8c2636">▄▄▄</span><span style="color:#8c2636;background-color:#8b0f25">█▓▓</span><span style="color:#8c2636">▄</span><span style="color:#8b0f25"> </span><span style="color:#ff7a86"> </span><span style="color:#8b0f25"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">░</span><span style="color:#8c2636;background-color:#8b0f25">░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25">    </span><span style="color:#ff9aa3;background-color:#8b0f25">░░</span><span style="color:#8c2636;background-color:#8b0f25">▒▓</span><span style="color:#8c2636">▌</span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">░</span><span style="color:#8c2636;background-color:#8b0f25">░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25">  </span><span style="color:#8c2636">█</span><span style="color:#8c2636;background-color:#8b0f25">░</span><span style="color:#ff9aa3;background-color:#8b0f25">░</span><span style="color:#8c2636">█</span><span style="color:#ff7a86"> </span><span style="color:#8b0f25"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">░░░</span><span style="color:#8c2636;background-color:#8b0f25">▀</span><span style="color:#8c2636">▄▄▄▄</span><span style="color:#8c2636;background-color:#8b0f25">▓▓░░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25"> </span><span style="color:#ff7a86"> </span><span style="color:#8b0f25"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">░░░</span><span style="color:#8c2636;background-color:#8b0f25">▀</span><span style="color:#8c2636">▄▄▄▄</span><span style="color:#8c2636;background-color:#8b0f25">▓▓░░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25"> </span><span style="color:#ff7a86"> </span><span style="color:#8b0f25"> </span><span style="color:#8c2636">█</span><span style="color:#ff9aa3;background-color:#8b0f25">░</span><span style="color:#8c2636;background-color:#8b0f25">░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25"> </span><span style="color:#8c2636">▄▄</span><span style="color:#8c2636;background-color:#8b0f25">▀</span><span style="color:#ff9aa3;background-color:#8b0f25">░░░</span><span style="color:#8c2636">█</span><span style="color:#8b0f25"> </span>
<span style="color:#8c2636">▄█</span><span style="color:#8c2636;background-color:#8b0f25">░▒▀▀▒░░</span><span style="color:#ff9aa3;background-color:#8b0f25">░</span><span style="color:#8c2636;background-color:#8b0f25">▄</span><span style="color:#8c2636">▀</span><span style="color:#8b0f25">  </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">▄█</span><span style="color:#8c2636;background-color:#8b0f25">▓▒</span><span style="color:#8c2636">█▄</span><span style="color:#ff7a86"> </span><span style="color:#8c2636">▐</span><span style="color:#8c2636;background-color:#8b0f25">▌▒▓</span><span style="color:#8c2636">▄█</span><span style="color:#8c2636;background-color:#8b0f25">▓▒▐</span><span style="color:#8c2636">▌</span><span style="color:#ff7a86"> </span><span style="color:#8c2636">▄█</span><span style="color:#8c2636;background-color:#8b0f25">▓▒</span><span style="color:#8c2636">█▄</span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#8c2636;background-color:#8b0f25">▓▒</span><span style="color:#8c2636">█</span><span style="color:#8b0f25">  </span><span style="color:#8c2636">█</span><span style="color:#8c2636;background-color:#8b0f25">▒░</span><span style="color:#8c2636">█</span><span style="color:#ff7a86"> </span><span style="color:#8b0f25">  </span><span style="color:#8c2636">▀</span><span style="color:#8c2636;background-color:#8b0f25">▄</span><span style="color:#ff9aa3;background-color:#8b0f25">░</span><span style="color:#8c2636;background-color:#8b0f25">░░▒▒▒▒▓▓</span><span style="color:#8c2636">▀</span><span style="color:#ff7a86"> </span><span style="color:#8c2636">▄█</span><span style="color:#8c2636;background-color:#8b0f25">░▒▀▓▒▀░</span><span style="color:#ff9aa3;background-color:#8b0f25">░</span><span style="color:#8c2636;background-color:#8b0f25">░▓</span><span style="color:#8c2636">▀</span><span style="color:#8b0f25"> </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#8c2636;background-color:#8b0f25">░▒▓</span><span style="color:#8c2636">▄▄</span><span style="color:#8c2636;background-color:#8b0f25">▓▒▒</span><span style="color:#8c2636">█</span><span style="color:#ff7a86"> </span><span style="color:#8b0f25">  </span><span style="color:#8c2636">▀</span><span style="color:#8c2636;background-color:#8b0f25">▄</span><span style="color:#ff9aa3;background-color:#8b0f25">░</span><span style="color:#8c2636;background-color:#8b0f25">░░▒▒▒▒▓▓</span><span style="color:#8c2636">▀</span><span style="color:#8b0f25">  </span><span style="color:#ff7a86"> </span><span style="color:#8b0f25">  </span><span style="color:#8c2636">▀</span><span style="color:#8c2636;background-color:#8b0f25">▄</span><span style="color:#ff9aa3;background-color:#8b0f25">░</span><span style="color:#8c2636;background-color:#8b0f25">░░▒▒▒▒▓▓</span><span style="color:#8c2636">▀</span><span style="color:#8b0f25">  </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">▄█</span><span style="color:#8c2636;background-color:#8b0f25">░▒▀▀▒░░</span><span style="color:#ff9aa3;background-color:#8b0f25">░</span><span style="color:#8c2636;background-color:#8b0f25">▄</span><span style="color:#8c2636">▀</span><span style="color:#8b0f25">  </span>
<span style="color:#8c2636">█</span><span style="color:#8c2636;background-color:#8b0f25">▄▄▄▄▄▄▄</span><span style="color:#8c2636">▀▀</span><span style="color:#8b0f25">    </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#8c2636;background-color:#8b0f25">▄▄▄▄</span><span style="color:#8c2636">█</span><span style="color:#ff7a86"> </span><span style="color:#8b0f25"> </span><span style="color:#8c2636">▀</span><span style="color:#8c2636;background-color:#8b0f25">▄▄▓▓▄▄</span><span style="color:#8c2636">▀</span><span style="color:#8b0f25"> </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#8c2636;background-color:#8b0f25">▄▄▄▄</span><span style="color:#8c2636">█</span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#8c2636;background-color:#8b0f25">▄▄</span><span style="color:#8c2636">█</span><span style="color:#8b0f25">  </span><span style="color:#8c2636">█</span><span style="color:#8c2636;background-color:#8b0f25">▄▄</span><span style="color:#8c2636">█</span><span style="color:#ff7a86"> </span><span style="color:#8b0f25">    </span><span style="color:#8c2636">▀▀</span><span style="color:#8c2636;background-color:#8b0f25">▄▄▄▄</span><span style="color:#8c2636">▀▀</span><span style="color:#8b0f25">  </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#8c2636;background-color:#8b0f25">▄▄▄▄▄▄▄▄</span><span style="color:#8c2636">▀▀</span><span style="color:#8b0f25">   </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">▀</span><span style="color:#8c2636;background-color:#8b0f25">▄▄▓▓▓▓▄▄</span><span style="color:#8c2636">▀</span><span style="color:#ff7a86"> </span><span style="color:#8b0f25">    </span><span style="color:#8c2636">▀▀</span><span style="color:#8c2636;background-color:#8b0f25">▄▄▄▄</span><span style="color:#8c2636">▀▀</span><span style="color:#8b0f25">    </span><span style="color:#ff7a86"> </span><span style="color:#8b0f25">    </span><span style="color:#8c2636">▀▀</span><span style="color:#8c2636;background-color:#8b0f25">▄▄▄▄</span><span style="color:#8c2636">▀▀</span><span style="color:#8b0f25">    </span><span style="color:#ff7a86"> </span><span style="color:#8c2636">█</span><span style="color:#8c2636;background-color:#8b0f25">▄▄▄▄▄▄▄</span><span style="color:#8c2636">▀▀</span><span style="color:#8b0f25">    </span></pre>`;

const DRAGON_ASCII = `
                                                                                                                                                                                                                                                                                                           
                                                                                                                                                                                                                                                                                                           
                                                                                                                                                                                                                                                                                                           
                                                                                                                                                                                                                                                                                                           
                                                                                                                                                                                                                                                                                                           
                                                                                                                                                                                                                                                                                                           
                                                                                             -:                                                                                                             -=-                                                                                            
                                                                                              =#*-                                                                                                       :+%*-                                                                                             
                                                                                               :*%#-                                                                                                   :+%%-                                                                                               
                                                                                                 +@%+       ::                                                                                :       -#@#-                                                                                                
                                                                                                  =@@*:     =-                                                                               :=      =%@#:                                                                                                 
                                                                                                   +@@#:    *+                                                                               -*-    +@@%-                                                                                                  
                                                                                                   :#@@#:  -#*:                                                                              -%+   =%@@=                                                                                                   
                                                                                                    =@@@+  =%#-                                                                              +@*: -#@@#:                                                                                                   
                                                                                                    -%@@#- +*=:                                                                              -+*- +@@@+                                                                                                    
                                                                                                    :*@@#::+%@#-                                                                            +@%#= +@@@=                                                                                                    
                                                                                                     +@@*:-#@@@*                                                                           -%@@@+ =%@%-                                                                                                    
                                                                                                     +@@* -%@@@%=              =                                           =              :*@@@@*:-%@#-                                                                                                    
                                                                       :==-                   :+:    =@@+ =%#+=--              *:                                          *              :--=*%*:-#@#:    +-                   :-=-                                                                       
                                                                           :-+#%@@@%#+:        +#:   =@@+ =%@@@@*:             %-                                          %-             =@@@@@*:-#@*:   =#:        =*%@@@%#*=-                                                                           
                                                                                   :-#@@%=     +@*   -%@+ =@@@@@%-            -@-                                          %#            :*@@@@@*:-#@+   =%%:    :*%@%+::                                                                                  
                                                                                       -#@%=  :*@@*  :*@* =%@@@@@*:           #@:     +-         :::::::::          +-     #@=           -%@@@@@*:-%@=  -#@@-  :#@%+:                                                                                      
                                                                                         =%@*:=@@@%=  +@*:-%@@@@@%-          +@@     =@@#- :=*##%@@@@@@@@@%##*+-  +%@#     *@%          :*@@@@@@*:=%#- :#@@@#:=%@*:                                                                                        
                                                                                          -%#:%@##%#: -%#--%@@%*+=-          %@@     *@#-:+*=: :*@@@@@@@@@%=  -+*=:+%@:    +@@-         :==+#@@@+ +@+  +%%#%@+=%*                                                                                          
                                                                                           ==+@@%+::- :+%=:#@%*#@@%=         #@@+    *#:-*--+-=%@@@@@@@@@@@@#-==:++:=%:   :%@@-        :#@@%**@@=:*%- :-:=*%@%-*:                                                                                          
                                                                                            :%@@@@%=   -%+:*@@@@@@@@=    :-  -%@@*:  -:-#:=%*-%@@@@@@@@@@@@@@*-#%-=*:-   -%@@*  :=    :#@@@@@@@%--#*:  :#@@@@@=                                                                                            
                                                                                            -@@@@@@%+  :**:+@@@@@@@@#:   *@%-  *@+:%%=:#*:%@*-@@@@@@@@@@@@@@@*=#@*-%=:#@+:%%-  +@%:   +@@@@@@@@#:=%=  -#@@@@@@#:                                                                                           
                                                                                       =    +%=#@@@@%-  -#=-#@@@@@@@@+   #@@@@#*-   *=-@#:*@%*-*%@@@@@@@@@@#==#@@=+%*:#-   +#%@@@%+  :%@@@@@@@@*:**   *@@@@@+*%:   :-                                                                                      
                                            +                                          -%+  +%=:%@@@%+:- =+-*@@@%=-=-:   #@@@@@# =@+   +%%=+%@@%%%@@@@@@@%%%%@@#-+%#-  -## =@@@@@%=   :-=-*@@@%==+:-::#@@@@+:#%: -#*                                                                                       
                                            ==                                          -@%--@* +@@@@+:++--:=%@*+#@@@@#: =%@@@%:=@@%%*=::-+**+*#@@@@@@@@@@@%#****=-:-+#%@@# +@@@@#  +%@@@%++%@*:--=*--#@@@%:-%#:*@*                                           =                                            
                                             %=                                         :=@%=## =@@@%+-++#+::*@%%@@@@@@*::+#@@--@@=-%@@@@@#*++**%@@@@@@@@@%#*+++*%@@@@@*-#@* #@%*= -@@@@@@@%%%= -#**=-#@@@*:-%=#@#:                                         :*=                                            
                                             =##+=-:                   -:               ==+@%** -%@@%+-#++@#-=%@@@@@@@@@- =*+=+@@- #@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@- #@#-+++::#@@@@@@@@@*:+%#+#+-#@@@+ -##%%-*                -:                   :-=*#*                                             
                                                 -+%%*-                :+-              +%-%@%+ :#@@%+-%%++@%=*@@@@@@@@@#:-%@@@@- =@@@@%%##%%@@@@@@@@@@@@@@@@@%%###%@@@@#  #@@@@* =@@@@@@@@@#=*@#+*@*-#@@@= :#@@=*%               ==                :+#%#=:                                                
                                                    -%%-                =#+             *@#+@%=  +@@@*-#@%+*@#+#@@@@%+==+= #@@@=  %@%*--=+=: :-*%@@@@@@@@@%#=: :-++=-+%@@-  %@@@-:*=-=#@@@@%*+@#+#@@+=%@@%-  #@%=%@:            -##                 *@+:                                                   
                                                     =@%-                *@%=           *@@=@%=  :*@@%++@@@**@#+%@@=-#@%+- :%@+  :@@@@@@@@@@@@%+::+@@@@@#-:=#@@@@@@@@@@@@*  :@@+  =*%%+-#@@*+@%*#@@#=*@@%=   #@+#@@:          :*@%=                *@#:                                                    
                                                     +@@@%#+=+##=:   -:  =%@@%+         -@@%#%= ==  :=+=+%@%#%@%##*%@@@@@@#:-# * =@@@@@@@#=+#%@@@@@@@@@@@@@@@@%*++%@@@@@@% =-=# =@@@@@@%#*%#@@##@@#=++-: :+: #@#@@*         -#@@@#   -:   -*#*==*%@@@%:                                                    
                                                     +@@%*#@@@@@@@%%%+-+=:+%@@@@#=       -@@@%= -%%#*=-   :=*%@@@@@@@@@@@@@#: +# +@@@@*-=*#*=:::=#@@@@@@@%*-::-+##+-=%@@@% -%: =@@@@@@@@@@%@@@#+-:  :-+#%@*: #@@@*:      :*%@@@@#::+=-#%%%@@@@@@%*#@@%:                                                    
                                                      =*#--%@@@@@%##%+:+@@@@@@%%@@@#*===*+-*@@*  =%@@@@@%#*=: -+%@@@*=*@@@@@+-%% =@@%##@@@@@@@%#*=+%@@@@#=+*%@@@@@@@%##@@% =@*:@@@@@%++%@@@#=: -+#%@@@@@@*: -%@%=-*+==+*%@@%%@@@@@@#--%%#%@@@@@@+:*%+:                                                     
                                                          :+*+=:      :+###%@@+:#@@@@@@@@@%*=+*-  :=#%@@@@@@@#=::+%@@%=-#@@@=*@@ -@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@# *@@:%@@%=:*@@@#- -*%@@@@@@@%*-   +*++#@@@@@@@@@@-:%@%###*-      :-+**-                                                          
                                                                            :== *@@@@@@@@@@@@@@%::=-: -+#%@@@@@%= -#@@@= +%@=*@@- @@@@@@@@%##*##%@@@@@@@@@@%#**#%@@@@@@@@+ %@@:%@#::#@@%+ -*@@@@@@%*=: :=- +%@@@@@@@@@@@@@@::*-                                                                            
                                                                                -++#%%@@@@@@@@@%: :#@%+-  -#@@@@@*- *@@*: -%*+@@* *@@@@@#+-*#*-: :=#@@@%*-  :+#*==*%@@@@@::@@%-@+  -@@%- =@@@@@%+: :=*%@+  +%@@@@@@@@%%#*+=:                                                                               
                                                                                       :+%@@@@@%=:-:#@@@@#= -#@@@@%- *@*:= :#-@@@ -@@@@@@@@@@@@@@%**%@@#*#@@@@@@@@@@@@@@# *@@**+ :--@%- +@@@@@+ :*@@@@%=:-:#@@@@@@#-                                                                                       
                                                                                     :@@#= =%@@@*:+*:+@@@@@*:-#@@@@*::#=-%=::**@@+ %@@@@@@@@@%%%@@@@@@@@@@@@%%@@@@@@@@@@= %@@== :#*:#+ =@@@@@* =%@@@@#--#--%@@@*::+%@+                                                                                     
                                                                                      %@@@@#==%@%--%%+-+%@@@+:+++%@@= =:*@#==-*@@% +@@@@@@#-=+=: :-*%@@#=:::-++-+%@@@@@% +@@#*:*=@%-=::#@@#=*--%@@@#--*@+:*@@*-*%@@@@-                                                                                     
                                                                                      %@@@@@@#+%@*:+%*%#**#@#-=#-=%@*: :%@@-%=+@@@+:%@@@%##%@@@@%#**#@%#*#%@@@@@%##@@@@=:%@@%:%**@@+  -@@*:**:+@%#*#%###--%@**%@@@@@@=                                                                                     
                                                                                     =@@@@@@@@%#@%=-#%+*@@@@@=-#+:+@#: -%@@+%@-#@@@--@@@@@@@@@#**#%@@@@@%#**#%@@@@@@@@*:#@@@-*@*%@@*  +@#:-%+:#@@@@%+*%+:#@%%@@@@@@@@#                                                                                     
                                                                                     #@@@@*=*%@@@@%--%@#*%@@@*-*#--%@+ :#@@%%@#=@@@%-=@@@@@#+==+=-::=#*-:-=====*%@@@@#:*@@@%-@@#@@%= -%@* +%==@@@%#*%@+:*@@@@@#+=%@@@@-                                                                                    
                                                                                    :@@@@@@%=::=*#%#=-*@@%%@@@+=#=:#@@*- -+#%@@+@@@@%==@@@##@@@@@@@%#%##@@@@@@@%*%@@#-*@@@@*%@@%*=::=%@%=:**-#@@@%@@%=-*%%#+-::*@@@@@@+         :                                                                          
                                                                          -#*-:::-+::@@@@@@@@@%*=-:::---*%%@@@%+=- *@@@@%+-:  -+%@%%@@+-%@@@@@%#+=+#@@@%*==*%@@@@@@+-%@%%@%#=: ::=#@@@@%-:==#@@@%%#=---:::-+#%@@@@@@@@* +-:::-+#*                                                                          
                                                                          :#@@@@@@@+ %@@@@@@@@@@@@@@@#=+%#**%@@@%= *@@@@@@@@@@%#= - +@@%=+@@%+=*%%+::*= -#@%+=#@@%=*@@%::::+%@@@@@@@@@@%-:*@@@%#**%#=+%@@@@@@@@@@@@@@@-:@@@@@@@%+                                                                          
                                                                           +%@@@@@@@--@@@@@@@@@@@@@@@@%**@@@@@@@@+:*@@@@@@@**@@@@@# *@@@@%#*@@@@@@@@@@@@@@@@@@@%*%@@@@@:=%@@@@%=@@@@@@@#:-%@@@@@@@%*#@@@@@@@@@@@@@@@@* #@@@@@@@#                                                                           
                                                                            -#@@@@@@@--@@@@@@@%+%@%*#@@%#@@@@@@@@*:+%@##%@@* *@@@@# %@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@==@@@@@:-@@@%*%@#:-@@@@@@@@#%@@@*#@@*#@@@@@@@*:#@@@@@@%+                                                                            
                                                               ::             :-====+%*-*@@@@@%+=@%*+@@@@@@@@@@@@*:+%@%*-+%* +@@@@%:#@@@@@#+++#%@@@@@@@@@@@@#*++*%@@@@@-+@@@@@ :@#-=#@@#:=@@@@@@@@@@@@%=#@#-#@@@@@%==%#====-:             ::                                                               
                                                               -*+:           :-+****==+++#@@@@#-+@#=%@@@@@%##*+++:=%#*%@*=- #@@@@@*=@@@%= =++-:*@@@@@@@@@%=:=++::#@@@%-%@@@@@: =+%@#*@# -*+**#%@@@@@@*+%#-+%@@@%*++==+***+=:            -*+                                                               
                                                               -#@%*=-----=*#%@@@@@@@@@%+#@@@@@@#-=%**@@%*-:      ::*@+:=%@= #@@@@@@*%@@# -@@@@*-#@@@@@@@@+-#@@@*:+%@@*%@@@@@@: %@#::#%=::      :=#@@%+##-=%@@@@@%+*@@@@@@@@@@%*+=----=+#@@+                                                               
                                                               :*@@@@@@@@@@@@@@@@@@@@@@@@%%@@@@@@%+-+*@@*+%@%#=:  :=-*@= =%#:=%@@%*+*%@@%:-@@@@%=+@@@@@@@#=*@@@@#:+@@@#++#@@@# =@# :%%=-=   -+%@@#+#@#*=-#@@@@@@@#@@@@@@@@@@@@@@@@@@@@@@@@%=                                                               
                                                          --    -#@@@@@%%%%%%%%%%@@@@@@@@@@@@%#+-:   :-+#%@@@@@*:  *%=+#: #@%-:#@= +=:#@%*+@@@@@*=%@@@@@@*+%@@@@#=%@@=-*: %%= +@%- +#-*#-  =@@@@@@%*=:    :=*%%@@@@@@@@@@@@%%%%%%%%%%@@@@%+    :=:                                                         
                                                           +%=    :*@@%#*++++=-:  +@@@@@@@%=        :*@@@%%@@@@%-: =%@@#- +%@@%= - @@*:@@@@@@@@@@*+@@@@@#*#@@@@@@@@@+=%@=:::#@@@%  +%@@# : +@@@@@%%@@%=:       :#@@@@@@@#:  :==++++*#@@%=    :*#-                                                          
                                                            =%@%##+:  :-==++++*#%%= *@@@@*:+#%%@@@@%%*--%@@@@@@@=:--#@@@+ -%@@@@@#:%@%++@@@@@@@@@@%%@@@%%@@@@@@@@@@%-#@@=+%@@@@@# :@@@%+:-:*@@@@@@@+-=#%@@@@%%%*--%@@@%::#%%*++++==-:  :=*#%%@*:                                                           
                                                              -*@@@@@%##*+++++=- :*#:=@@@@@@@@@@@@@@@#++=*@@@@@@+ =-+@@@*::%@@@@@@@*@@%=%@@@@@@@@%+*@@@%+*@@@@@@@@@+*%@##@@@@@@@+ -@@@#-=--#@@@@@#=+=*@@@@@@@@@@@@@@@# =#-::=++++++*#%%@@@@%+:                                                             
                                                                 :=+#%%%@@@@@@@@%+ -:-:#@@@@@@@@@@@@@#-+%**@@@@@*:++=%@@%: #@@@@@@@%%@@#*@@@%#@@@@#-*@%=+%@@@#%@@@%+%@@%@@@@@@@%- +@@@+-*:-@@@@@%*##-+%@@@@@@@@@@@@@+::= -#@@@@@@@@@@%#*=-:                                                                
                                                                          :-=+*%@@* -:+-=#@@@@@@@@@@@%=-#%#%@@@@%--#*+*%@+ :%@@@@@@@@@@%*@@%*+#@@@%+-%+-#@@@@=*#%@*%@@@@@@@@@@@+ :%@#++#+:+@@@@@##@+-*@@@@@@@@@@@%+-+=- -%@@#+=-:                                                                          
                                                                           :+#*=*%@- *:*%+=+*#####%@@@%+-*%@@@@@@*:+%@@@@@+ :*@@@@@@@@@@%%@#==*@@@@+-#+-#@@@@=+*%@%@@@@@@@@@@%= -%@@@@@#:-%@@@@@@#==#@@@%%####*+==*%-=- #@#==**-                                                                           
                                                                             :#@@%@* +%-=%@@@@@@@@@%##+=-:-*%@@@@@*:=#@@@@@#: -#@@@@@@@@@@%+--%@@@%==%*-#@@@@+=-#@@@@@@@@@@%+  =@@@@@%*:=%@@@@@#=::=+*#%@@@@@@@@@@*-*@ :@%%@%=                                                                             
                                                                               *@@@% -@@#:+%@@@@@@#-=+=:: -%%@@@@@@%+::::::--+:  *@@@@@@@%=:-+@@@@*-#@%+=%@@@#-::#@@@@@@@%-  -+-::-: :=#@@@@@@%%*: :-++-+%@@@@@@#-+@@# +@@@%-                                                                              
                                                                                *@@@= %@@@%=:*%@@@@@@@@@@*:=%@@@@@@@@@##%=%@@*::   :*%%#=   =@@@%+-%@@@@+-*@@@*:  -*%%#=   ::-@@%+%%+@@@@@@@@@@*:=%@@@@@@@@@@#=-*%@@@= %@@%-                                                                               
                                                                                 -#@% =@@@@@@%#*++*#%@@@@@+:*@@@#+*%@@**%-#@@=#%=         :*%#*=+###@@@%##*=+#%#=         :*%-@@%-*%-@@@#++@@@%=-#@@@@@%**+*#%%@@@@@# =@@+:                                                                                
                                                                                  :=*+ =@@@@@@@@@@#=@@@@@@%=:#@@@%+:-#*=%==%@%:=*#+  :-=*#@@@%#+==+*#@%**+==*%@@@%*+--  -*#+:+@@#:#*-%+:-#@@@%=:*@@@@@@#*%@@@@@@@@@#:-*+-                                                                                  
                                                                              :=*%@@@@%-:*@@@@@@@@%-+%@@@@@%*===+*##=:+:=*:=#@@*=--::###**+=-:  -+#%@@@@%*=: :--=+**#%=:--=+#@%*:=#:=-:*%*+===+#@@@@@@#-*@@@@@@@@%=:*@@@@@#+-                                                                              
                                                                            -+*+=++#@@@@#=:=#%@@@@@+  -========+*#%@%=:-:=#=::==-::=%@*-:=+=-:-*@@@@@@@@@@@%=:-=++--+%@*-:-==-:-**:-::#@@%*+========-: -#@@@@@%*--+%@@@%*+==++-                                                                            
                                                                           :-=*%@@@@@@@@@@@#=-=+*#%%+:-+*######*=::+%@+::::*%#*++*#*=::=%@#++#%@@@@@%%%%@@@@@%*+*%@*-:-+*#*++*%#= ::-#@#-:-+*######*=:-#%##+=-=*%@@@@@@@@@@@%*=-:                                                                          
                                                                       :=*%@@@@@@@@@@@%#*===+#%%%#*+++=::-+*#**##%*::#@#::-:    :::-+%%*=:          :::          :-+#%*=:       :- +@%= =%%#****+=::-+++*#%%%#*+==+#%@@@@@@@@@@@@@%+-:                                                                     
                                                                    :+*+==-:::-=*%@%+           :+%@@@@@@@%###%%+:*%- +%@*:       :*%-:=%@@@@@@@@@@@@@@@@@@@@@@@@@@*-:*#=   :    =%@#::*%=-#%%###%@@@@@@@*-           -#@@#=-::::---===-                                                                   
                                                                           =%@@@@+  -*%%%@@%+: :+= :+%@@@@@@@@@@= +@@#-   :::=*@@@@#:#@@@%#@@@@@@@@@@@@@@@@@@@@@%#%@@%=-@@@@%+-::    +%@#-:#@@@@@@@@@@#- -+-  -#%@@@%#=: -#@@@@*:                                                                          
                                                                        -*%@@@%==#%@@@@@@@@@@@%*::=*=:=#@@@@@@@*:=%@@@@%%%%%%%#=*@@*+@####*:-%@@@@@@@@@@@@@@@@*:=####%%=%@%-*%%%%%%%@@@@@#:-%@@@@@@@+::*+- =#%@@@@@@@@@@%%+-*@@@@%+                                                                        
                                                                      =#@@@@@@@@@@@@@@@@@@@@@@@@%*-:=#+:=#@@@@%=:#@@@@@@@@@@@@@@#%@@%#@@#%+*:*@@@@@@@@@@@@@@@%--**#%@%#%@@*@@@@@@@@@@@@@@%+:*@@@@%*:-**-:+%@@@@@@@@@@@@@@@@@@@@@@@@%+:                                                                     
                                                                    -#@@%#*+=====+*%@@@@@@@@@@@@%##*::*%+-=%@@@=:#%+--=+#@@@@@@@@%@@@#+=*+*%#%@@@@@@@@@@@@@@@@#%%=*+=*%@@@@@@@@@@@%*=--=*%+:#@@@*--#%=:=###@@@@@@@@@@@@%#*+=====+*%@@%+:                                                                   
                                                                  :*%*=:             -=+********#@@@%=:+%%+-=+**--+#*===::=%@@@@@@#=:=*%%*#*+=-=+#@@@@@@@%*====+*##%%+::+%@@@@@@*- -==+#*=:+**+-=#@#-:*@@@%*+******++=:            :-+##=                                                                  
                                                                 -*=                 #@@%%%@@@%#@@@@@%+:=%@@@@@@@%*+*%@@@#- *@@@%- =%@@@@@@@@%%*-:=%@@@@*-:+#%@@@@@@@@@#: #@@@%- +%@@%#++#@@@@@@@@*:-#@@@@@#%@@@%%%%@@:                :++:                                                                
                                                                ::                  -@@@@@@@@#+%@@@@@@@#:-#@@@@@@@*=-=*%@@@= #@@= +@@@@@@@@@@@@@@#-+@@@#=+%@@@@@@@@@@@@@%  @@@- %@@%#+-=+%@@@@@@%+ =%@@@@@@@**%@@@@@@@#                  :-                                                                
                                                                                   *@@@@@#=:=%@@@@@@@@@@%= +%@@@@@@@%+: :#@# +@@- = :=+++*#@@@@@@@@@@@@@@@@@@@@@%*++++- =  %@@ =@%=  -#@@@@@@@@#-:*@@@@@@@@@@@*:-*%@@@@%:                                                                                  
                                                                                 +%@*::-*%%@@@@@@@@%%@@@@@#- -+*+=:=#%##= =-+%@@*  - -**+= -@@@@@@@@@@@@@@@@@@@*:-+**+::- -@@@#:+ :##@%+:-+*+=::+%@@@@%%@@@@@@@@@%#=::=%@#-                                                                                
                                                                              -#%%=:+%@@@@@@%#*#@@%*%@@@@@@@%#**##%@@@##%= *= +@@* :=+:=%%+:*@@@@@@@@@@@@@@@@@%-:#@*--+- -%@%:-*::%%+@@@@%#**#%%@@@@@@@*#@@%*#%@@@@@@%#-:*@%+:                                                                             
                                                                           -*%@@#:=%@%*=--==+*#@%*+#@@@@@@@@@@@%**%@@@%+%#:-%- %@@%= :-=+++:=@@@@@@@@@@@@@@@@@#:=+++=- :*@@@= ## =@#+@@@@#*#%@@@@@@@@@@@*+#@%#*+=---+#@@* =@@@#+:                                                                          
                                                                        -+%@@@@#:+#+-=*#%@@%#*+==*@@@@@@%##*+++*%@@@@@%-#@- #+ +@@@@%*=- -*==@@@@@@@@@@@@@@@@@#-#=::-+#@@@@@  %- #@+*@@@@@@#++++*#%%@@@@@%+==+*%@@@%*+-=##:=@@@@@#=                                                                        
                                                                      :*@@@@@@%:-=-*@@@%*=--=*%%#*+======+*#%@@@@@@@%#%++%%::*::%%*@@@@@@@%++@@@@@@@@@@@@@@@@@%=#@@@@@@@##@= += +@%-%##%@@@@@@@%*++=====+*#%%#+=--+#%@@%=-+ +@@@@@@%=                                                                      
                                                                     +%@@@@%@@= :*@@%*::+%@@@@@@@@@@@@@@@@@@@@@%%#**%@@#-%@%- =: +*:+%@@@@%#%%#%@@@@@@@@@@@@%#@*#%@@@%*-=#- -::*@%+=@@@#+*#%@@@@@@@@@@@@@@@@@@@@@@*-:=#@@%=  #@@@@@@@#:                                                                    
                                                                    +@@@%*:-#*:=@@@+ -%@@%%%##**###########*+---*%@@@@@%:+%@@*: :  -+-:=*+: -%#-:--:::::--::*%+::-*+-:==  :: =@@@%:*@@@@@@%+--=+*#########**###%%%%@@* -%@@#:-%+:=#@@@#-                                                                   
                                                                   =%@@+::#@%-#@@* -%#=    -==+++*******#%%@@@@@@@@@@@@@=:%@@@-*:  =-  -#@@#::*@@@@@@@@@@@@@%= +@@%+: :=-  +-%@@%+:%@@@@@@@@@@@@@%##*******+++=-:   -*@+ -@@@++@%= -%@@#:                                                                  
                                                                  :*@@+ :#@%#@@%- =: :+%%@@@@%#+=-::      ::-+*%@@@@@@@@#:+@@@-*:**:: :==-::-=-:-=**#@%#*+=::-=::-==-: :-%:#:#@@%:=@@@@@@@@@#*=-::     :::-+*%@@@@@%#=  -- *@@%#@%+ -%@%=                                                                  
                                                                  :#@@=  -#%@@#:  :*%@@#*=::  -=+***##%%%%%%#*+=::-*%@@@@-:%@@=+-+*+@%#*=-====*%%###@@@%##%%#+====-*#%@@-% # %@@+ #@@@@#=-:-+*##%%%%%%#****+=:  :-+#%@@#=   +@@@%*: :*@%=                                                                  
                                                                   -#@*:   :-=:  :--::  :::::::   :::::::-=*%@@@@%#*==+#@+ *@@+-+-+=@@@%+#+----:::::*@%= ::::---=*#*%@@%:*:* @@%::@%*==+#%@@@@@#+-::::::::   :::::::  :---  :-=-    -%%+                                                                   
                                                                    :+%#=:                       ::-=+#%%#*=-=+%@@@@@@#+++:=%@# * ==@@%=+#*=@@#--#%=:=- *%+:+%@#+##-#@@#:--=-@@# -*+*%@@@@@%*=-=+*#%#*+=-:                        :+%#-                                                                    
                                                                      -*@#*+=:             -+%@@@%%#+=::-*%@@%*==*%@@@@@@@-:%@% +: -@@#:= :-##- =*%%+-=*%#=: +%=::--+%@#  * +@@+ *@@@@@@@%+=+%@@@#=::-=*#%%@@%#=:             -+++@%=                                                                      
                                                                        =+#@#:           -%@%+-   :-+#%%*::+%@@@@*=#@@@@@@= #@@=:* -@@*-%-%#-- +%=:*%%%#-:*#-:-=%=*+-%@# -+ %@@-:%@@@@@%++%@@@@#-:=#%#*=:   :=#@@+            =@%=*:                                                                       
                                                                          -%=           :@@*            +%*:-#@@@@@#*%@@@@+ *@@# + =@%-=%=-@#: +@@*:    =%@#- +%*:*#:*@# + -@@%::@@@@@#+@@@@@@+ =%#-           -%@+           :%*                                                                          
                                                                           *-           =@@:             :*#-=%@@@@@@#%@@%- #@@@-  #@* *@# +@@#%@@@@@@@@@@@%#%@#:-%@--%@-  %@@%- +@@@#%@@@@@@*:+%=              *@#           :#:                                                                          
                                                                            :           :%@+              :-: ::----===+- :+##*+: *@%:-@@%-:%@@@@@@@%##%@@@@@@@= *@@*:+@%- -*##*- :====----::: ::              :%@+            :                                                                           
                                                                                         :+%#-        :==+++=======++*++===---=+#%@+:-#**%=:#@@@@@@%+++*@@@@@@@= ##+*+ -#@%*=----==+++*++=======++==-:       :+%#-                                                                                         
                                                                                            :--::::::::   :-:        ::-==+****+=-   :: +#:-%@@@@@@%+=+*@@@@@@@+:+#::::  :=+****++=-::         ::    :::::::--:                                                                                            
                                                                                                         -%#-      -#%+---==--==  : =#%:#+ =%@@@@@@%+-=*@@@@@@@#::#=*%*- : -=--===-=-#@%+      =%*                                                                                                         
                                                                                                        =%#-      -%@+=#+*+#@@@@: -%@@%-+: :*@@@@@@@+:=#@@@@@@@= :==*@@@+  *@@@%*+#**-%@%+      =%*:                                                                                                       
                                                                                                    :-+##=       -#@++#-*@@=+%@% :@@@@*-*# =@@@@@@@@+ -#@@@@@@@#:=#==#@@@+ +@@#-%@%=+#=#@%+      :+%#=:                                                                                                    
                                                                                               -+##*+-          =#%=: =%@@%=+:%@: @@@=+@%+:*@@@@@@@@+-=#@@@@@@@@-:#@%-#@@= *@+-+*@@@*::-#@#-         :-+##*=:                                                                                              
                                                                                           -=:                    :+%%%*-:+%@+ #= *@=%@@%-:%@@@@@@@%#%##@@@@@@@@= *@@@+#@: @=:@@#-:+#%%*-:                    -=:                                                                                          
                                                                                                             -*#*+-:   :*%@@%== * -*%@@@%-:%@@@@@@@@@@@@@@@@@@@@= *@@@@** ==:++@@@%=   :-=+##+:                                                                                                            
                                                                                                          -*#+-::     -#@#=: #%::- *@@@@%= :*#=*@@@@@@@@@@@%=+#=  #@@@@@: + #@- -+%%*     :::=*#=:                                                                                                         
                                                                                                         -+- :+#=    +%#-   =@@* + :%@@@@*   : :#%*#@@@%*#@= :   -%@@@@+ =::@@#   :+%#-   :*#= :==:                                                                                                        
                                                                                                             =%+    *#=     #@@% -* -%@@@%=:=-=--=:+@@@#--=:+---:#@@@@* -* +@@@-    :*#-   -#*                                                                                                             
                                                                                                             +*:   +*:     :%@@@: @*::#@@@%-:+#%-  :*@%+  :*@+=:+%@@%+ -%+ #@@@+      =#:   =#:                                                                                                            
                                                                                                             +=   :=:      -%@@@= #@%= :*%%#:-#@@#- -#+::+%@@+ +%%#= :#@@- @@@@*       -=   :=-                                                                                                            
                                                                                                             ::            :%@@@* =@@@@#=:      :-+%@%%@#=:       -+%@@@% -@@@@+             ::                                                                                                            
                                                                                                                            *@@@@  @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@+ *@@@%:                                                                                                                           
                                                                                                                             #@@@+ =@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@% :%@@@-                                                                                                                            
                                                                                                                              #@@@= +@@@@@@@@@%#***#@@%#*+++*#@@@@@@@@#::#@@@-                                                                                                                             
                                                                                                                              :%@@*  :+***+=:  -==-:  ::--==-: :=+***- ::@@@+                                                                                                                              
                                                                                                                               +@@-:%*-       =%%*=#%@@@%+*@@+      :=#+ #@%                                                                                                                               
                                                                                                                               :@#  #@*      :+#++-*+%%%%=+%#+:     -%@- -@+                                                                                                                               
                                                                                                                                @-  =@*       =#=*-+=*###-+++=      -%%   #=                                                                                                                               
                                                                                                                                +    #%:      -*=+-=*=++=-*=+-      *%-   :+                                                                                                                               
                                                                                                                               :     :##       -+=*:+#+=:*++=      =%=     :                                                                                                                               
                                                                                                                                      :**:     :+*= -**- =++:     =#-                                                                                                                                      
                                                                                                                                        =*:     -#=  ++  -*-     =+:                                                                                                                                       
                                                                                                                                         :=     :-    :   -:    --                                                                                                                                         
                                                                                                                                                                                                                                                                                                           
                                                                                                                                                                                                                                                                                                           
                                                                                                                                                                                                                                                                                                           
                                                                                                                                                                                                                                                                                                           
                                                                                                                                                                                                                                                                                                           
                                                                                                                                                                                                                                                                                                           
                                                                                                                                                                                                                                                                                                           
`;

function useOneScrollToDiscord(enabled: boolean) {
    useEffect(() => {
        if (!enabled) return;
        let locked = false;
        let touchStartY = 0;

        const goTo = (direction: 1 | -1) => {
            if (locked) return;
            const targetId = direction > 0 ? 'discord' : 'top';
            const target = document.getElementById(targetId);
            if (!target) return;
            locked = true;
            window.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
            window.setTimeout(() => { locked = false; }, 850);
        };

        const onWheel = (event: WheelEvent) => {
            if (Math.abs(event.deltaY) < 4) return;

            const target = event.target as HTMLElement | null;
            if (target?.closest('.affiliate-grid')) return;

            event.preventDefault();
            if (locked) return;
            const atTop = window.scrollY < window.innerHeight * 0.5;
            if (atTop && event.deltaY > 0) goTo(1);
            else if (!atTop && event.deltaY < 0) goTo(-1);
        };

        const onTouchStart = (event: TouchEvent) => {
            touchStartY = event.touches[0]?.clientY ?? 0;
        };

        const onTouchEnd = (event: TouchEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest('.affiliate-grid')) return;
            if (locked) return;
            const endY = event.changedTouches[0]?.clientY ?? touchStartY;
            const delta = touchStartY - endY;
            if (Math.abs(delta) < 35) return;
            const atTop = window.scrollY < window.innerHeight * 0.5;
            if ((atTop && delta > 0) || (!atTop && delta < 0)) goTo(delta > 0 ? 1 : -1);
        };

        window.addEventListener('wheel', onWheel, { passive: false });
        window.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('touchend', onTouchEnd, { passive: true });

        return () => {
            window.removeEventListener('wheel', onWheel);
            window.removeEventListener('touchstart', onTouchStart);
            window.removeEventListener('touchend', onTouchEnd);
        };
    }, [enabled]);
}

function Intro({ onEnter }: { onEnter: () => void }) {
    const [phase, setPhase] = useState<'idle' | 'dragon' | 'eat' | 'done'>('idle');

    useEffect(() => {
        if (phase !== 'dragon') return;
        const t = window.setTimeout(() => setPhase('eat'), 520);
        return () => window.clearTimeout(t);
    }, [phase]);

    useEffect(() => {
        if (phase !== 'eat') return;
        const t = window.setTimeout(() => {
            setPhase('done');
            onEnter();
        }, 700);
        return () => window.clearTimeout(t);
    }, [phase, onEnter]);

    if (phase === 'done') return null;

    const handleClick = () => {
        if (phase === 'idle') setPhase('dragon');
    };

    return (
        <div className={`ascii-intro ascii-intro--${phase}`} role="dialog" aria-label="Website entrance">
            <button
                type="button"
                className="ascii-stage"
                onClick={handleClick}
                aria-label="Click the DivineBlood logo to enter krammy.xyz"
            >
                <div
                    className="ascii-art ascii-art--divine"
                    dangerouslySetInnerHTML={{ __html: DIVINEBLOOD_ASCII_HTML }}
                />
                <pre className="ascii-art ascii-art--dragon ascii-art--dragon-fast" aria-hidden="true">{DRAGON_ASCII}</pre>
                <span className="ascii-enter">CLICK TO ENTER</span>
            </button>
        </div>
    );
}

function ViewCounter({ code }: { code: string }) {
    const [count, setCount] = useState<string>('—');

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const path = encodeURIComponent(window.location.pathname || '/');
                const response = await fetch(`https://${code}.goatcounter.com/counter/${path}.json`, {
                    cache: 'no-store',
                });
                if (!response.ok) return;
                const data = await response.json();
                if (!cancelled && data?.count != null) setCount(String(data.count));
            } catch {
                // Keep the placeholder if the counter is unavailable.
            }
        };

        load();
        const timer = window.setInterval(load, 30_000);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [code]);

    return <span>VIEWS — {count}</span>;
}

function openExternal(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer');
}

function App() {
    const [entered, setEntered] = useState(false);
    const playlist = profile.youtubeMusicPlaylist?.length
        ? profile.youtubeMusicPlaylist
        : [profile.youtubeMusic];
    const [trackIndex, setTrackIndex] = useState(0);
    const currentTrack = playlist[trackIndex] || playlist[0];
    const lanyard = useLanyardProfile(profile.discordId);
    const hasDiscordServers = Boolean(profile.discordServers?.length);
    useOneScrollToDiscord(entered && hasDiscordServers);

    const displayName = lanyard?.displayName || profile.name;
    const username = lanyard?.username ? `@${lanyard.username}` : profile.username;
    const avatar = lanyard?.avatar || profile.avatar;
    const banner = profile.banner;
    const status = lanyard?.status || 'offline';

    return (
        <div className="site" style={{ backgroundImage: `url("${profile.background}")` }}>
            <div className="background-overlay" />
            <div className="background-vignette" />
            <div className="background-noise" />

            {!entered && <Intro onEnter={() => setEntered(true)} />}

            {entered && (
                <main className="content">
                    <section className="hero-section" id="top" aria-label="Krammy profile">
                        <div className="main-layout">
                            <YoutubeMusicPanel
                                key={trackIndex}
                                track={currentTrack}
                                onEnded={() => setTrackIndex((index) => (index + 1) % playlist.length)}
                            />

                            <section className="profile-card">
                                <div className="banner-wrap">
                                    {banner ? (
                                        <img src={banner} alt="" className="profile-banner" data-testid="img-profile-banner" />
                                    ) : null}
                                    <div className="top-view-counter">
                                        {profile.goatcounterCode ? <ViewCounter code={profile.goatcounterCode} /> : null}
                                    </div>
                                </div>

                                <div className="avatar-wrap">
                                    <img src={avatar} alt={`${displayName} avatar`} className="avatar" data-testid="img-profile-avatar" />
                                    {lanyard?.decoration ? (
                                        <img className="avatar-decoration" src={lanyard.decoration} alt="" aria-hidden="true" />
                                    ) : null}
                                    <span className={`lanyard-status ${status}`} aria-label={`Discord status: ${status}`} data-testid="status-discord" />
                                </div>

                                <h1 style={{ fontFamily: `'${profile.nameFont}', serif` }} data-testid="text-display-name">
                                    {displayName}
                                </h1>

                                <div className="profile-identity-row">
                                    <div className="username" data-testid="text-username">{username}</div>
                                    <DiscordBadges flags={lanyard?.publicFlags ?? 0} />
                                </div>

                                {profile.bio ? (
                                    <p className="bio" data-testid="text-profile-bio">
                                        {profile.bio.split('\n').map((line, index) => (
                                            <span key={`${line}-${index}`}>
                                                {line}
                                                {index < profile.bio.split('\n').length - 1 && <br />}
                                            </span>
                                        ))}
                                    </p>
                                ) : null}

                                {profile.socials?.some((social) => Boolean(social.url)) ? (
                                    <div className="socials">
                                        {profile.socials.filter((social) => Boolean(social?.url)).map((social) => (
                                            <button
                                                type="button"
                                                onClick={() => openExternal(social.url)}
                                                aria-label={social.label}
                                                data-testid={`link-social-${social.label.toLowerCase()}`}
                                                key={`${social.label}-${social.url}`}
                                            >
                                                <SocialIcon label={social.label} />
                                                <span className="sr-only">{social.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                            </section>

                            <aside className="affiliate-panel">
                                <div className="section-title">AFFILIATES</div>
                                {profile.affiliates?.length ? (
                                    <div className="affiliate-grid" onWheel={(event) => event.stopPropagation()} onTouchStart={(event) => event.stopPropagation()} onTouchEnd={(event) => event.stopPropagation()}>
                                        {profile.affiliates.filter(Boolean).map((affiliate) => (
                                            <button
                                                type="button"
                                                key={`${affiliate.banner}-${affiliate.url}`}
                                                onClick={() => openExternal(affiliate.url)}
                                                className="affiliate-link"
                                                data-testid={`link-affiliate-${affiliate.banner}`}
                                            >
                                                <img src={affiliate.banner} alt="" />
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="panel-empty">Add your friends&apos; banner images and links in member.ts.</div>
                                )}
                            </aside>
                        </div>
                    </section>

                    {hasDiscordServers ? (
                        <section className="discord-section page-section" id="discord" aria-label="Discord communities">
                            <div className="discord-inner">
                                <div className="section-heading">
                                    <span />
                                    <h2>HSV</h2>
                                    <span />
                                </div>
                                <div className="discord-grid">
                                    {profile.discordServers.filter(Boolean).map((server) => (
                                        <button
                                            type="button"
                                            key={`${server.banner}-${server.url}`}
                                            onClick={() => openExternal(server.url)}
                                            className="discord-card"
                                            data-testid={`link-discord-server-${server.banner}`}
                                        >
                                            <img src={server.banner} alt="" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </section>
                    ) : null}
                </main>
            )}
        </div>
    );
}

export default App;
