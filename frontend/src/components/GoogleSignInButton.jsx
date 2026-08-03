import { useGoogleIdentity } from '../hooks/useGoogleIdentity';
import { useUiScript } from '../contexts/UiScriptContext';
import { KAA } from '../i18n/kaa';

/**
 * Official Google Sign-In button (GIS / OAuth 2.0 ID token).
 */
export default function GoogleSignInButton({
  mode = 'signin',
  onCredential,
  onError,
  className = '',
  promptOneTap = false,
  showFallbackHint = true,
}) {
  const { text } = useUiScript();
  const {
    containerRef,
    googleEnabled,
    loadingConfig,
    scriptError,
  } = useGoogleIdentity({
    text: mode === 'signup' ? 'signup_with' : 'signin_with',
    onCredential,
    onError,
    promptOneTap,
  });

  if (loadingConfig) {
    return (
      <div className={`flex min-h-[44px] items-center justify-center text-sm text-ink/40 ${className}`}>
        {text(KAA.kutilipAtir)}
      </div>
    );
  }

  if (!googleEnabled) {
    if (!showFallbackHint) return null;
    return (
      <p className={`rounded-xl border border-dashed border-ink/15 bg-white/40 px-3 py-2.5 text-center text-xs text-ink/45 ${className}`}>
        {text(KAA.googleSozlanmagan)}
      </p>
    );
  }

  return (
    <div className={className}>
      <div ref={containerRef} className="mx-auto flex min-h-[44px] w-full max-w-[320px] justify-center" />
      {scriptError ? (
        <p className="mt-2 text-center text-xs text-rose-700" role="alert">
          {text(KAA.googleSatsiz)}
        </p>
      ) : null}
    </div>
  );
}
