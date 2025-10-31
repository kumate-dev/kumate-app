export const startResizing = (
  e: React.MouseEvent,
  options: {
    getCurrentSize: () => number;
    setSize: (size: number) => void;
    minSize?: number;
    maxSize?: number;
    axis: 'horizontal' | 'vertical';
  },
  setIsResizing: (resizing: boolean) => void
) => {
  e.preventDefault();
  setIsResizing(true);

  const {
    getCurrentSize,
    setSize,
    axis,
    minSize = 200,
    maxSize = axis === 'vertical' ? window.innerHeight * 0.9 : window.innerWidth * 0.9,
  } = options;

  const startPos = axis === 'vertical' ? e.clientY : e.clientX;
  const startSize = getCurrentSize();

  const handleMouseMove = (moveEvent: MouseEvent) => {
    const currentPos = axis === 'vertical' ? moveEvent.clientY : moveEvent.clientX;
    const delta = startPos - currentPos;
    const newSize = startSize + delta;
    const clampedSize = Math.min(Math.max(newSize, minSize), maxSize);

    setSize(clampedSize);
  };

  const handleMouseUp = () => {
    setIsResizing(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};
