/**
 * Inspection widgets: the three heavy panes attached to a selected resource.
 *
 * They are deliberately self-contained — each one owns its own subscription and
 * teardown — so a host pane only has to mount and unmount them. Keep them out of the
 * entry chunk; `vite.config.js` already splits `prismjs`/`yaml` and `@xterm/*` out,
 * and importing this barrel eagerly would defeat that.
 */

export { YamlView, toYaml, highlightYaml, lineNumbersFor } from './YamlView';
export type { YamlViewProps } from './YamlView';

export { YamlEditor } from './YamlEditor';
export type { YamlEditorProps } from './YamlEditor';

export { LogView } from './LogView';
export type { LogViewProps } from './LogView';

export { Terminal } from './Terminal';
export type { TerminalProps } from './Terminal';
