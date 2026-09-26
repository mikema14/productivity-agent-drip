export function AddTemplateModal({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [taskId, setTaskId] = useState('');
  const [duration, setDuration] = useState(30);
  const [billable, setBillable] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await window.api.addTemplate({ 
      id: `tpl-${Date.now()}`,
      name, 
      task_id: taskId, 
      default_duration: duration, 
      billable: billable ? 1 : 0 
    });
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl w-80 space-y-4">
        <h3 className="font-bold">Add Quick Log Template</h3>
        <input placeholder="Name (e.g., Admin)" value={name} onChange={e => setName(e.target.value)} 
          className="w-full px-3 py-2 border rounded" required />
        <input placeholder="Task ID" value={taskId} onChange={e => setTaskId(e.target.value)}
          className="w-full px-3 py-2 border rounded" required />
        <input type="number" placeholder="Duration (min)" value={duration} onChange={e => setDuration(+e.target.value)}
          className="w-full px-3 py-2 border rounded" />
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={billable} onChange={e => setBillable(e.target.checked)} />
          Billable
        </label>
        <div className="flex gap-2">
          <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded">Save</button>
          <button type="button" onClick={onClose} className="flex-1 py-2 bg-gray-100 rounded">Cancel</button>
        </div>
      </form>
    </div>
  );
}