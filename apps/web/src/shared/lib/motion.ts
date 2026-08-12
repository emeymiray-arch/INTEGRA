export const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2 },
};

export const cardStagger = {
  animate: { transition: { staggerChildren: 0.05 } },
};

export const cardItem = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};
