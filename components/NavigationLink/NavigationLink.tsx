import Link from 'next/link';
import type { ComponentProps } from 'react';

/** Fetch when followed, then reuse Next's cache on subsequent visits. */
const NavigationLink = (props: ComponentProps<typeof Link>) => <Link prefetch={false} {...props} />;

export default NavigationLink;
