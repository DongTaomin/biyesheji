
'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ArrowRight, List } from 'lucide-react';
import type { BookstoreChapterContent, BookstoreChapter } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';

function ChapterReader() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialUrl = searchParams.get('url') || '';
    const sourceId = searchParams.get('sourceId') || '';
    const bookUrl = searchParams.get('bookUrl') || '';
    
    const [currentUrl, setCurrentUrl] = useState(initialUrl);
    const [chapter, setChapter] = useState<BookstoreChapterContent | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [bookChapters, setBookChapters] = useState<BookstoreChapter[]>([]);
    
    const scrollRef = useRef<HTMLDivElement>(null);

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
        const newParams = new URLSearchParams(searchParams.toString());
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
                                onClick={() => router.back()}
                                variant="ghost"
                                className="h-12"
                            >
                                <List className="mr-1 md:mr-2 h-4 w-4"/>
                                <span className="hidden md:inline">目录</span>
                                <span className="md:hidden text-xs">目录</span>
                            </Button>
                            
                            <Button 
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
