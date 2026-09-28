export function QuickLogBar() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const { addManualEntry, selectedDate } = useLogStore();

  useEffect(() => {
    window.api.getTemplates().then(setTemplates);
  }, []);

  const handleClick = (t: Template) => {
    addManualEntry({
      date: selectedDate,
      taskId: t.task_id,
      durationMinutes: t.default_duration,
      comment: t.name,
      billable: Boolean(t.billable),
      markedToLog: true
    });
  };

  return (
    <div className="flex items-center gap-2 py-3 border-t">
      <span className="text-sm text-gray-500">Quick:</span>
      {templates.map(t => (
        <button
          key={t.id}
          onClick={() => handleClick(t)}
          className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded"
        >
          {t.name} <span className="text-gray-400">{t.default_duration}m</span>
        </button>
      ))}
      <button
        onClick={() => setShowAdd(true)}
        className="px-2 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded"
      >
        + Add
      </button>
      {showAdd && <AddTemplateModal onClose={() => setShowAdd(false)} onSave={() => {
        window.api.getTemplates().then(setTemplates);
        setShowAdd(false);
      }} />}
    </div>
  );
}