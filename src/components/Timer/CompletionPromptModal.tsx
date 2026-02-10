interface CompletionPromptModalProps {
  onContinue: () => void;
  onBreak: () => void;
  taskId: string | null;
  intention: string;
}

export default function CompletionPromptModal({
  onContinue,
  onBreak,
  taskId,
  intention
}: CompletionPromptModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glass-surface-elevated max-w-md w-full mx-4 animate-scale-in">
        <div className="px-6 py-4 border-b border-glass-border">
          <h2 className="text-xl font-display font-semibold text-txt-primary">Session Complete!</h2>
          <p className="text-sm text-txt-muted mt-1">What would you like to do next?</p>
        </div>

        <div className="px-6 py-6">
          {/* Show context of completed session */}
          {(taskId || intention) && (
            <div className="mb-6 p-4 bg-glass-bg rounded-xl border border-glass-border">
              <p className="text-sm font-medium text-txt-secondary mb-2">Just completed:</p>
              {taskId && (
                <p className="text-sm text-focus font-mono">Task #{taskId}</p>
              )}
              {intention && (
                <p className="text-sm text-txt-muted italic mt-1">"{intention}"</p>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-3">
            <button
              onClick={onContinue}
              className="w-full px-6 py-4 bg-focus text-drip-bg
                       rounded-xl font-display font-medium text-lg transition-all
                       flex items-center justify-center gap-3
                       shadow-glow-focus hover:scale-[1.01] active:scale-[0.99]"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              Continue Working
            </button>

            <button
              onClick={onBreak}
              className="w-full px-6 py-4 bg-break/10 border border-break/20 text-break
                       rounded-xl font-display font-medium text-lg transition-all
                       flex items-center justify-center gap-3
                       hover:bg-break/20"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" />
              </svg>
              Start Break
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
