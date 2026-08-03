import { useCallback, useEffect, useState } from 'react';
import { fetchMyQuotas } from '../api/quotas';
import { useAuth } from '../contexts/AuthContext';
import GuestGateModal from '../components/GuestGateModal';

export function useGuestQuota() {
  const { isAuthenticated } = useAuth();
  const [quotas, setQuotas] = useState(null);
  const [gate, setGate] = useState({ open: false, reason: 'quiz' });

  const reload = useCallback(async () => {
    if (isAuthenticated) {
      setQuotas({
        isGuest: false,
        quizCompletes: 0,
        wordViews: 0,
        quizLimit: null,
        wordLimit: null,
        crosswordAllowed: true,
        canStartQuiz: true,
        canViewWord: true,
      });
      return;
    }
    try {
      const data = await fetchMyQuotas();
      setQuotas(data);
    } catch {
      setQuotas({
        isGuest: true,
        quizCompletes: 0,
        wordViews: 0,
        quizLimit: null,
        wordLimit: null,
        crosswordAllowed: true,
        canStartQuiz: true,
        canViewWord: true,
      });
    }
  }, [isAuthenticated]);

  useEffect(() => {
    reload();
  }, [reload]);

  const requireQuiz = useCallback(() => {
    if (isAuthenticated || quotas?.canStartQuiz) return true;
    setGate({ open: true, reason: 'quiz' });
    return false;
  }, [isAuthenticated, quotas]);

  const requireWord = useCallback(() => {
    if (isAuthenticated || quotas?.canViewWord) return true;
    setGate({ open: true, reason: 'word' });
    return false;
  }, [isAuthenticated, quotas]);

  const requireCrossword = useCallback(() => {
    if (isAuthenticated || quotas?.crosswordAllowed) return true;
    setGate({ open: true, reason: 'crossword' });
    return false;
  }, [isAuthenticated, quotas]);

  const closeGate = useCallback(() => setGate((g) => ({ ...g, open: false })), []);

  const openGate = useCallback((reason = 'quiz') => {
    setGate({ open: true, reason });
  }, []);

  const GateModal = (
    <GuestGateModal open={gate.open} reason={gate.reason} onClose={closeGate} />
  );

  return {
    quotas,
    reload,
    requireQuiz,
    requireWord,
    requireCrossword,
    openGate,
    closeGate,
    GateModal,
  };
}
