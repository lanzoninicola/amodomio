# KDS Voice (PT-BR + IT-IT, merge sem toggle)

## Uso básico (sem toggle de idioma)
```ts
import {
  useVoice, detectStatusWithLexicon, parseNumberMulti,
  LEXICON_PT_BR, LEXICON_IT_IT, parseNumberPT, parseNumberIT, mergeLexica
} from "~/domain/kds";

const MERGED = mergeLexica(LEXICON_PT_BR, LEXICON_IT_IT);
const { listening, lastHeard, start, stop } = useVoice((normalized) => {
  const status = detectStatusWithLexicon(normalized, MERGED);
  const num = parseNumberMulti(normalized, [parseNumberPT, parseNumberIT]);
  if (status && num != null) submitStatus(num, status);
}, { autoStart: true });
```

## Estender vocabulário sem tocar nos arquivos originais
```ts
const EXTRA = { intents: { assando: ["mete no forno"], emProducao: ["manda pra produção"] } };
const MERGED = mergeLexica(LEXICON_PT_BR, LEXICON_IT_IT, EXTRA);
```
