"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageIcon, RefreshCw, FolderOpen } from "lucide-react";
import type { Photo, PhotoGroup } from "@/types/photo";

export default function PhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [groups, setGroups] = useState<PhotoGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = async () => {
    try {
      const res = await fetch("/api/pocketbase/groups?limit=50");
      const data = await res.json();
      setGroups(data.groups || []);
    } catch (err) {
      console.error("Failed to fetch groups:", err);
    }
  };

  const fetchPhotos = async (groupId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (groupId && groupId !== "all") {
        params.set("groupId", groupId);
      }
      const res = await fetch(`/api/pocketbase/photos?${params}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setPhotos(data.photos || []);
      }
    } catch (err) {
      setError("사진을 불러오는데 실패했습니다");
      console.error("Failed to fetch photos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchPhotos();
  }, []);

  useEffect(() => {
    fetchPhotos(selectedGroup);
  }, [selectedGroup]);

  const handleRefresh = () => {
    fetchPhotos(selectedGroup);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">사진 브라우저</h1>
          <p className="text-muted-foreground">
            PocketBase에서 사진을 조회합니다
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="w-[200px]">
              <FolderOpen className="mr-2 h-4 w-4" />
              <SelectValue placeholder="그룹 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 사진</SelectItem>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-0">
                <Skeleton className="aspect-[3/4] w-full rounded-t-lg" />
                <div className="p-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="mt-2 h-3 w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ImageIcon className="h-16 w-16 text-muted-foreground/50" />
          <p className="mt-4 text-lg font-medium">사진이 없습니다</p>
          <p className="text-sm text-muted-foreground">
            Field Uploader에서 사진을 업로드해주세요
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <Card key={photo.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="relative aspect-[3/4] bg-muted">
                  {photo.thumbnailUrl || photo.imageUrl ? (
                    <Image
                      src={photo.thumbnailUrl || photo.imageUrl || ""}
                      alt={photo.title || "사진"}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate font-medium">
                    {photo.title || "(제목 없음)"}
                  </p>
                  {photo.groupTitle && (
                    <p className="truncate text-sm text-muted-foreground">
                      {photo.groupTitle}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="text-center text-sm text-muted-foreground">
        총 {photos.length}개 사진
      </div>
    </div>
  );
}
