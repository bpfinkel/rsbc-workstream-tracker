import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';

const EMPTY_FORM = {
  id: '',
  title: '',
  description: '',
  workstream: '',
  deadline: '',
  status: '',
  assignees: [],
  notes: ''
};

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.round((d - today) / 86400000);
}

function statusClass(s) {
  return 'status-' + String(s || '').replace(/\s+/g, '-');
}

export default function Home() {
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [workstreams, setWorkstreams] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const [search, setSearch] = useState('');
  const [filterWorkstream, setFilterWorkstream] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [toast, setToast] = useState('');
  const [customAssigneeInput, setCustomAssigneeInput] = useState('');

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }

  async function loadData() {
    const res = await fetch('/api/tasks');
    const data = await res.json();
    setTasks(data.tasks || []);
    setMembers(data.members || []);
    setStatuses(data.statuses || []);
    setWorkstreams(data.workstreams || []);
    setLoaded(true);
  }

  useEffect(() => {
    loadData().catch((e) => showToast('Error: ' + e.message));
  }, []);

  function openAddModal() {
    setForm({ ...EMPTY_FORM, status: statuses[0] || '' });
    setCustomAssigneeInput('');
    setModalOpen(true);
  }

  function openEditModal(task) {
    setForm({
      id: task.id,
      title: task.title,
      description: task.description,
      workstream: task.workstream,
      deadline: task.deadline,
      status: task.status,
      assignees: task.assignees,
      notes: task.notes
    });
    setCustomAssigneeInput('');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  function toggleAssignee(name) {
    setForm((f) => {
      const has = f.assignees.includes(name);
      return { ...f, assignees: has ? f.assignees.filter((a) => a !== name) : [...f.assignees, name] };
    });
  }

  function addCustomAssignee() {
    const name = customAssigneeInput.trim();
    if (!name) return;
    setForm((f) => (f.assignees.includes(name) ? f : { ...f, assignees: [...f.assignees, name] }));
    setCustomAssigneeInput('');
  }
