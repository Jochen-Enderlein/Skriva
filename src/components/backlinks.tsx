import Link from 'next/link';
import { FileText } from 'lucide-react';

interface Backlink {
  title: string;
  slug: string;
  snippet: string;
}

interface BacklinksProps {
  backlinks: Backlink[];
}

export function Backlinks({ backlinks }: BacklinksProps) {
  if (backlinks.length === 0) {
    return null;
  }

  return (
    <div className="mt-16 pt-8 border-t border-border">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
        {backlinks.length} {backlinks.length === 1 ? 'mention' : 'mentions'} in other notes
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        {backlinks.map((link) => (
          <Link
            key={link.slug}
            href={`/note/${link.slug}`}
            className="group block p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-2 font-medium mb-1">
              <FileText className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
              <span>{link.title}</span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 italic">
              {link.snippet}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
