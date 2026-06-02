import type { RiskScoreReasoningPresentation } from "../lib/scoring";
import {
  RISK_SCORE_REASONING_ARIA_LABEL,
  RISK_SCORE_REASONING_CHAIN_CLASS,
  RISK_SCORE_REASONING_EMPTY_CLASS,
  RISK_SCORE_REASONING_HEADING,
  RISK_SCORE_REASONING_HEADING_CLASS,
  RISK_SCORE_REASONING_SECTION_CLASS,
  RISK_SCORE_REASONING_STEP_CLASS,
} from "../lib/scoring";

export type RiskScoreReasoningChainSectionProps = {
  presentation: RiskScoreReasoningPresentation;
};

export function RiskScoreReasoningChainSection({
  presentation,
}: RiskScoreReasoningChainSectionProps) {
  return (
    <section
      className={RISK_SCORE_REASONING_SECTION_CLASS}
      aria-label={RISK_SCORE_REASONING_ARIA_LABEL}
    >
      <p className={RISK_SCORE_REASONING_HEADING_CLASS}>
        {RISK_SCORE_REASONING_HEADING}
      </p>
      {presentation.mode === "empty" ? (
        <p className={RISK_SCORE_REASONING_EMPTY_CLASS} role="note">
          {presentation.detail}
        </p>
      ) : (
        <ol className={RISK_SCORE_REASONING_CHAIN_CLASS}>
          {presentation.chain.sourceLines.map((line, index) => (
            <li
              key={
                presentation.sourceIds[index] ?? `reasoning-${index}`
              }
              className={RISK_SCORE_REASONING_STEP_CLASS}
            >
              {line}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
