import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * A profile avatar with honest loading: a skeleton while the kind-0 resolves, then the
 * picture (or an initial fallback). Generic companion to {@link AuthorName}.
 */
export function AuthorAvatar({ pubkey, className }: { pubkey: string; className?: string }) {
  const author = useAuthor(pubkey);

  if (author.isLoading && !author.data) {
    return <Skeleton className={cn('h-8 w-8 rounded-full', className)} />;
  }

  const metadata = author.data?.metadata;
  const name = metadata?.name ?? genUserName(pubkey);
  const initial = name.slice(0, 2).toUpperCase();

  return (
    <Avatar className={cn('h-8 w-8', className)}>
      {metadata?.picture && <AvatarImage src={metadata.picture} alt={name} />}
      <AvatarFallback>{initial}</AvatarFallback>
    </Avatar>
  );
}
