import deerSilhouette from '@/assets/deer-silhouette.png';
import beeSilhouette from '@/assets/bee-silhouette.png';
import butterflySilhouette from '@/assets/butterfly-silhouette.png';
import fishSilhouette from '@/assets/fish-silhouette.png';
import heronSilhouette from '@/assets/heron-silhouette.png';

interface NatureWatermarkProps {
  animal: 'deer' | 'bee' | 'butterfly' | 'fish' | 'heron';
  className?: string;
  size?: number;
}

const animalMap = {
  deer: deerSilhouette,
  bee: beeSilhouette,
  butterfly: butterflySilhouette,
  fish: fishSilhouette,
  heron: heronSilhouette,
};

export function NatureWatermark({ animal, className = '', size = 120 }: NatureWatermarkProps) {
  return (
    <img
      src={animalMap[animal]}
      alt=""
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
      style={{ width: size, height: size, objectFit: 'contain' }}
      draggable={false}
    />
  );
}
