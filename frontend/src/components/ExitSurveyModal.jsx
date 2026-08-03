import { useEffect, useState } from 'react';
import { useUiScript } from '../contexts/UiScriptContext';
import { submitExitFeedback } from '../api/feedback';
import Icon from './Icon';
import FreePlayCtaRow from './FreePlayCtaRow';
import { KAA } from '../i18n/kaa';
import { FOOTER_FREE_LINKS } from '../data/siteDeepLinks';

const SESSION_KEY = 'app:exit_survey_done';

export default function ExitSurveyModal() {
  const { text } = useUiScript();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [step, setStep] = useState('ask'); // ask | note
  const [helpfulChoice, setHelpfulChoice] = useState(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return undefined;
    } catch {
      return undefined;
    }

    let armed = false;
    const armTimer = window.setTimeout(() => {
      armed = true;
    }, 45000);

    const onLeaveIntent = (e) => {
      if (!armed) return;
      try {
        if (sessionStorage.getItem(SESSION_KEY)) return;
      } catch {
        return;
      }
      if (e.clientY > 12) return;
      setOpen(true);
      armed = false;
    };

    document.addEventListener('mouseout', onLeaveIntent);
    return () => {
      window.clearTimeout(armTimer);
      document.removeEventListener('mouseout', onLeaveIntent);
    };
  }, []);

  const close = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* ignore */
    }
    setOpen(false);
    setStep('ask');
    setNote('');
    setHelpfulChoice(null);
  };

  const send = async (helpful, withNote = '') => {
    if (busy) return;
    setBusy(true);
    try {
      await submitExitFeedback({
        helpful,
        note: String(withNote || '').trim().slice(0, 500),
      });
    } catch {
      /* soft fail */
    } finally {
      setBusy(false);
      close();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 theme-focus-hide sm:items-center">
      <button type="button" className="absolute inset-0 bg-ink/35" aria-label={text('Jabıw')} onClick={close} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-sm rounded-3xl border border-ink/10 bg-parchment px-6 py-6 shadow-xl"
      >
        <Icon name="sparkle" className="mb-3 text-2xl text-amber-600" />
        {step === 'ask' ? (
          <>
            <h2 className="mb-2 font-display text-xl text-ink">{text('Sayt paydalı boldı ma?')}</h2>
            <p className="mb-5 text-sm text-ink/55">
              {text('Juwabıńız sayttı jaqsılawǵa járdem beredi.')}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setHelpfulChoice(true);
                  setStep('note');
                  setNote('');
                }}
                className="flex-1 rounded-full bg-teal-800 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {text('Awa')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setHelpfulChoice(false);
                  setStep('note');
                  setNote('');
                }}
                className="flex-1 rounded-full border border-ink/15 py-2.5 text-sm font-semibold text-ink/70 disabled:opacity-50"
              >
                {text('Yaq')}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="mb-2 font-display text-xl text-ink">{text('Qısqa pikir (ixtiyarıy)')}</h2>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              rows={3}
              placeholder={text('Neni jaqsılaw kerek?')}
              className="mb-4 w-full rounded-2xl border border-ink/15 bg-white/80 px-3 py-2 text-sm"
            />
            <div className="flex gap-3">
              <button
                type="button"
                disabled={busy || helpfulChoice == null}
                onClick={() => send(Boolean(helpfulChoice), note)}
                className="flex-1 rounded-full bg-teal-800 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {text(busy ? '…' : 'Jiberiw')}
              </button>
              <button
                type="button"
                disabled={busy || helpfulChoice == null}
                onClick={() => send(Boolean(helpfulChoice), '')}
                className="flex-1 rounded-full border border-ink/15 py-2.5 text-sm font-semibold text-ink/70 disabled:opacity-50"
              >
                {text('Ótkiziw')}
              </button>
            </div>
          </>
        )}
        <p className="mt-5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
          {text(KAA.exitSurveyFree)}
        </p>
        <FreePlayCtaRow
          links={FOOTER_FREE_LINKS}
          compact
          className="mt-3"
          onNavigate={close}
        />
      </div>
    </div>
  );
}
