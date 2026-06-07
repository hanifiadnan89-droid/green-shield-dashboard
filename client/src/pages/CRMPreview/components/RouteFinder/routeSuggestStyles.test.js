import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const COMMAND_CSS = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../RouteFinder/route-finder-command.css'),
  'utf8',
);

const WIDGET_SOURCE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../RouteFinderWidget.jsx'),
  'utf8',
);

describe('address suggestion hover styles', () => {
  it('does not use a white suggestion dropdown on the command page', () => {
    expect(WIDGET_SOURCE).not.toMatch(/route-suggest-dropdown[^`]*bg-white/);
    expect(WIDGET_SOURCE).toContain('route-suggest-dropdown--command');
  });

  it('uses subtle green hover tint instead of white backgrounds', () => {
    expect(COMMAND_CSS).toContain('.rf-command .route-suggest-item:hover');
    expect(COMMAND_CSS).toContain('background: rgba(34, 197, 94, 0.08)');
    expect(COMMAND_CSS).toContain('background: transparent');
  });
});
