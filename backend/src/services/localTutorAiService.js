/**
 * Local rule-based tutor "AI" — no external LLM/API.
 * Builds short mini-lessons from mistake + dictionary context.
 * Never includes correct answers.
 */

function clip(text, max = 160) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function extractFocus(prompt) {
  const raw = String(prompt || '');
  const quoted = raw.match(/[«"']([^«"']{2,40})[»"']/);
  if (quoted) return quoted[1].trim();
  const first = raw.split(/[?.!—–-]/)[0]?.trim();
  if (first && first.length <= 48) return first;
  return clip(raw, 40) || 'Sóz';
}

function tipFor({ wrongCount = 1, source = 'quiz', focus, mode = 'review' }) {
  if (mode === 'listen_produce') {
    return 'Dawıstı tıńlań, keyin eslegen sózdi jazıń — anıqlama kórsetilmeydi.';
  }
  if (mode === 'example_cloze') {
    const n = Number(wrongCount) || 1;
    if (n >= 5) {
      return 'Bul sóz sizde jiyi qáte. Gápti oqıp, bos orınǵa tuwrı sózdi jazıń.';
    }
    return 'Mısaldaǵı bos orındı toldırıń — kontekstten esleń.';
  }
  if (mode === 'produce_reverse') {
    const n = Number(wrongCount) || 1;
    if (n >= 5) {
      return 'Bul sóz sizde jiyi qáte. Sózdi kórip, qısqa anıqlamanı ózińiz jazıń.';
    }
    if (source === 'reading') {
      return 'Oqıw darsında adasqansız. Sózge tuwrı anıqlamanı esleń hám jazıń.';
    }
    if (source === 'crossword') {
      return 'Krossvordta adasqansız. Sózge tuwrı anıqlamanı jazıń.';
    }
    if (source === 'immersion') {
      return 'Dawıslı tıńlaǵannan keyin adasqansız. Sózge tuwrı anıqlamanı jazıń.';
    }
    if (source === 'jumbaq') {
      return 'Jumbaq juwabında adasqansız. Sózge tuwrı anıqlamanı jazıń.';
    }
    if (source === 'quiz' || source === 'adaptive') {
      return 'Testde adasqansız. Sózge tuwrı anıqlamanı esleń hám jazıń.';
    }
    return 'Sózdi oqıp, qısqa anıqlamanı ózińiz jazıń. Variantlar joq.';
  }
  if (mode === 'produce') {
    const n = Number(wrongCount) || 1;
    if (n >= 5) {
      return 'Bul sóz sizde jiyi qáte. Anıqlamanı oqıp, sózdi ózińiz jazıń — kóshirip almay.';
    }
    if (source === 'reading') {
      return 'Oqıw darsında adasqansız. Anıqlamaǵa tuwrı sózdi esleń hám jazıń.';
    }
    if (source === 'crossword') {
      return 'Krossvordta adasqansız. Anıqlamaǵa tuwrı sózdi jazıń.';
    }
    if (source === 'immersion') {
      return 'Dawıslı tıńlaǵan sóz. Anıqlamaǵa tuwrı sózdi esleń hám jazıń.';
    }
    if (source === 'jumbaq') {
      return 'Jumbaqtan úyrengen sóz. Anıqlamaǵa tuwrı sózdi jazıń.';
    }
    if (source === 'quiz' || source === 'adaptive') {
      return 'Testde adasqansız. Anıqlamaǵa tuwrı sózdi esleń hám jazıń.';
    }
    return 'Anıqlamanı oqıp, sózdi ózińiz jazıń. Variantlar joq.';
  }
  const n = Number(wrongCount) || 1;
  if (n >= 5) {
    return `${focus}: bul nuqta sizde jiyi qáte. Bugın áste, bir mısal menen qayta esleń.`;
  }
  if (n >= 3) {
    return `${focus}: 3+ ret qáte. Anıqlamanı oqıp, keyin varianttı saylań.`;
  }
  if (source === 'dict_game') {
    return `${focus}: sózlik oyınında adasqansız. Anıqlamanı esleń, teńlestiriń.`;
  }
  if (source === 'adaptive') {
    return `${focus}: adaptiv testte qıyın keldi. Qısqa qayta kóriw — keyingi nátiyje jaqsılanadı.`;
  }
  return `${focus}: qısqa qayta kóriw. Durıs varianttı eslew ushın mısaldı oqıń.`;
}

/**
 * @param {object} ctx
 * @param {'review'|'produce'|'produce_reverse'|'example_cloze'|'listen_produce'} [ctx.mode]
 * @returns {{ engine: string, focus: string, tip: string, example: string|null, practice: string }}
 */
export function buildLocalLesson(ctx = {}) {
  const {
    prompt = '',
    wrongCount = 1,
    source = 'quiz',
    word = null,
    definition = null,
    example = null,
    mode = 'review',
  } = ctx;

  if (mode === 'listen_produce') {
    const tip = tipFor({ wrongCount, source, focus: '', mode: 'listen_produce' });
    return {
      engine: 'local-tutor-v1',
      focus: 'Dawıs → sóz',
      tip,
      example: null,
      practice: 'Tıńlań hám sózdi jazıń. Juwap mazmunı ashılmaydı.',
    };
  }

  if (mode === 'example_cloze') {
    // Lemma jasırın — tipke raw mısal/juwap kirgizilmeydi
    const tip = tipFor({ wrongCount, source, focus: '', mode: 'example_cloze' });
    const hint = definition ? clip(definition, 140) : null;
    return {
      engine: 'local-tutor-v1',
      focus: 'Mısal → sóz',
      tip,
      example: hint,
      practice: 'Bos orınǵa sózdi jazıń. Juwap mazmunı ashılmaydı.',
    };
  }

  if (mode === 'produce_reverse') {
    // Anıqlama jasırın — tip/example juwaptı ashıp jibermeydi
    const tip = tipFor({ wrongCount, source, focus: '', mode: 'produce_reverse' });
    return {
      engine: 'local-tutor-v1',
      focus: 'Sóz → anıqlama',
      tip,
      example: null,
      practice: 'Qısqa anıqlamanı jazıń. Juwap mazmunı ashılmaydı.',
    };
  }

  if (mode === 'produce') {
    // Lemma jasırın — tip/example/focus sózdi ashıp jibermeydi
    const tip = tipFor({ wrongCount, source, focus: '', mode: 'produce' });
    const exampleLine = definition ? clip(definition, 160) : null;
    return {
      engine: 'local-tutor-v1',
      focus: 'Anıqlama → sóz',
      tip,
      example: exampleLine,
      practice: 'Sózdi ózińiz jazıń. Juwap mazmunı ashılmaydı.',
    };
  }

  const focus = word || extractFocus(prompt);
  const tip = tipFor({ wrongCount, source, focus, mode: 'review' });

  let exampleLine = null;
  if (example) {
    exampleLine = clip(example, 180);
  } else if (definition) {
    exampleLine = `${focus} — ${clip(definition, 120)}`;
  } else if (prompt) {
    exampleLine = `Qayta esleń: ${clip(prompt, 120)}`;
  }

  return {
    engine: 'local-tutor-v1',
    focus,
    tip,
    example: exampleLine,
    practice: 'Varianttı saylap, yadta bekitıń. Juwap mazmunı ashılmaydı.',
  };
}
