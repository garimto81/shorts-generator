import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Image, Clock, TrendingUp, PlusCircle } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">대시보드</h1>
          <p className="text-muted-foreground">
            Shorts Generator 현황을 한눈에 확인하세요
          </p>
        </div>
        <Button asChild>
          <Link href="/videos/create">
            <PlusCircle className="mr-2 h-4 w-4" />
            새 영상 만들기
          </Link>
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">생성된 영상</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              전체 생성 영상 수
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">사용 가능한 사진</CardTitle>
            <Image className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">
              PocketBase 사진 수
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">대기 중 작업</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              큐에 대기 중인 작업
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">오늘 생성</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              오늘 생성된 영상 수
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 빠른 시작 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>빠른 시작</CardTitle>
            <CardDescription>
              영상 생성을 시작해보세요
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                1
              </div>
              <div>
                <p className="font-medium">사진 선택</p>
                <p className="text-sm text-muted-foreground">
                  PocketBase에서 영상에 사용할 사진을 선택합니다
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                2
              </div>
              <div>
                <p className="font-medium">설정 선택</p>
                <p className="text-sm text-muted-foreground">
                  템플릿, 전환효과, 자막 옵션을 설정합니다
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                3
              </div>
              <div>
                <p className="font-medium">영상 생성</p>
                <p className="text-sm text-muted-foreground">
                  생성 버튼을 클릭하면 영상이 자동으로 만들어집니다
                </p>
              </div>
            </div>
            <Button asChild className="w-full">
              <Link href="/videos/create">
                <PlusCircle className="mr-2 h-4 w-4" />
                영상 생성 시작하기
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>최근 영상</CardTitle>
            <CardDescription>
              최근에 생성된 영상 목록
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Video className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-sm text-muted-foreground">
                아직 생성된 영상이 없습니다
              </p>
              <Button variant="link" asChild className="mt-2">
                <Link href="/videos/create">첫 영상 만들기</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
