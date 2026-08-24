import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
  framework: { name: '@storybook/react-vite', options: {} },
  // Serve under a sub-path when deployed (e.g. /SoundReWave/storybook/).
  viteFinal: async (cfg) => {
    if (process.env.SB_BASE) cfg.base = process.env.SB_BASE;
    return cfg;
  },
};

export default config;
