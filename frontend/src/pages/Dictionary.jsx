import { Navigate, useSearchParams } from 'react-router-dom';
import DictionaryLanding from './DictionaryLanding';

/**
 * /dictionary — premium markaz.
 * Eski ?q= / ?letter= havolalar /dictionary/all ga yo'naltiriladi.
 */
export default function Dictionary() {
  const [params] = useSearchParams();
  const q = params.get('q');
  const letter = params.get('letter');
  const pos = params.get('pos');
  const theme = params.get('theme');

  if (q || letter || pos || theme) {
    const next = new URLSearchParams();
    if (q) next.set('q', q);
    if (letter) next.set('letter', letter);
    if (pos) next.set('pos', pos);
    if (theme) next.set('theme', theme);
    return <Navigate to={`/dictionary/all?${next.toString()}`} replace />;
  }

  return <DictionaryLanding />;
}
