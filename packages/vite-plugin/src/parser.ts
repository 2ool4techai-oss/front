export interface DrBlock {
  script?: string;   // contents of <script> block
  template?: string; // contents of <template> block
  style?: string;    // contents of <style> block
}

export function parseDrFile(source: string): DrBlock {
  const scriptMatch   = source.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  const templateMatch = source.match(/<template[^>]*>([\s\S]*?)<\/template>/);
  const styleMatch    = source.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  return {
    ...(scriptMatch?.[1]?.trim() !== undefined ? { script: scriptMatch[1].trim() } : {}),
    ...(templateMatch?.[1]?.trim() !== undefined ? { template: templateMatch[1].trim() } : {}),
    ...(styleMatch?.[1]?.trim() !== undefined ? { style: styleMatch[1].trim() } : {}),
  };
}
