
'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ArrowRight, List, Zap } from 'lucide-react';
import type { BookstoreChapterContent, BookstoreChapter } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ForesightManager } from 'js.foresight';

function ChapterReader() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialUrl = searchParams?.get('url') || '';
    const sourceId = searchParams?.get('sourceId') || '';
    const bookUrl = searchParams?.get('bookUrl') || '';
    
    const [currentUrl, setCurrentUrl] = useState(initialUrl);
    const [chapter, setChapter] = useState<BookstoreChapterContent | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [bookChapters, setBookChapters] = useState<BookstoreChapter[]>([]);
    const [isForesightEnabled, setIsForesightEnabled] = useState(false);
    
    const scrollRef = useRef<HTMLDivElement>(null);
    const nextBtnRef = useRef<HTMLButtonElement>(null);
    const prevBtnRef = useRef<HTMLButtonElement>(null);
    const tocBtnRef = useRef<HTMLButtonElement>(null);

    // Fetch book chapters once to enable robust navigation
    useEffect(() => {
        async function fetchBookTOC() {
            if (!bookUrl || !sourceId) return;
            try {
                const res = await fetch(`/api/bookstore/book?url=${encodeURIComponent(bookUrl)}&sourceId=${sourceId}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.success && data.book?.chapters) {
                        setBookChapters(data.book.chapters);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch book TOC for navigation', err);
            }
        }
        fetchBookTOC();
    }, [bookUrl, sourceId]);

    // Function to fetch chapter content
    const fetchChapter = async (fetchUrl: string) => {
        setIsLoading(true);
        setError(null);
        setCurrentUrl(fetchUrl);
        
        // Update URL in browser
        const newParams = new URLSearchParams(searchParams?.toString());
        newParams.set('url', fetchUrl);
        router.replace(`/bookstore/read?${newParams.toString()}`, { scroll: false });

        try {
            const res = await fetch(`/api/bookstore/chapter?url=${encodeURIComponent(fetchUrl)}&sourceId=${sourceId}`);
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.details || '获取章节内容失败');
            }
            const data = await res.json();
            if(data.success) {
                setChapter(data.chapter);
                // Reset scroll position
                if (scrollRef.current) {
                    const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
                    if (viewport) viewport.scrollTop = 0;
                }
                window.scrollTo(0, 0);
            } else {
                throw new Error(data.error || '未能成功获取章节内容');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }

    // Initial fetch
    useEffect(() => {
        if (initialUrl && sourceId) {
            fetchChapter(initialUrl);
        } else {
             setIsLoading(false);
             setError('章节URL或来源ID缺失');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialUrl]); // Support browser back/forward

    // Robust navigation URLs
    const getNavigationUrls = () => {
        if (!chapter) return { prev: null, next: null };

        let prev = chapter.prevChapterUrl;
        let next = chapter.nextChapterUrl;

        // If TOC is available, use it to fill missing links
        if (bookChapters.length > 0) {
            const currentIndex = bookChapters.findIndex(ch => ch.url === currentUrl);
            if (currentIndex !== -1) {
                if (!prev && currentIndex > 0) {
                    prev = bookChapters[currentIndex - 1].url;
                }
                if (!next && currentIndex < bookChapters.length - 1) {
                    next = bookChapters[currentIndex + 1].url;
                }
            }
        }

        return { prev, next };
    };

    const { prev, next } = getNavigationUrls();

    // ForesightJS Integration
    useEffect(() => {
        const initDevTools = async () => {
            const { ForesightDevtools } = await import('js.foresight-devtools');
            const { ForesightManager } = await import('js.foresight');
            
            // 检查是否已经初始化过，避免 "CustomElementRegistry" 重复定义错误
            const isInitialized = !!(ForesightDevtools as any)._instance;

            if (!isForesightEnabled) {
                if (isInitialized) {
                    ForesightDevtools.instance.alterDevtoolsSettings({ showDebugger: false });
                }
                return;
            }

            // 禁用滚动预判翻页，仅保留鼠标轨迹预判
            ForesightManager.initialize({
                enableManagerLogging: true,
                debug: true,
                enableMousePrediction: true,
                enableScrollPrediction: false // 关闭滚动预判
            });

            if (!isInitialized) {
                // 仅在未初始化时调用 initialize，这会定义 Custom Elements
                ForesightDevtools.initialize({
                    showDebugger: true,
                    isControlPanelDefaultMinimized: true,
                    showNameTags: false
                });
            } else {
                // 如果已初始化，只需确保显示即可
                ForesightDevtools.instance.alterDevtoolsSettings({ showDebugger: true });
            }
        };

        if (typeof window !== 'undefined') {
            initDevTools();
        }

        if (!isForesightEnabled || isLoading) return;

        const manager = ForesightManager.instance;
        
        const refs = [
            { ref: nextBtnRef, action: () => next && fetchChapter(next), name: '下一章' },
            { ref: prevBtnRef, action: () => prev && fetchChapter(prev), name: '上一章' },
            { ref: tocBtnRef, action: () => router.back(), name: '目录' }
        ];

        refs.forEach(({ ref, action, name }) => {
            if (ref.current) {
                manager.register({
                    element: ref.current,
                    callback: action,
                    name: name,
                    hitSlop: 20 // 还原正常的命中范围，防止滚动误触
                });
            }
        });

        return () => {
            refs.forEach(({ ref }) => {
                if (ref.current) manager.unregister(ref.current);
            });
        };
    }, [isForesightEnabled, next, prev, isLoading, router]);

    if (isLoading && !chapter) {
        return <LoadingState />;
    }
    
    if (error) {
        return <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
                 <div className="mb-6">
                    <Button variant="ghost" onClick={() => router.back()}>
                        <ArrowLeft className="mr-2"/>
                        返回
                    </Button>
                </div>
                <div className="text-center py-10 text-destructive">{error}</div>
            </main>
        </div>
    }

    if (!chapter) {
        return null;
    }

    return (
        <div className="flex flex-col min-h-screen bg-background">
            <Header>
                <div className="flex-grow flex justify-center items-center px-4">
                    <h1 className="text-sm md:text-lg font-semibold truncate font-headline max-w-[200px] md:max-w-md" title={chapter.title}>
                        {chapter.title}
                    </h1>
                </div>
            </Header>
            
            <main className="flex-grow flex flex-col overflow-hidden">
                <ScrollArea className="flex-1" ref={scrollRef}>
                    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
                        <h1 className="text-2xl md:text-4xl font-bold text-center mb-8 md:mb-12 font-headline leading-tight">
                            {chapter.title}
                        </h1>
                        
                        <div 
                            className="prose dark:prose-invert max-w-none text-lg md:text-xl leading-relaxed whitespace-pre-wrap selection:bg-primary/20"
                            style={{ 
                                fontFamily: "'Literata', serif",
                                lineHeight: '1.8',
                            }}
                        >
                            {chapter.content}
                        </div>

                        {/* Navigation Buttons inside ScrollArea at the bottom */}
                        <div className="grid grid-cols-3 gap-2 md:gap-4 items-center mt-12 md:mt-20 pt-8 border-t border-border/50">
                            <Button 
                                ref={prevBtnRef}
                                onClick={() => prev && fetchChapter(prev)}
                                disabled={!prev || isLoading}
                                variant="outline"
                                className="h-12"
                            >
                                <ArrowLeft className="mr-1 md:mr-2 h-4 w-4"/>
                                <span className="hidden md:inline">上一章</span>
                                <span className="md:hidden text-xs">上一章</span>
                            </Button>
                            
                            <Button 
                                ref={tocBtnRef}
                                onClick={() => router.back()}
                                variant="ghost"
                                className="h-12"
                            >
                                <List className="mr-1 md:mr-2 h-4 w-4"/>
                                <span className="hidden md:inline">目录</span>
                                <span className="md:hidden text-xs">目录</span>
                            </Button>
                            
                            <Button 
                                ref={nextBtnRef}
                                onClick={() => next && fetchChapter(next)}
                                disabled={!next || isLoading}
                                variant="outline"
                                className="h-12"
                            >
                                <span className="hidden md:inline">下一章</span>
                                <span className="md:hidden text-xs">下一章</span>
                                <ArrowRight className="ml-1 md:ml-2 h-4 w-4"/>
                            </Button>
                        </div>
                    </div>
                </ScrollArea>
            </main>

            {/* Foresight Floating Toggle */}
            <div className="fixed bottom-6 right-6 z-50">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center space-x-2 bg-background/80 backdrop-blur-md p-3 rounded-full border border-border shadow-lg">
                                <Label htmlFor="foresight-mode" className="cursor-pointer ml-1">
                                    <Zap className={`h-4 w-4 ${isForesightEnabled ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`} />
                                </Label>
                                <Switch 
                                    id="foresight-mode" 
                                    checked={isForesightEnabled}
                                    onCheckedChange={setIsForesightEnabled}
                                />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                            <p>{isForesightEnabled ? '智能预判：开启 (触底自动翻页/返回)' : '智能预判：关闭'}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        </div>
    );
}

function LoadingState() {
     return (
        <div className="flex flex-col min-h-screen bg-background">
            <Header>
                 <div className="flex-grow flex justify-center items-center">
                    <Skeleton className="h-6 w-48" />
                </div>
            </Header>
            <main className="flex-grow container mx-auto px-4 md:px-6 py-8 md:py-12">
                 <div className="max-w-3xl mx-auto">
                    <Skeleton className="h-10 w-3/4 mx-auto mb-12" />
                    <div className="space-y-6">
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-5/6" />
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-5/6" />
                        <Skeleton className="h-6 w-full" />
                    </div>
                </div>
            </main>
        </div>
    );
}

export default function ReadPage() {
    return (
        <Suspense fallback={<LoadingState />}>
            <ChapterReader />
        </Suspense>
    )
}
