export interface Photo {
  id: string;
  title: string;
  groupId: string | null;
  groupTitle: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  created: string;
}

export interface PhotoGroup {
  id: string;
  title: string;
  photoCount?: number;
  created: string;
}

export interface FetchPhotosOptions {
  limit?: number;
  groupId?: string;
  since?: string;
}

export interface FetchGroupsOptions {
  limit?: number;
  since?: string;
}
