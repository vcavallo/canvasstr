import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * A profile's display name with honest loading: a skeleton while the kind-0 is still
 * resolving (never a fabricated name presented as real), the real name once resolved,
 * and a generated fallback only after we know there's no name. Generic — use anywhere
 * a name would otherwise flicker from a placeholder to the real value.
 */
export function AuthorName({ pubkey, className }: { pubkey: string; className?: string }) {
  const author = useAuthor(pubkey);

  if (author.isLoading && !author.data) {
    return <Skeleton className={cn('inline-block h-4 w-24 align-middle', className)} />;
  }

  const name = author.data?.metadata?.name ?? genUserName(pubkey);
  return <span className={className}>{name}</span>;
}
