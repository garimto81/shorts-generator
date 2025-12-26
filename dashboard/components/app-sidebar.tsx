"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Video,
  Image,
  FolderOpen,
  ListTodo,
  Settings,
  Palette,
  Type,
  Sparkles,
  BarChart3,
  Home,
  PlusCircle,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

const navigation = {
  main: [
    { name: "대시보드", href: "/", icon: Home },
    { name: "새 영상 만들기", href: "/videos/create", icon: PlusCircle },
  ],
  videos: [
    { name: "영상 목록", href: "/videos", icon: Video },
    { name: "작업 현황", href: "/jobs", icon: ListTodo },
  ],
  photos: [
    { name: "사진 브라우저", href: "/photos", icon: Image },
    { name: "그룹 관리", href: "/photos/groups", icon: FolderOpen },
  ],
  settings: [
    { name: "템플릿", href: "/settings/templates", icon: Palette },
    { name: "자막 스타일", href: "/settings/subtitle", icon: Type },
    { name: "AI 설정", href: "/settings/ai", icon: Sparkles },
  ],
  analytics: [
    { name: "통계", href: "/analytics", icon: BarChart3 },
  ],
}

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-4">
        <Link href="/" className="flex items-center gap-2">
          <Video className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">Shorts Generator</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.main.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>영상</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.videos.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>사진</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.photos.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>설정</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.settings.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>분석</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.analytics.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
