import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toHexPubkey } from '@/lib/lensConfig';

/** `/a/:npub` is sugar for `/?author=<hex>`: the unranked author-view escape hatch. */
export default function AuthorView() {
  const { npub } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    const hex = toHexPubkey(npub);
    navigate(hex ? `/?author=${hex}` : '/', { replace: true });
  }, [npub, navigate]);
  return null;
}
