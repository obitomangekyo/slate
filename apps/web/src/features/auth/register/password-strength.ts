import { useEffect, useState } from "react";
import { MIN_PASSWORD_SCORE } from "#/features/auth/register/schemas";

const strengthLabels = ["Very weak", "Weak", "Fair", "Strong", "Very strong"] as const;

type PasswordAssessment = {
  password: string;
  score: number;
  feedback: string | null;
};

type PasswordEstimator = {
  check(password: string): {
    score: number;
    feedback: { warning: string | null; suggestions: string[] };
  };
};

let estimatorPromise: Promise<PasswordEstimator> | undefined;

function getEstimator() {
  if (!estimatorPromise) {
    // Load the large password checker only when someone starts typing a password.
    estimatorPromise = Promise.all([
      import("@zxcvbn-ts/core"),
      import("@zxcvbn-ts/language-common"),
      import("@zxcvbn-ts/language-en"),
    ])
      .then(
        ([{ ZxcvbnFactory }, common, english]) =>
          new ZxcvbnFactory({
            dictionary: { ...common.dictionary, ...english.dictionary },
            graphs: common.adjacencyGraphs,
            translations: english.translations,
          }),
      )
      .catch((error: unknown) => {
        // Clear a failed load so a later keystroke can try loading the library again.
        estimatorPromise = undefined;
        throw error;
      });
  }

  return estimatorPromise;
}

export function usePasswordStrength(password: string) {
  // Do not show a score for an older password while a new score is being calculated.
  const [assessment, setAssessment] = useState<PasswordAssessment | null>(null);
  const currentAssessment = assessment?.password === password ? assessment : null;
  const isChecking = Boolean(password) && !currentAssessment;

  useEffect(() => {
    if (!password) return;
    // Debounce checks while typing and ignore results for passwords that are now outdated.
    let active = true;
    const timeout = window.setTimeout(() => {
      getEstimator()
        .then((estimator) => {
          const result = estimator.check(password);
          if (!active) return;
          setAssessment({
            password,
            score: result.score,
            feedback: result.feedback.warning || result.feedback.suggestions[0] || null,
          });
        })
        .catch(() => {
          if (!active) return;
          setAssessment({
            password,
            score: 0,
            feedback: "We couldn't assess this password. Please try again.",
          });
        });
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [password]);

  return {
    assessment: currentAssessment,
    isChecking,
    meetsMinimum: currentAssessment !== null && currentAssessment.score >= MIN_PASSWORD_SCORE,
    label: currentAssessment ? (strengthLabels[currentAssessment.score] ?? "Unknown") : null,
  };
}
