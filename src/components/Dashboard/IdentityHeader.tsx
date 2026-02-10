import { useGoalsStore } from '../../stores/goalsStore';

export default function IdentityHeader() {
  const { getActiveGoal } = useGoalsStore();
  const activeGoal = getActiveGoal();

  if (!activeGoal) {
    return (
      <div className="glass-surface p-6">
        <p className="text-txt-muted text-center">
          No active goal set. Create a goal to see your identity reinforcement here.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-surface p-6">
      {/* Identity Reinforcement */}
      {activeGoal.identityReinforcement && (
        <div className="mb-4">
          <h3 className="uppercase tracking-wider text-xs text-txt-muted mb-1">I am becoming...</h3>
          <p className="text-lg font-display font-semibold text-txt-primary">
            {activeGoal.identityReinforcement}
          </p>
        </div>
      )}

      {/* Current Goal */}
      <div>
        <h3 className="uppercase tracking-wider text-xs text-txt-muted mb-1">Current Goal</h3>
        <p className="text-xl font-display font-semibold text-focus">{activeGoal.title}</p>
        {activeGoal.description && (
          <p className="text-sm text-txt-secondary mt-1">{activeGoal.description}</p>
        )}
      </div>
    </div>
  );
}
