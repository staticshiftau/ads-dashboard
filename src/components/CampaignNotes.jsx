'use client';

import { useState, useEffect } from 'react';

const VISIBLE_COUNT = 3;

export default function CampaignNotes({ clientSlug }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [noteDate, setNoteDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Default date to today in YYYY-MM-DD (for the date input)
    const today = new Date().toISOString().split('T')[0];
    setNoteDate(today);
    fetchNotes();
  }, [clientSlug]);

  async function fetchNotes() {
    setLoading(true);
    try {
      const res = await fetch(`/api/notes?client=${clientSlug}&t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes || []);
      }
    } catch (e) {
      console.error('Failed to fetch notes:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!newNote.trim()) return;

    setSubmitting(true);
    setError(null);

    // Convert YYYY-MM-DD to D/M/YYYY for display in sheet
    const [y, m, d] = noteDate.split('-');
    const displayDate = `${parseInt(d)}/${parseInt(m)}/${y}`;

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: clientSlug,
          note: newNote.trim(),
          date: displayDate,
        }),
      });

      if (res.ok) {
        setNewNote('');
        setShowForm(false);
        // Reset date to today
        setNoteDate(new Date().toISOString().split('T')[0]);
        fetchNotes();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save note');
      }
    } catch (e) {
      setError('Failed to save note');
    } finally {
      setSubmitting(false);
    }
  }

  const visibleNotes = expanded ? notes : notes.slice(0, VISIBLE_COUNT);
  const hasMore = notes.length > VISIBLE_COUNT;
  const hiddenCount = notes.length - VISIBLE_COUNT;

  return (
    <div className="glass-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Campaign Notes</h3>
          {notes.length > 0 && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{
                background: 'rgba(99,102,241,0.1)',
                color: 'var(--color-accent-light)',
              }}
            >
              {notes.length}
            </span>
          )}
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setError(null);
          }}
          className="px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors"
          style={{
            background: showForm
              ? 'rgba(239,68,68,0.1)'
              : 'rgba(55,160,232,0.1)',
            color: showForm
              ? 'var(--color-red)'
              : 'var(--color-accent-light)',
            border: `1px solid ${showForm ? 'rgba(239,68,68,0.3)' : 'rgba(55,160,232,0.3)'}`,
          }}
        >
          {showForm ? 'Cancel' : '+ Add Note'}
        </button>
      </div>

      {/* Add Note Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <label
              className="text-[11px] font-medium"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Date
            </label>
            <input
              type="date"
              value={noteDate}
              onChange={(e) => setNoteDate(e.target.value)}
              className="px-2 py-1 text-xs rounded-lg"
              style={{
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
                outline: 'none',
                colorScheme: 'dark',
              }}
            />
          </div>
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="e.g. Ads campaign deactivated due to payment error - asked client to pay urgently."
            rows={2}
            className="w-full px-3 py-2 text-xs rounded-lg resize-none"
            style={{
              background: 'rgba(0,0,0,0.2)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              outline: 'none',
            }}
            onFocus={(e) =>
              (e.target.style.borderColor = 'var(--color-accent)')
            }
            onBlur={(e) =>
              (e.target.style.borderColor = 'var(--color-border)')
            }
          />
          {error && (
            <div
              className="text-[11px] mt-1.5 px-2 py-1 rounded"
              style={{
                color: 'var(--color-red)',
                background: 'rgba(239,68,68,0.1)',
              }}
            >
              {error}
            </div>
          )}
          <div className="flex justify-end mt-2">
            <button
              type="submit"
              disabled={submitting || !newNote.trim()}
              className="px-3 py-1.5 text-[11px] font-medium rounded-lg transition-colors"
              style={{
                background:
                  submitting || !newNote.trim()
                    ? 'var(--color-border)'
                    : 'var(--color-accent)',
                color:
                  submitting || !newNote.trim()
                    ? 'var(--color-text-muted)'
                    : 'white',
                cursor:
                  submitting || !newNote.trim()
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              {submitting ? 'Saving...' : 'Save Note'}
            </button>
          </div>
        </form>
      )}

      {/* Notes List */}
      {loading ? (
        <div
          className="text-xs py-3 loading-pulse"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Loading notes...
        </div>
      ) : notes.length === 0 ? (
        <div
          className="text-xs py-3"
          style={{ color: 'var(--color-text-muted)' }}
        >
          No campaign notes yet. Click "+ Add Note" to log an update.
        </div>
      ) : (
        <div className="space-y-1.5">
          {visibleNotes.map((note, i) => (
            <div
              key={i}
              className="flex gap-3 text-xs py-2 px-3 rounded"
              style={{ background: 'rgba(0,0,0,0.15)' }}
            >
              <span
                className="font-semibold whitespace-nowrap shrink-0"
                style={{ color: 'var(--color-accent-light)', minWidth: '52px' }}
              >
                {note.date}
              </span>
              <span className="leading-relaxed">{note.note}</span>
            </div>
          ))}

          {/* Expand/Collapse toggle */}
          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[11px] w-full py-2 rounded-lg transition-colors hover:underline"
              style={{ color: 'var(--color-accent-light)' }}
            >
              {expanded
                ? 'Show less'
                : `Show ${hiddenCount} more note${hiddenCount === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
