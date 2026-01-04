'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Bot, Send, Sparkles, Trash2, User } from 'lucide-react';
import { useAI } from '@/hooks/useAI';
import { useToast } from '@/hooks/use-toast';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface ReadingAIAssistantProps {
    chapterTitle?: string;
    chapterContent?: string;
}

export function ReadingAIAssistant({ chapterTitle, chapterContent }: ReadingAIAssistantProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const { generateContentStream, isGenerating } = useAI();
    const { toast } = useToast();
    const scrollRef = useRef<HTMLDivElement>(null);

    // 自动滚动到底部
    useEffect(() => {
        if (scrollRef.current) {
            const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isGenerating) return;

        const userMessage: Message = { role: 'user', content: input };
        setMessages((prev) => [...prev, userMessage]);
        setInput('');

        const assistantMessage: Message = { role: 'assistant', content: '' };
        setMessages((prev) => [...prev, assistantMessage]);

        try {
            const systemInstruction = `你是一个专业的阅读助手。你正在协助用户阅读章节《${chapterTitle || '未命名'}》。
当前章节内容如下：
---
${chapterContent || '无内容'}
---
请根据章节内容回答用户的问题，提供见解、解释背景或总结情节。保持回复简洁、专业且富有启发性。`;

            let fullContent = '';
            const stream = generateContentStream(input, { systemInstruction });

            for await (const chunk of stream) {
                fullContent += chunk;
                setMessages((prev) => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].content = fullContent;
                    return newMessages;
                });
            }
        } catch (error: any) {
            toast({
                title: '生成失败',
                description: error.message || '请检查 AI 配置是否正确',
                variant: 'destructive',
            });
            setMessages((prev) => prev.slice(0, -1));
        }
    };

    const handleSummarize = async () => {
        if (isGenerating || !chapterContent) return;

        const summaryPrompt = `请简要总结一下《${chapterTitle || '当前章节'}》的主要内容。`;
        setMessages((prev) => [...prev, { role: 'user', content: '请帮我总结本章内容' }]);
        
        const assistantMessage: Message = { role: 'assistant', content: '' };
        setMessages((prev) => [...prev, assistantMessage]);

        try {
            const systemInstruction = `你是一个专业的图书评论员。请针对用户提供的章节内容进行精炼总结。
章节标题：${chapterTitle || '未命名'}
内容：
---
${chapterContent}
---`;

            let fullContent = '';
            const stream = generateContentStream(summaryPrompt, { systemInstruction });

            for await (const chunk of stream) {
                fullContent += chunk;
                setMessages((prev) => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].content = fullContent;
                    return newMessages;
                });
            }
        } catch (error: any) {
            toast({
                title: '总结失败',
                description: error.message || '请检查 AI 配置是否正确',
                variant: 'destructive',
            });
            setMessages((prev) => prev.slice(0, -1));
        }
    };

    const clearMessages = () => {
        setMessages([]);
    };

    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button 
                    variant="outline" 
                    size="icon" 
                    className="fixed bottom-24 right-6 z-50 rounded-full h-12 w-12 shadow-lg bg-background/80 backdrop-blur-md border-primary/20 hover:border-primary/50 transition-all"
                >
                    <Bot className="h-6 w-6 text-primary" />
                </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md flex flex-col h-full p-0">
                <SheetHeader className="p-4 border-b flex flex-row items-center justify-between">
                    <SheetTitle className="flex items-center gap-2">
                        <Bot className="h-5 w-5 text-primary" />
                        AI 阅读助手
                    </SheetTitle>
                    <Button variant="ghost" size="icon" onClick={clearMessages} disabled={messages.length === 0}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                </SheetHeader>
                
                <div className="flex-1 overflow-hidden flex flex-col">
                    <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                        {messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-[300px] text-center space-y-4">
                                <div className="p-3 rounded-full bg-primary/10">
                                    <Sparkles className="h-8 w-8 text-primary" />
                                </div>
                                <div className="space-y-2">
                                    <p className="font-medium">我是您的 AI 读书伙伴</p>
                                    <p className="text-sm text-muted-foreground px-8">
                                        您可以问我关于本章节的任何问题，或者点击下方按钮快速总结。
                                    </p>
                                </div>
                                <Button variant="outline" size="sm" onClick={handleSummarize} disabled={!chapterContent || isGenerating}>
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    总结本章内容
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {messages.map((msg, i) => (
                                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                            <div className={`mt-1 h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                                {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                                            </div>
                                            <div className={`p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                                <div className="whitespace-pre-wrap leading-relaxed">
                                                    {msg.content || (isGenerating && i === messages.length - 1 ? '正在思考...' : '')}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>

                <div className="p-4 border-t bg-background">
                    <form 
                        className="flex gap-2" 
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSend();
                        }}
                    >
                        <Input 
                            placeholder="输入问题..." 
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={isGenerating}
                            className="flex-1"
                        />
                        <Button type="submit" size="icon" disabled={isGenerating || !input.trim()}>
                            <Send className="h-4 w-4" />
                        </Button>
                    </form>
                </div>
            </SheetContent>
        </Sheet>
    );
}
