import { BookList } from '@/components/BookList';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { FileScan, Library, Users, Settings, Sparkles, BookOpen } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const menuItems = [
    {
      title: '在线书城',
      description: '发现灵感，导入书籍',
      icon: <Library className="w-5 h-5" />,
      href: '/bookstore',
    },
    {
      title: '网文天赋测试',
      description: '测测你的创作潜力',
      icon: <Sparkles className="w-5 h-5" />,
      href: '/talent-test',
    },
    {
      title: '网文审稿',
      description: 'AI 模拟资深编辑反馈',
      icon: <FileScan className="w-5 h-5" />,
      href: '/review',
    },
    {
      title: '创作社区',
      description: '发现优秀的 AI 角色',
      icon: <Users className="w-5 h-5" />,
      href: '/community',
    },
    {
      title: '书源管理',
      description: '配置你的专属书库',
      icon: <Settings className="w-5 h-5" />,
      href: '/settings',
    },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="flex flex-1 flex-col md:flex-row container mx-auto">
        {/* 左侧边栏 */}
        <aside className="w-full md:w-72 border-b md:border-b-0 md:border-r bg-card/10 p-4 md:p-6 space-y-6">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-2">
              功能导航
            </h2>
            <nav className="flex flex-col gap-1">
              {menuItems.map((item) => (
                <Link key={item.href} href={item.href} passHref>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 h-auto py-3 px-3 hover:bg-primary/10 hover:text-primary transition-all group"
                  >
                    <div className="bg-primary/10 p-2 rounded-lg group-hover:bg-primary/20 transition-colors">
                      {item.icon}
                    </div>
                    <div className="flex flex-col items-start overflow-hidden">
                      <span className="font-medium text-base">{item.title}</span>
                      <span className="text-xs text-muted-foreground truncate w-full">
                        {item.description}
                      </span>
                    </div>
                  </Button>
                </Link>
              ))}
            </nav>
          </div>

          <div className="hidden md:block p-4 rounded-xl bg-primary/5 border border-primary/10">
            <div className="flex items-center gap-2 mb-2 text-primary">
              <BookOpen className="w-4 h-4" />
              <span className="text-xs font-bold uppercase">创作贴士</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              使用左侧导航快速访问工具。中间区域是你的私人书架，存放着所有正在创作或阅读的作品。
            </p>
          </div>
        </aside>

        {/* 中间主内容区 */}
        <main className="flex-1 p-4 md:p-8 lg:p-10 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
              我的书架
            </h1>
          </div>
          <BookList />
        </main>
      </div>
    </div>
  );
}
