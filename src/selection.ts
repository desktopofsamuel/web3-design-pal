import { APPENDABLE_TYPES } from './constants';
import type { SelectionContextMessage, SelectionContextMode } from './types';

export function isApplySupportedEditor(): boolean {
  return figma.editorType === 'figma' || figma.editorType === 'figjam';
}

export function isAppendableContainer(node: SceneNode): node is SceneNode & ChildrenMixin {
  return APPENDABLE_TYPES.includes(node.type) && 'appendChild' in node;
}

export function getAppendableContainers(
  selection: readonly SceneNode[],
): Array<SceneNode & ChildrenMixin> {
  return selection.filter(isAppendableContainer);
}

export function collectTextTargets(selection: readonly SceneNode[]): TextNode[] {
  const ordered: TextNode[] = [];
  const seen = new Set<string>();

  function add(t: TextNode): void {
    if (seen.has(t.id)) return;
    seen.add(t.id);
    ordered.push(t);
  }

  for (const node of selection) {
    if (node.type === 'TEXT') {
      add(node);
    } else if ('findAll' in node) {
      const inner = (
        node as SceneNode & {
          findAll<T extends SceneNode>(predicate: (n: SceneNode) => n is T): T[];
        }
      ).findAll((n): n is TextNode => n.type === 'TEXT');
      for (const t of inner) add(t);
    }
  }

  return ordered;
}

export function pushSelectionContext(): void {
  if (!isApplySupportedEditor()) {
    const msg: SelectionContextMessage = {
      type: 'selection-context',
      textTargetCount: 0,
      previewBatchSize: 0,
      mode: 'unsupported',
      unsupportedReason: 'editor',
    };
    figma.ui.postMessage(msg);
    return;
  }

  const sel = figma.currentPage.selection;
  const targets = collectTextTargets(sel);
  const textTargetCount = targets.length;
  let mode: SelectionContextMode;

  if (targets.length === 0) {
    if (sel.length === 0) {
      mode = 'create-on-page';
    } else if (getAppendableContainers(sel).length > 0) {
      mode = 'create-in-frame';
    } else {
      mode = 'unsupported';
    }
  } else if (targets.length === 1) {
    mode = 'retext-one';
  } else {
    mode = 'retext-many';
  }

  let previewBatchSize = 0;
  switch (mode) {
    case 'create-on-page':
      previewBatchSize = 1;
      break;
    case 'create-in-frame':
      previewBatchSize = getAppendableContainers(sel).length;
      break;
    case 'retext-one':
      previewBatchSize = 1;
      break;
    case 'retext-many':
      previewBatchSize = textTargetCount;
      break;
    default:
      previewBatchSize = 0;
  }

  const msg: SelectionContextMessage = {
    type: 'selection-context',
    textTargetCount,
    previewBatchSize,
    mode,
  };
  if (mode === 'unsupported' && sel.length > 0) {
    msg.unsupportedReason = 'selection';
  }
  figma.ui.postMessage(msg);
}
