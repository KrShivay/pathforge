import { Check } from "lucide-react";

interface StepperProps {
  steps: string[];
  current: number;
  /** Highest step the user has reached (controls which labels are clickable). */
  furthest: number;
  onJump: (index: number) => void;
}

export default function Stepper({
  steps,
  current,
  furthest,
  onJump,
}: StepperProps) {
  return (
    <ol className="wizard-stepper">
      {steps.map((label, index) => {
        const state =
          index < current ? "done" : index === current ? "current" : "todo";
        const reachable = index <= furthest;

        return (
          <li key={label} className={`wizard-step is-${state}`}>
            <button
              type="button"
              className="wizard-step-button"
              disabled={!reachable}
              title={
                reachable
                  ? `Go to ${label}`
                  : "Complete the previous step first"
              }
              aria-current={state === "current" ? "step" : undefined}
              onClick={() => reachable && onJump(index)}
            >
              <span className="wizard-step-marker">
                {state === "done" ? <Check size={14} /> : index + 1}
              </span>
              <span className="wizard-step-label">{label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
