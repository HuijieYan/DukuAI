export type Region = { x: number; y: number; w: number; h: number };
export type ComparisonResult = {
  id: string;
  createdAt: string;
  width: number;
  height: number;
  threshold: number;
  diffPercentage: number;
  ignoreRegions: Region[];
  urls: { before: string; after: string; diff: string };
};
