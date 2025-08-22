import { Easing } from 'framer-motion';

export const imageVariants = {
  initial: (corner: string) => {
    switch (corner) {
      case 'top-left':
        return { x: '-33%', y: '-33%', rotate: 15, opacity: 1 };
      case 'top-right':
        return { x: '33%', y: '-33%', rotate: -15, opacity: 1 };
      case 'bottom-left':
        return { x: '-33%', y: '33%', rotate: -30, opacity: 1 };
      case 'bottom-right':
        return { x: '33%', y: '33%', rotate: 30, opacity: 1 };
      default:
        return { x: 0, y: 0, opacity: 1 };
    }
  },
  exit: (corner: string) => {
    const transition = { duration: 0.5, ease: 'easeInOut' as Easing };
    switch (corner) {
      case 'top-left':
        return { x: '-100%', y: '-100%', opacity: 0, transition };
      case 'top-right':
        return { x: '100%', y: '-100%', opacity: 0, transition };
      case 'bottom-left':
        return { x: '-100%', y: '100%', opacity: 0, transition };
      case 'bottom-right':
        return { x: '100%', y: '100%', opacity: 0, transition };
      default:
        return { x: 0, y: 0, opacity: 0, transition };
    }
  },
  enter: (corner: string) => ({
    ...imageVariants.initial(corner),
    transition: { duration: 1, delay: 0.2, ease: 'backOut' as Easing },
  }),
};
