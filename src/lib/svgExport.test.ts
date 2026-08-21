import { describe, it, expect } from 'vitest';
import { svgFromLoops } from './svgExport';
import { demoLoop } from './fixtures';
import { nameToMidi } from './pitch';

describe('svgFromLoops', () => {
  const loops = [
    demoLoop(0, [nameToMidi('A3'), nameToMidi('C4'), nameToMidi('E4')]),
    demoLoop(1, [nameToMidi('E4'), nameToMidi('G4')]),
  ];

  it('produces a standalone svg with a path per layer', () => {
    const svg = svgFromLoops(loops, { width: 800, height: 400 });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="800"');
    // at least one path per loop
    const pathCount = (svg.match(/<path /g) ?? []).length;
    expect(pathCount).toBeGreaterThanOrEqual(2);
    // both layer colors present
    expect(svg).toContain(loops[0].color);
    expect(svg).toContain(loops[1].color);
  });

  it('labels major note gridlines', () => {
    const svg = svgFromLoops(loops);
    expect(svg).toContain('>A3<');
    expect(svg).toContain('>C4<');
  });

  it('handles an empty session without throwing', () => {
    expect(() => svgFromLoops([])).not.toThrow();
  });
});
