import { Code2 } from 'lucide-react';
import { ShellPage, type ShellPageBaseProps } from './ShellPage';

export function Scripts(props: ShellPageBaseProps) {
  return <ShellPage {...props} titleKey="scripts" bodyKey="scriptShell" icon={Code2} />;
}
