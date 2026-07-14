const images = import.meta.glob('../assets/*.{png,jpg,jpeg,svg,gif,webp}', { eager: true, import: 'default' });

export function resolveImage(path: string): string {
  if (path && path.startsWith('/src/assets/')) {
    const key = path.replace('/src/assets/', '../assets/');
    return (images[key] as string) || path;
  }
  return path || '';
}
