import { Badge } from '@/components/ui/badge';
import type { Score } from '@/lib/pov';

export function RankBadge({ score, unranked }: { score?: Score; unranked?: boolean }) {
  if (unranked) return null;
  if (!score) return <Badge variant="outline" className="whitespace-nowrap text-muted-foreground">unscored</Badge>;
  const tone = score.rank >= 50 ? 'default' : score.rank >= 10 ? 'secondary' : 'outline';
  return <Badge variant={tone} className="whitespace-nowrap" title={score.hops !== undefined ? `${score.hops} hops` : undefined}>rank {score.rank}</Badge>;
}
