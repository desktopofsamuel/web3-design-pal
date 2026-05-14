import { setTextCharacters } from '../text';

export async function applyPriceReplacements(
  replacements: Array<{ nodeId: string; newText: string }>,
): Promise<void> {
  let applied = 0;
  for (const { nodeId, newText } of replacements) {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (node && node.type === 'TEXT') {
      await setTextCharacters(node, newText);
      applied++;
    }
  }
  figma.notify(
    applied > 0
      ? `Updated ${applied} layer${applied > 1 ? 's' : ''}.`
      : 'No layers updated.',
  );
}
