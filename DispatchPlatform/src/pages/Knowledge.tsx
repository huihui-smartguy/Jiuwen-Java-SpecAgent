import { BookMarked } from 'lucide-react';
import { ShellPage, type ShellPageBaseProps } from './ShellPage';

export function Knowledge(props: ShellPageBaseProps) {
  return <ShellPage {...props} titleKey="knowledge" bodyKey="knowledgeShell" icon={BookMarked} />;
}
