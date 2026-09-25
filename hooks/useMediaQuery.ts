import { useEffect, useState } from 'react';

export const useMediaQuery = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent;
    const mobile = Boolean(userAgent.match(/(iPad)|(iPhone)|(iPod)|(android)|(webOS)/i));
    setIsMobile(mobile);
  }, []);

  return { isMobile };
};
