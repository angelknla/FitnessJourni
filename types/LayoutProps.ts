export interface LayoutProps {
  children: React.ReactNode;
  params?: Promise<{
    locale?: string;
  }>;
}
