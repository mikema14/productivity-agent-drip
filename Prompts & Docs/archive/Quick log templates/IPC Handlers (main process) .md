// In preload/main
getTemplates: () => db.all('SELECT * FROM log_templates'),
addTemplate: (t) => db.run(
  'INSERT INTO log_templates (id, name, task_id, default_duration, billable) VALUES (?, ?, ?, ?, ?)',
  [t.id, t.name, t.task_id, t.default_duration, t.billable]
),
deleteTemplate: (id) => db.run('DELETE FROM log_templates WHERE id = ?', [id])