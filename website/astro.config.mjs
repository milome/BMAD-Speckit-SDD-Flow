import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'BMAD-Speckit-SDD-Flow',
      description: 'BMAD Method + Spec-Driven Development documentation',
      social: {
        github: 'https://github.com/bmad-method/BMAD-Speckit-SDD-Flow',
      },
      sidebar: [
        {
          label: 'Tutorials',
          autogenerate: { directory: 'tutorials' },
        },
        {
          label: 'How-To Guides',
          autogenerate: { directory: 'how-to' },
        },
        {
          label: 'Explanation',
          autogenerate: { directory: 'explanation' },
        },
        {
          label: 'Reference',
          autogenerate: { directory: 'reference' },
        },
      ],
    }),
  ],
});
