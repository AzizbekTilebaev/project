import { useUiScript } from '../contexts/UiScriptContext';
import ErrorBoundary from './ErrorBoundary';

/** UiScriptContext ichida ErrorBoundary — matnlar KAA orqali. */
export default function AppErrorBoundary({ children }) {
  const { text } = useUiScript();
  return <ErrorBoundary text={text}>{children}</ErrorBoundary>;
}
