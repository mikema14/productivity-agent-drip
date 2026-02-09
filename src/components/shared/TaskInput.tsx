import { useTaskLookup } from '../../hooks/useTaskLookup';
import type { IssueData } from '../../types';

interface TaskInputProps {
  value: string;
  onChange: (value: string) => void;
  onTaskFound?: (data: IssueData) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * TaskInput - Intelligent task ID input with auto-fetch and validation
 *
 * Features:
 * - Auto-fetches task details after 500ms debounce
 * - Shows loading spinner while fetching
 * - Shows task title below input on success (green checkmark)
 * - Shows error message for invalid numeric IDs (red warning)
 * - Allows non-numeric IDs without validation (hybrid approach)
 * - Cache-first strategy for instant lookups
 *
 * @param value - Current task ID value
 * @param onChange - Callback when value changes
 * @param onTaskFound - Optional callback when task is found
 * @param placeholder - Input placeholder text
 * @param className - Additional CSS classes for the input
 * @param disabled - Whether input is disabled
 * @param autoFocus - Whether to autofocus the input
 */
export default function TaskInput({
  value,
  onChange,
  onTaskFound,
  placeholder = 'e.g., 643749',
  className = '',
  disabled = false,
  autoFocus = false
}: TaskInputProps) {
  const { taskData, isLoading, error, isValid } = useTaskLookup(value, {
    onTaskFound
  });

  // Determine border color based on state
  let borderColor = 'border-gray-300';
  if (error && !isValid) {
    borderColor = 'border-red-500';
  } else if (taskData && isValid) {
    borderColor = 'border-green-500';
  }

  return (
    <div className="relative">
      {/* Input field */}
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className={`
            w-full px-3 py-2 border rounded
            focus:outline-none focus:ring-2 focus:ring-blue-500
            ${borderColor}
            ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}
            ${className}
          `}
        />

        {/* Loading spinner (right side of input) */}
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* Success checkmark (right side of input) */}
        {!isLoading && taskData && isValid && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className="text-green-600 text-lg">✓</span>
          </div>
        )}

        {/* Error warning (right side of input) */}
        {!isLoading && error && !isValid && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className="text-red-600 text-lg">⚠</span>
          </div>
        )}
      </div>

      {/* Task title display (below input, success state) */}
      {!isLoading && taskData && isValid && (
        <div className="mt-1 text-xs text-green-600 flex items-center gap-1">
          <span className="font-semibold">✓</span>
          <span className="truncate">{taskData.title}</span>
        </div>
      )}

      {/* Error message (below input, error state) */}
      {!isLoading && error && !isValid && (
        <div className="mt-1 text-xs text-red-600 flex items-center gap-1">
          <span className="font-semibold">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* Helper text (below input, idle state with non-empty value) */}
      {!isLoading && !taskData && !error && value && value.trim() && !/^\d+$/.test(value.trim()) && (
        <div className="mt-1 text-xs text-gray-500">
          Non-numeric ID - will not be validated
        </div>
      )}
    </div>
  );
}
