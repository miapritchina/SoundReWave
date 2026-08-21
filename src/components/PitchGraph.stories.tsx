import type { Meta, StoryObj } from '@storybook/react';
import { PitchGraph } from './PitchGraph';
import { demoLoop, demoPoints } from '../lib/fixtures';
import { nameToMidi } from '../lib/pitch';

const N = (s: string) => nameToMidi(s);

const meta: Meta<typeof PitchGraph> = {
  title: 'Graph/PitchGraph',
  component: PitchGraph,
  args: { width: 720, height: 360 },
  decorators: [
    (Story) => (
      <div style={{ background: '#121424', borderRadius: 16, padding: 8, width: 'fit-content' }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof PitchGraph>;

export const Empty: Story = {};

export const SingleActiveLine: Story = {
  args: {
    activePoints: demoPoints(0, [N('A3'), N('C4'), N('E4'), N('D4')]),
    activeColor: '#22d3ee',
  },
};

export const ManyLayers: Story = {
  args: {
    committedLoops: [
      demoLoop(0, [N('A3'), N('C4'), N('E4'), N('D4')]),
      demoLoop(1, [N('E4'), N('G4'), N('A4'), N('G4')]),
      demoLoop(2, [N('C3'), N('E3'), N('G3'), N('C4')]),
    ],
    activePoints: demoPoints(3, [N('A4'), N('B4'), N('A4'), N('F4')]),
    activeColor: '#4ade80',
  },
};

export const GapBridging: Story = {
  name: 'Gap bridging (consonants)',
  args: {
    activePoints: demoPoints(0, [N('A3'), N('A3'), N('A3'), N('A3'), N('A3')]),
    activeColor: '#ff5c8a',
  },
};
