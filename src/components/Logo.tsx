import { BookOpen } from 'lucide-react';

export default function Logo({ hideText = false }: { hideText?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <BookOpen className="h-6 w-6 text-primary" />
      {!hideText && (
        <span className="text-xl font-bold tracking-tight text-foreground font-headline">
          长大写作平台
        </span>
      )}
    </div>
  );
}
