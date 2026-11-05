// Only import actively used asset formats; remove png from glob to prevent dead PNGs being bundled
const images = import.meta.glob('../assets/*.{jpg,jpeg,svg,gif,webp}', { eager: true, import: 'default' });

export function resolveImage(path: string): string {
  if (path && path.startsWith('/src/assets/')) {
    const key = path.replace('/src/assets/', '../assets/');
    return (images[key] as string) || path;
  }
  return path || '';
}
