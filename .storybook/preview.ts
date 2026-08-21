import type { Preview } from '@storybook/react';
import '../src/index.css';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'ink',
      values: [{ name: 'ink', value: '#0a0b14' }],
    },
    controls: { matchers: { color: /(background|color)$/i } },
  },
};

export default preview;
