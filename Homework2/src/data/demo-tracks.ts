
export interface DemoTrack {
  id: number;
  name: string;
  url: string;
}

export const demoTracks: DemoTrack[] = [
  {
    id: 1,
    name: "Track A",
    url: "/audio/track-a.mp3",
  },
  {
    id: 2,
    name: "Track B",
    url: "/audio/track-b.mp3",
  },
  {
    id: 3,
    name: "Track C",
    url: "/audio/track-c.mp3",
  },
];
