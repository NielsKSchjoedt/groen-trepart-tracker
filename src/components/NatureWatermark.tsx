import deerSilhouette from '@/assets/deer-silhouette.png';
import beeSilhouette from '@/assets/bee-silhouette.png';
import butterflySilhouette from '@/assets/butterfly-silhouette.png';
import fishSilhouette from '@/assets/fish-silhouette.png';
import heronSilhouette from '@/assets/heron-silhouette.png';
import foxSilhouette from '@/assets/fox-silhouette.png';
import rabbitSilhouette from '@/assets/rabbit-silhouette.png';
import owlSilhouette from '@/assets/owl-silhouette.png';
import dragonflySilhouette from '@/assets/dragonfly-silhouette.png';
import hedgehogSilhouette from '@/assets/hedgehog-silhouette.png';

export type Animal = 'deer' | 'bee' | 'butterfly' | 'fish' | 'heron' | 'fox' | 'rabbit' | 'owl' | 'dragonfly' | 'hedgehog';

interface NatureWatermarkProps {
  animal: Animal;
  className?: string;
  size?: number;
}

const animalMap: Record<Animal, string> = {
  deer: deerSilhouette,
  bee: beeSilhouette,
  butterfly: butterflySilhouette,
  fish: fishSilhouette,
  heron: heronSilhouette,
  fox: foxSilhouette,
  rabbit: rabbitSilhouette,
  owl: owlSilhouette,
  dragonfly: dragonflySilhouette,
  hedgehog: hedgehogSilhouette,
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
