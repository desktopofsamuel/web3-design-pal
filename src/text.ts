import { DEFAULT_FONT } from './constants';

export async function loadFontForEdit(text: TextNode): Promise<void> {
  try {
    if (text.fontName === figma.mixed) {
      await figma.loadFontAsync(DEFAULT_FONT);
      text.fontName = DEFAULT_FONT;
      return;
    }
    await figma.loadFontAsync(text.fontName as FontName);
  } catch (_err) {
    await figma.loadFontAsync(DEFAULT_FONT);
    text.fontName = DEFAULT_FONT;
  }
}

export async function setTextCharacters(text: TextNode, value: string): Promise<void> {
  await loadFontForEdit(text);
  text.characters = value;
}

export async function createTextNode(
  parent: ChildrenMixin,
  value: string,
  x: number,
  y: number,
): Promise<TextNode> {
  const t = figma.createText();
  await figma.loadFontAsync(DEFAULT_FONT);
  t.fontName = DEFAULT_FONT;
  t.characters = value;
  t.x = x;
  t.y = y;
  parent.appendChild(t);
  return t;
}
