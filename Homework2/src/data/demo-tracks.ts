export interface DemoTrack {
  id: number;
  name: string;
  url: string;
  delay: number;
}

export const demoTracks: DemoTrack[] = [
  { id: 1, name: "Track A", url: "demo://track-a", delay: 1200 },
  { id: 2, name: "Track B", url: "demo://track-b", delay: 300 },
  { id: 3, name: "Track C", url: "demo://track-c", delay: 600 },
];
