import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from './Icon';
import { fetchTutorReminder } from '../api/tutor';
import { useUiScript } from '../contexts/UiScriptContext';
import { KAA } from '../i18n/kaa';

const DISMISS_KEY = 'qp_tutor_reminder_dismiss';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function wasDismissedToday() {
  try {
    return localStorage.getItem(DISMISS_KEY) === todayKey();
  } catch {
    return false;
  }
}

function dismissToday() {
  try {
    localStorage.setItem(DISMISS_KEY, todayKey());
  } catch {
    /* ignore */
  }
}

export default function TutorReminderBanner() {
  const { text } = useUiScript();
  const location = useLocation();
  const [reminder, setReminder] = useState(null);
  const [hidden, setHidden] = useState(() => wasDismissedToday());

  const quietRoute =
    location.pathname.startsWith('/tutor') ||
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/settings' ||
    location.pathname === '/profile';

  useEffect(() => {
    if (quietRoute) {
      setHidden(true);
      return undefined;
    }
    let cancelled = false;
    async function load() {
      try {
        const res = await fetchTutorReminder();
        if (cancelled) return;
        setReminder(res.reminder || null);
        if (res.reminder?.due && !wasDismissedToday()) {
          setHidden(false);
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            const last = sessionStorage.getItem('qp_tutor_notif');
            if (last !== todayKey()) {
              sessionStorage.setItem('qp_tutor_notif', todayKey());
              new Notification(text(KAA.kundayTutor), {
                body: text(`${KAA.miniDars} · ${res.reminder.scheduledTime}`),
                tag: 'tutor-daily',
              });
            }
          }
        }
      } catch {
        if (!cancelled) setReminder(null);
      }
    }
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [location.pathname, text, quietRoute]);

  if (quietRoute || hidden || !reminder?.due) return null;

  return (
    <div className="fixed bottom-[calc(5.5rem+0.35rem)] left-4 right-4 z-[60] mx-auto max-w-lg md:bottom-6 md:left-auto md:right-6">
      <div className="flex items-start gap-3 rounded-2xl border border-teal-700/20 bg-gradient-to-br from-teal-50/95 to-amber-50/80 px-4 py-3 shadow-[0_20px_50px_-20px_rgba(15,92,86,0.45)] backdrop-blur-md">
        <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-800 text-white">
          <Icon name="sparkle" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">{text(KAA.kundayTutor)}</p>
          <p className="text-xs text-ink/55">
            {reminder.reason === 'in_progress'
              ? text(KAA.darsYarimda)
              : text(`${KAA.miniDars} · ${reminder.scheduledTime}`)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              to={reminder.deepLink || '/tutor'}
              className="rounded-full bg-teal-900 px-3 py-1.5 text-xs font-bold text-white"
            >
              {text(reminder.reason === 'in_progress' ? KAA.dawamEt : KAA.ashiw)}
            </Link>
            {typeof Notification !== 'undefined' && Notification.permission === 'default' && (
              <button
                type="button"
                onClick={() => Notification.requestPermission()}
                className="rounded-full border border-teal-700/25 px-3 py-1.5 text-xs font-semibold text-teal-900"
              >
                {text(KAA.brauzerEsletpe)}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                dismissToday();
                setHidden(true);
              }}
              className="rounded-full px-3 py-1.5 text-xs text-ink/45 hover:text-ink"
            >
              {text(KAA.keyin)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
