export type SocialLink = {
    label: string;
    url: string;
};

export type Affiliate = {
    banner: string;
    url: string;
};

export type DiscordServer = {
    banner: string;
    url: string;
};

export type YoutubeMusic = {
    url: string;
    title: string;
    artist: string;
    album?: string;
    artwork?: string;
    lyricsFile?: string;
};

export const profile = {
    discordId: '1448074479510097960',

    goatcounterCode: '',

    name: 'KRAMMY',
    username: '@krammy',
    nameFont: 'Cinzel Decorative',
    bio: `High Authority`,

    background: '/assets/bg.gif',
    banner: '/assets/banner.gif',

    // 5-song playlist
    youtubeMusicPlaylist: [
        {
            url: 'https://youtu.be/Zzl20a6AmRE?si=MopNZX2YSYbpPpgM',
            title: 'MAKE IT TO THE MORNING',
            artist: 'PARTYNEXTDOOR',
            artwork: '/assets/cover.png',
            lyricsFile: '/assets/lyrics.lrc',
        },
        {
            url: 'https://youtu.be/vMGpBAOD2CI?si=YBPYxIJQTyJYNgou',
            title: 'TRUST ISSUES',
            artist: 'DRAKE',
            artwork: '/assets/cover2.png',
            lyricsFile: '/assets/lyrics2.lrc',
        },
        {
            url: 'https://youtu.be/JDb3ZZD4bA0?si=11pfaQFca3-6Duan',
            title: 'MARVINS ROOM',
            artist: 'DRAKE',
            artwork: '/assets/cover3.jpg',
            lyricsFile: '/assets/lyrics3.lrc',
        },
        {
            url: 'https://www.youtube.com/watch?v=QHx1-CM1nvk&list=RDQHx1-CM1nvk&start_radio=1',
            title: 'DREAMIN',
            artist: 'PARTYNEXTDOOR',
            artwork: '/assets/cover4.jpg',
            lyricsFile: '/assets/lyrics4.lrc',
        },
        {
            url: 'https://www.youtube.com/watch?v=kMuwTPwrvh8&list=RDkMuwTPwrvh8&start_radio=1',
            title: 'B.E.D.',
            artist: 'JACQUEES',
            artwork: '/assets/cover5.jpg',
            lyricsFile: '/assets/lyrics5.lrc',
        },
    ] as YoutubeMusic[],

    // Keeps compatibility with the existing player code
    youtubeMusic: {
        url: 'https://youtu.be/Zzl20a6AmRE?si=MopNZX2YSYbpPpgM',
        title: 'MAKE IT TO THE MORNING',
        artist: 'PARTYNEXTDOOR',
        artwork: '/assets/cover.png',
        lyricsFile: '/assets/lyrics.lrc',
    } as YoutubeMusic,

    socials: [
        {
            label: 'Instagram',
            url: 'https://www.instagram.com/lvr.krammy?igsh=MWhsNnBsZ3QzNTliaw%3D%3D&utm_source=qr',
        },
        { label: 'TikTok', url: '' },
        { label: 'YouTube', url: '' },
        { label: 'Twitch', url: '' },
        { label: 'Kick', url: '' },
        { label: 'Discord', url: '' },
    ] as SocialLink[],

    affiliates: [
        {
            banner: '/assets/db.png',
            url: 'https://divineblood.xyz',
        },
        {
            banner: '/assets/y2k.gif',
            url: 'https://xoy2k.club',
        },
        {
            banner: '/assets/xorev.jpg',
            url: 'https://helloxorev.com',
        },
        {
            banner: '/assets/revshit.png',
            url: 'https://revshit.org',
        },
    ] as Affiliate[],

    discordServers: [
        {
            banner: '/assets/y2k.gif',
            url: 'https://discord.gg/TavER9UdDf',
        },
        {
            banner: '/assets/revshit.gif',
            url: 'https://discord.gg/revshit',
        },
        {
            banner: '/assets/onlyfuns.gif',
            url: 'https://discord.gg/Zr5x69FMnm',
        },
        {
            banner: '/assets/xorev.png',
            url: 'https://discord.gg/xorev',
        },
    ] as DiscordServer[],
};