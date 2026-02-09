import { useGoalsStore } from '../../stores/goalsStore';

export default function IdentityHeader() {
  const { getActiveGoal } = useGoalsStore();
  const activeGoal = getActiveGoal();

  if (!activeGoal) {
    return (
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <p className="text-gray-500 text-center">
          No active goal set. Create a goal to see your identity reinforcement here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      {/* Identity Reinforcement */}
      {activeGoal.identityReinforcement && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-500 mb-1">I am becoming...</h3>
          <p className="text-lg font-semibold text-gray-900">
            {activeGoal.identityReinforcement}
          </p>
        </div>
      )}

      {/* Current Goal */}
      <div>
        <h3 className="text-sm font-medium text-gray-500 mb-1">Current Goal</h3>
        <p className="text-xl font-bold text-blue-600">{activeGoal.title}</p>
        {activeGoal.description && (
          <p className="text-sm text-gray-600 mt-1">{activeGoal.description}</p>
        )}
      </div>
    </div>
  );
}
