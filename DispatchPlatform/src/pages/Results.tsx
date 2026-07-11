import { FileText } from 'lucide-react';
import { ShellPage, type ShellPageBaseProps } from './ShellPage';

export function Results(props: ShellPageBaseProps) {
  return <ShellPage {...props} titleKey="results" bodyKey="reportShell" icon={FileText} />;
}
