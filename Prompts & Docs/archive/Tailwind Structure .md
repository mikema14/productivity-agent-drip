// TaskIdInput.tsx
export function TaskIdInput({ value, onChange, onTaskSelect, placeholder = "Task ID" }) {
  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState([]);
  
  useEffect(() => {
    window.api.getRecentTasks().then(setTasks);
  }, []);
  
  const filtered = value 
    ? tasks.filter(t => 
        t.task_id.includes(value) || 
        t.title.toLowerCase().includes(value.toLowerCase())
      )
    : tasks;

  return (
    <div className="relative">
      <input 
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        className="w-full px-3 py-2 border rounded"
        placeholder={placeholder}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-64 overflow-auto">
          <div className="px-3 py-1.5 text-xs text-gray-400 border-b">Recent</div>
          {filtered.map(t => (
            <div 
              key={t.task_id}
              onClick={() => { 
                onTaskSelect(t.task_id, t.title); 
                onChange(t.task_id);
                setOpen(false); 
              }}
              className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex gap-2"
            >
              <span className="font-mono text-blue-600 shrink-0">#{t.task_id}</span>
              <span className="text-gray-600 truncate">{t.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}