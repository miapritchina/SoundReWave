import { describe, it, expect } from 'vitest';
import { hueShift, layerColor } from './palette';

describe('hueShift', () => {
  it('rotates red → green → blue at 120° steps', () => {
    expect(hueShift('#ff0000', 120).toLowerCase()).toBe('#00ff00');
    expect(hueShift('#ff0000', 240).toLowerCase()).toBe('#0000ff');
  });

  it('is a no-op at 0° / 360°', () => {
    expect(hueShift('#22d3ee', 0).toLowerCase()).toBe('#22d3ee');
    expect(hueShift('#22d3ee', 360).toLowerCase()).toBe('#22d3ee');
  });

  it('returns a valid hex', () => {
    expect(hueShift(layerColor(0), 55)).toMatch(/^#[0-9a-f]{6}$/);
  });
});
