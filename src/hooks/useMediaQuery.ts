import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media query and re-render on change. SSR-safe (returns
 * false until mounted). Used to switch the recording controls to a rotated
 * right-hand rail in landscape orientation.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
