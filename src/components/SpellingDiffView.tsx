import type { AnswerCheckResult } from '../lib/answerCheck';

interface SpellingDiffViewProps {
  result: AnswerCheckResult;
}

/**
 * Accessible Letter-Level Diff Display (Spec Sections 4.3, 6.2, 10):
 * Highlights missing, extra, swapped, and substituted letters using color,
 * typography treatment (dashed underbar / strikethrough / solid underline),
 * and explicit non-color count badges.
 */
export function SpellingDiffView({ result }: SpellingDiffViewProps) {
  const { diff, summaryCounts } = result;

  return (
    <div>
      <div
        className="diff-word-stream"
        aria-label={`Correct spelling comparison: ${result.closestTarget}`}
      >
        {diff.map((seg, idx) => {
          if (seg.kind === 'equal') {
            return (
              <span key={idx} className="diff-seg-equal">
                {seg.expected}
              </span>
            );
          }
          if (seg.kind === 'missing') {
            return (
              <span
                key={idx}
                className="diff-seg-missing"
                title={`Missing letter(s): "${seg.expected}"`}
              >
                {seg.expected}
              </span>
            );
          }
          if (seg.kind === 'extra') {
            return (
              <span
                key={idx}
                className="diff-seg-extra"
                title={`Extra letter(s) typed: "${seg.actual}"`}
              >
                {seg.actual}
              </span>
            );
          }
          if (seg.kind === 'swapped') {
            return (
              <span
                key={idx}
                className="diff-seg-swapped"
                title={`Swapped letters: wrote "${seg.actual}", should be "${seg.expected}"`}
              >
                {seg.expected}
              </span>
            );
          }
          return (
            <span
              key={idx}
              className="diff-seg-wrong"
              title={`Wrote "${seg.actual}", should be "${seg.expected}"`}
            >
              {seg.expected}
            </span>
          );
        })}
      </div>

      {/* Explicit non-color legend pills (WCAG 1.4.1 Use of Color) */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          marginTop: 'var(--space-2)',
          fontSize: 'var(--text-xs)',
        }}
      >
        {summaryCounts.missing > 0 && (
          <span className="pill pill-correct">
            +{summaryCounts.missing} missing (dashed)
          </span>
        )}
        {summaryCounts.extra > 0 && (
          <span className="pill pill-wrong">
            −{summaryCounts.extra} extra (struck)
          </span>
        )}
        {summaryCounts.swapped > 0 && (
          <span className="pill pill-highlight">
            ⇄ {summaryCounts.swapped} swapped pair
            {summaryCounts.swapped > 1 ? 's' : ''}
          </span>
        )}
        {summaryCounts.wrong > 0 && (
          <span className="pill pill-wrong">
            ≠ {summaryCounts.wrong} wrong letter
            {summaryCounts.wrong > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
