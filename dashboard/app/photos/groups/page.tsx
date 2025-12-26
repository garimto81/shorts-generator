"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderOpen, RefreshCw, ArrowRight } from "lucide-react";
import type { PhotoGroup } from "@/types/photo";

export default function GroupsPage() {
  const [groups, setGroups] = useState<PhotoGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pocketbase/groups?limit=50");
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setGroups(data.groups || []);
      }
    } catch (err) {
      setError("그룹을 불러오는데 실패했습니다");
      console.error("Failed to fetch groups:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">그룹 관리</h1>
          <p className="text-muted-foreground">
            사진 그룹(제품)을 관리합니다
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchGroups}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FolderOpen className="h-16 w-16 text-muted-foreground/50" />
          <p className="mt-4 text-lg font-medium">그룹이 없습니다</p>
          <p className="text-sm text-muted-foreground">
            Field Uploader에서 그룹을 생성해주세요
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {groups.map((group) => (
            <Card key={group.id} className="hover:bg-accent/50 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-primary" />
                  {group.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {new Date(group.created).toLocaleDateString("ko-KR")}
                </p>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/photos?groupId=${group.id}`}>
                    사진 보기
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="text-center text-sm text-muted-foreground">
        총 {groups.length}개 그룹
      </div>
    </div>
  );
}
